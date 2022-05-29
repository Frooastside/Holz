import dotenv from "dotenv";

dotenv.config();

export function env(name: string): string | null {
  return process.env[name] ?? null;
}

export function envRequire(name: string): string {
  const value = env(name);
  if (value === null) {
    throw new Error(`The environment variable "${name}" is required for the programm to run.`);
  }
  return value;
}
