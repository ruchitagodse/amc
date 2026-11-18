import { randomBytes, createHash } from "node:crypto";
export const newQrToken = () => randomBytes(32).toString("base64url");
export const qrTokenHash = (token: string) =>
  createHash("sha256").update(token).digest("hex");
