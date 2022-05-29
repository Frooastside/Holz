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

  constructor() {
    this.id = PROVIDER_ID;
    this.fn = _getSolutions;
  }
}

async function _getSolutions(captchas: CaptchaInfo[], token?: string): Promise<GetSolutionsResult> {
  const solutions = await Promise.all(captchas.map((captcha) => _getSolution(captcha)));
  return { solutions, error: solutions.find((solution) => !!solution.error) };
}

async function _getSolution(captcha: CaptchaInfo): Promise<CaptchaSolution> {
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

    const result = await solve(captcha.url, captcha.sitekey);

    solution.providerCaptchaId = result.cid;
    solution.text = result.token;
    solution.hasSolution = !!solution.text;
    solution.responseAt = new Date();
    solution.duration = (solution.responseAt.getDate() - solution.requestAt.getDate()) / 1000;
  } catch (error) {
    solution.error = (error as Error).toString();
  }
  return solution;
}

async function poll(cid: string): Promise<Captcha> {
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
        let body: string;
        response.on("data", (chunk) => {
          body += chunk;
        });
        response.on("end", () => {
          if (response.statusCode !== 200 && response.statusCode !== 425) {
            clearTime();
            return reject(body);
          }
          if (response.statusCode == 425) {
            return;
          }
          let captcha: Captcha;
          try {
            captcha = JSON.parse(body);
            if (!isCaptcha(captcha)) {
              clearTime();
              return reject(`Invalid captcha: ${JSON.stringify(captcha)}`);
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
    }, 2500);
  });
}

async function solve(url: string, sitekey: string): Promise<Captcha> {
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
      let body: string;
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
          resolve(await poll(cid));
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
}
