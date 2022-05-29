import { fetchCaptcha, patchCaptcha } from "./database";
import express, { Router } from "express";
import { Captcha, isCaptcha } from "./types";
const router: Router = express.Router();

router.put("/", async (req, res) => {
  if (!isCaptcha(req.body) || fetchCaptcha(req.body.cid)) {
    return res.sendStatus(400);
  }
  const captcha = req.body as Captcha;
  try {
    patchCaptcha({
      ...captcha,
      creationDate: Date.now()
    });
    return res.sendStatus(204);
  } catch (error) {
    return res.sendStatus(500);
  }
});

router.get("/", async (req, res) => {
  if (!req.body.cid) {
    return res.sendStatus(400);
  }
  const cid = req.body.cid as string;
  try {
    const captcha = fetchCaptcha(cid);
    if (!captcha) {
      return res.sendStatus(400);
    }
    if (!captcha.token) {
      return res.sendStatus(425);
    }
    return res.json(captcha);
  } catch (error) {
    return res.sendStatus(500);
  }
});

router.patch("/", async (req, res) => {
  const currentState = fetchCaptcha(req.body.cid);
  if (!isCaptcha(req.body) || !currentState) {
    return res.sendStatus(400);
  }
  const newState = req.body as Captcha;
  if (!newState.token) {
    return res.sendStatus(403);
  }
  if (
    newState.cid !== currentState.cid ||
    newState.url !== currentState.url ||
    newState.sitekey !== currentState.sitekey
  ) {
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
