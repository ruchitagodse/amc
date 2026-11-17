import type { State } from "./domain";

export async function readApiResponse<T>(response: Response): Promise<T> {
  const raw = await response.text();
  if (!raw.trim())
    throw new Error(
      `The server returned an empty response (HTTP ${response.status}). Check the deployment runtime logs and Firebase configuration.`,
    );
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error(
      `The server returned an invalid response (HTTP ${response.status}). Check that the deployment is running the Next.js server and API routes.`,
    );
  }
  if (!response.ok) {
    const message =
      data && typeof data === "object" && "error" in data
        ? data.error
        : undefined;
    throw new Error(
      typeof message === "string"
        ? message
        : `The server request failed (HTTP ${response.status}). Please try again.`,
    );
  }
  return data as T;
}

export function isAssetState(value: unknown): value is State {
  if (!value || typeof value !== "object") return false;
  const s = value as Record<string, unknown>;
  return (
    typeof s.version === "number" &&
    [
      "assets",
      "categories",
      "vendors",
      "employees",
      "allocations",
      "repairs",
      "events",
      "processed",
    ].every((key) => Array.isArray(s[key]))
  );
}
