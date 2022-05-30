import express, { Router } from "express";
import { v4 as uuidv4 } from "uuid";
import { fetchCaptcha, patchCaptcha } from "./database";
import { Captcha, isCaptcha } from "./types";

const router: Router = express.Router();

router.post("/", async (req, res) => {
  const url = req.body.url ?? req.query.url;
  const sitekey = req.body.sitekey ?? req.query.sitekey;
  if (!url || !sitekey) {
    return res.sendStatus(400);
  }
  const cid = uuidv4();
  const captcha: Captcha = {
    cid: cid,
    url: url,
    sitekey: sitekey,
    creationDate: Date.now()
  };
  try {
    patchCaptcha(captcha);
    return res.json(cid);
  } catch (error) {
    return res.sendStatus(500);
  }
});

router.get("/", async (req, res) => {
  const cid = req.body.cid ?? req.query.cid;
  if (!cid) {
    return res.sendStatus(400);
  }
  try {
    const captcha = fetchCaptcha(cid);
    if (!captcha) {
      return res.sendStatus(400);
    }
    return res.json(captcha);
  } catch (error) {
    return res.sendStatus(500);
  }
});

router.patch("/", async (req, res) => {
  let currentState: Captcha | undefined;
  if (!(isCaptcha(req.body) || isCaptcha(req.query)) || !(currentState = fetchCaptcha(req.body.cid))) {
    return res.sendStatus(400);
  }
  const newState = (isCaptcha(req.body) ? req.body : req.query) as Captcha;
  if (!newState.token) {
    return res.sendStatus(403);
  }
  if (
    newState.cid !== currentState.cid ||
    newState.url !== currentState.url ||
    newState.sitekey !== currentState.sitekey
  ) {
    console.warn(newState, currentState);
    return res.sendStatus(403);
  }
  try {
    patchCaptcha(newState);
    return res.sendStatus(204);
  } catch (error) {
    return res.sendStatus(500);
  }
});

export default router;
