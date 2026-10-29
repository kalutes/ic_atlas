import { getStore } from "@/lib/db";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    getStore().sqlite.prepare("SELECT 1").get();
    return Response.json({ status: "ok" });
  } catch (error) {
    console.error(error);
    return Response.json({ status: "unavailable" }, { status: 503 });
  }
}
