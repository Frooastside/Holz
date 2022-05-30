import https, { RequestOptions } from "https";
import {
  CaptchaInfo,
  CaptchaSolution,
  GetSolutionsResult,
  SolutionProvider
} from "puppeteer-extra-plugin-recaptcha/dist/types";
import { Captcha, isCaptcha } from "./types";

export const PROVIDER_ID = "holz";

export class Holz implements SolutionProvider {
  id?: string;
  token?: string;
  fn?: (captchas: CaptchaInfo[], token?: string) => Promise<GetSolutionsResult>;
  requestSolver?: (cid: string, captcha: CaptchaInfo) => void;

  constructor(requestSolver?: (cid: string, captcha: CaptchaInfo) => void) {
    this.id = PROVIDER_ID;
    this.fn = this._getSolutions;
    this.requestSolver = requestSolver;
  }

  _getSolutions = async (captchas: CaptchaInfo[], token?: string): Promise<GetSolutionsResult> => {
    const solutions = await Promise.all(captchas.map((captcha) => this._getSolution(captcha)));
    return { solutions, error: solutions.find((solution) => !!solution.error) };
  };

  _getSolution = async (captcha: CaptchaInfo): Promise<CaptchaSolution> => {
    const solution: CaptchaSolution = {
      _vendor: captcha._vendor,
      provider: PROVIDER_ID
    };
    try {
      if (!captcha || !captcha.sitekey || !captcha.url || !captcha.id) {
        throw new Error("There is data missing in the captcha object.");
      }
      if (captcha._vendor !== "recaptcha") {
        throw new Error("Only recaptchas are supported.");
      }
      solution.id = captcha.id;
      solution.requestAt = new Date();

      const result = await this._solve(
        captcha.url,
        captcha.sitekey,
        (cid) => this.requestSolver && this.requestSolver(cid, captcha)
      );

      solution.providerCaptchaId = result.cid;
      solution.text = result.token;
      solution.hasSolution = !!solution.text;
      solution.responseAt = new Date();
      solution.duration = (solution.responseAt.getDate() - solution.requestAt.getDate()) / 1000;
    } catch (error) {
      solution.error = (error as Error).toString();
    }
    return solution;
  };

  _poll = async (cid: string): Promise<Captcha> => {
    return new Promise<Captcha>(async (resolve, reject) => {
      const clearTime = () => {
        clearTimeout(timeout);
        clearInterval(interval);
      };
      const timeout = setTimeout(() => {
        clearInterval(interval);
      }, 180000);
      const interval = setInterval(() => {
        const data = JSON.stringify({
          cid: cid
        });
        const requestOptions: RequestOptions = {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            "Content-Length": data.length
          }
        };

        const request = https.request(new URL("https://holz.wolkeneis.dev/api"), requestOptions, (response) => {
          let body = "";
          response.on("data", (chunk) => {
            body += chunk;
          });
          response.on("end", () => {
            if (response.statusCode !== 200) {
              clearTime();
              return reject(body);
            }
            let captcha: Captcha;
            try {
              captcha = JSON.parse(body);
              if (!isCaptcha(captcha)) {
                clearTime();
                return reject(`Invalid captcha: ${JSON.stringify(captcha)}`);
              }
              if (!captcha.token) {
                return;
              }
              clearTime();
              return resolve(captcha);
            } catch (error) {
              clearTime();
              return reject((error as Error).toString());
            }
          });
        });
        request.on("error", (error) => {
          request.destroy();
          clearTime();
          reject(error.toString());
        });
        request.write(data);
        request.end();
      }, 10000);
    });
  };

  _solve = async (url: string, sitekey: string, cidCallback?: (cid: string) => void): Promise<Captcha> => {
    return new Promise<Captcha>((resolve, reject) => {
      const data = JSON.stringify({
        url: url,
        sitekey: sitekey
      });
      const requestOptions: RequestOptions = {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": data.length
        }
      };

      const request = https.request(new URL("https://holz.wolkeneis.dev/api"), requestOptions, (response) => {
        let body = "";
        response.on("data", (chunk) => {
          body += chunk;
        });
        response.on("end", async () => {
          if (response.statusCode !== 200) {
            reject(body);
          }
          let cid: string;
          try {
            cid = JSON.parse(body);
            cidCallback && cidCallback(cid);
            resolve(await this._poll(cid));
          } catch (error) {
            reject((error as Error).toString());
          }
        });
      });
      request.on("error", (error) => {
        request.destroy();
        reject(error.toString());
      });
      request.write(data);
      request.end();
    });
  };
}
