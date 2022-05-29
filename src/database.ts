import { JsonDB } from "node-json-db";
import { Config } from "node-json-db/dist/lib/JsonDBConfig";
import { Captcha } from "./types";

export const database = new JsonDB(new Config("security/database.json", true, true, "/"));

export function patchCaptcha(captcha: Captcha) {
  database.push(`/captchas/${captcha.cid}`, captcha, true);
}

export function fetchCaptcha(cid: string): Captcha | undefined {
  try {
    return database.getData(`/captchas/${cid}`);
  } catch (error) {
    return undefined;
  }
}
