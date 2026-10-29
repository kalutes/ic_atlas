import { NextResponse } from "next/server";
export function mutationAllowed(request: Request) {
  const origin = request.headers.get("origin");
  const allowed = process.env.APP_ORIGIN || new URL(request.url).origin;
  return (
    !!origin &&
    origin === allowed &&
    request.headers.get("sec-fetch-site") !== "cross-site"
  );
}
export function failure(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}
