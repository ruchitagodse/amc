import { AppError } from "@/shared/errors";

export class ConfigurationError extends AppError {
  readonly statusCode = 503;
  readonly errorCode = "CONFIGURATION_ERROR";
}

export function assertRuntimeConfiguration(
  env: Record<string, string | undefined> = process.env,
) {
  const mode = env.AMS_STORE || "local";
  if (!["local", "firestore"].includes(mode))
    throw new ConfigurationError("AMS_STORE must be local or firestore.");
  if (mode === "local") {
    if (env.VERCEL === "1")
      throw new ConfigurationError(
        "This Vercel deployment is configured for the localhost-only demo. Set AMS_STORE=firestore and configure a separate Firebase demo project, then redeploy.",
      );
    return;
  }
  if (
    env.VERCEL === "1" &&
    (env.FIRESTORE_EMULATOR_HOST || env.FIREBASE_AUTH_EMULATOR_HOST)
  )
    throw new ConfigurationError(
      "Remove emulator environment variables from the cloud deployment.",
    );
  const required = [
    "FIREBASE_PROJECT_ID",
    "AMS_FIREBASE_PROJECT_CONFIRM",
    "SESSION_SECRET",
  ];
  if (!env.FIRESTORE_EMULATOR_HOST)
    required.push("FIREBASE_ADMIN_CLIENT_EMAIL", "FIREBASE_ADMIN_PRIVATE_KEY");
  const missing = required.filter((key) => !env[key]?.trim());
  if (missing.length)
    throw new ConfigurationError(
      `Firebase deployment configuration is incomplete. Set: ${missing.join(", ")}. Then redeploy.`,
    );
  if (env.FIREBASE_PROJECT_ID !== env.AMS_FIREBASE_PROJECT_CONFIRM)
    throw new ConfigurationError(
      "FIREBASE_PROJECT_ID and AMS_FIREBASE_PROJECT_CONFIRM must identify the same separate demo project.",
    );
  if (env.SESSION_SECRET!.length < 32)
    throw new ConfigurationError(
      "SESSION_SECRET must contain at least 32 characters.",
    );
}
