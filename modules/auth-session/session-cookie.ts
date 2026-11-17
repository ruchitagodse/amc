import type { ResponseCookie } from "next/dist/compiled/@edge-runtime/cookies";
import { getEnv } from "@/shared/config/env";
import { UnauthorizedError } from "@/shared/errors";
import type { AppSession } from "@/modules/auth-session/types";

const SESSION_COOKIE_NAME = "ams_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

type SessionEnvelope = {
  exp: number;
  session: AppSession;
};

const encodeBase64Url = (value: string) =>
  Buffer.from(value, "utf8").toString("base64url");

const decodeBase64Url = (value: string) =>
  Buffer.from(value, "base64url").toString("utf8");

const textEncoder = new TextEncoder();

let signingKeyPromise: Promise<CryptoKey> | null = null;

const importSigningKey = async () => {
  if (!signingKeyPromise) {
    signingKeyPromise = crypto.subtle.importKey(
      "raw",
      textEncoder.encode(getEnv().SESSION_SECRET),
      {
        name: "HMAC",
        hash: "SHA-256",
      },
      false,
      ["sign"],
    );
  }

  return signingKeyPromise;
};

const signValue = async (value: string) => {
  const key = await importSigningKey();
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    textEncoder.encode(value),
  );

  return Buffer.from(signature).toString("base64url");
};

const signaturesMatch = (received: string, expected: string) =>
  received.length === expected.length &&
  received
    .split("")
    .reduce(
      (accumulator, character, index) =>
        accumulator | (character.charCodeAt(0) ^ expected.charCodeAt(index)),
      0,
    ) === 0;

export const getSessionCookieName = () => SESSION_COOKIE_NAME;

export const serializeSessionCookie = async (
  session: AppSession,
): Promise<string> => {
  const envelope: SessionEnvelope = {
    exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS,
    session,
  };
  const payload = encodeBase64Url(JSON.stringify(envelope));
  const signature = await signValue(payload);

  return `${payload}.${signature}`;
};

export const parseSessionCookie = async (
  cookieValue: string,
): Promise<AppSession> => {
  const [payload, signature, extra] = cookieValue.split(".");

  if (!payload || !signature || extra !== undefined) {
    throw new UnauthorizedError("Invalid session cookie format");
  }

  const expectedSignature = await signValue(payload);

  if (!signaturesMatch(signature, expectedSignature)) {
    throw new UnauthorizedError("Session cookie signature mismatch");
  }

  const envelope = JSON.parse(decodeBase64Url(payload)) as SessionEnvelope;

  if (
    !Number.isFinite(envelope.exp) ||
    envelope.exp <= Math.floor(Date.now() / 1000)
  ) {
    throw new UnauthorizedError("Session cookie expired");
  }

  return envelope.session;
};

export const buildSessionCookie = async (
  session: AppSession,
): Promise<ResponseCookie> => ({
  name: SESSION_COOKIE_NAME,
  value: await serializeSessionCookie(session),
  httpOnly: true,
  sameSite: "lax",
  secure: getEnv().NODE_ENV !== "development",
  path: "/",
  maxAge: SESSION_MAX_AGE_SECONDS,
});

export const buildClearedSessionCookie = (): ResponseCookie => ({
  name: SESSION_COOKIE_NAME,
  value: "",
  httpOnly: true,
  sameSite: "lax",
  secure: getEnv().NODE_ENV !== "development",
  path: "/",
  maxAge: 0,
  expires: new Date(0),
});
