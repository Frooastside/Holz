import dotenv from "dotenv";
import express from "express";
import api from "./api";
import { env } from "./environment";

dotenv.config();

const app = express();

app.set("trust proxy", 1);

app.use(express.json());

app.use("/api", api);
app.all("/", (_req, res) => res.sendStatus(200));

app.listen(env("PORT") || 6000);
