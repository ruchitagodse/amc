import { ZodError } from "zod";
import { AppError } from "@/shared/errors";
export function failure(error: unknown) {
  if (error instanceof ZodError)
    return Response.json(
      {
        error: error.issues
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join("; "),
      },
      { status: 400 },
    );
  if (error instanceof AppError)
    return Response.json(
      { error: error.message },
      { status: error.statusCode },
    );
  if (error instanceof SyntaxError)
    return Response.json({ error: "Invalid JSON request" }, { status: 400 });
  console.error(
    "AMS request failed:",
    error instanceof Error ? error.message : "Unknown error",
  );
  return Response.json(
    {
      error:
        "The request could not be completed. Check server configuration and try again.",
    },
    { status: 500 },
  );
}
export async function body(request: Request) {
  const raw = await request.text();
  if (raw.length > 20_000) throw new SyntaxError("Request too large");
  return JSON.parse(raw);
}
