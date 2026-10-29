import { readFile } from "node:fs/promises";
import path from "node:path";
import { assetPath } from "@/lib/assets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const contentTypes: Record<string, string> = {
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml", ".gif": "image/gif", ".webp": "image/webp",
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const file = assetPath((await params).path);
  if (!file) return new Response(null, { status: 404, headers: { "Cache-Control": "no-store" } });
  try {
    const bytes = await readFile(file);
    return new Response(bytes, { headers: {
      "Content-Type": contentTypes[path.extname(file)],
      "Cache-Control": "public, max-age=86400",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
    } });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") console.error("Could not read card image:", error);
    return new Response(null, { status: 404, headers: { "Cache-Control": "no-store" } });
  }
}
