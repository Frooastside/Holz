export type Captcha = {
  cid: string;
  url: string;
  sitekey: string;
  token?: string;
  creationDate?: number;
};

export function isCaptcha(captcha: unknown): captcha is Captcha {
  return !!(captcha as Captcha).cid && !!(captcha as Captcha).url && !!(captcha as Captcha).sitekey;
}
