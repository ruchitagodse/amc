import { randomBytes } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
function localSecret() {
  const dir = path.join(process.cwd(), ".demo-data");
  const file = path.join(dir, "session-secret");
  mkdirSync(dir, { recursive: true });
  try {
    writeFileSync(file, randomBytes(48).toString("hex"), {
      flag: "wx",
      mode: 0o600,
    });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
  }
  return readFileSync(file, "utf8");
}
export const getEnv = () => {
  if (
    process.env.AMS_STORE === "firestore" &&
    (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32)
  ) {
    throw new Error("Set a separate SESSION_SECRET of at least 32 characters");
  }
  return {
    SESSION_SECRET: process.env.SESSION_SECRET || localSecret(),
    NODE_ENV: process.env.NODE_ENV || "development",
  };
};
