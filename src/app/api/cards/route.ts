import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { z } from "zod";
import { dataDirectory, getStore } from "@/lib/db";
import { failure, mutationAllowed } from "@/lib/http";
import { CATEGORIES, REGIONS } from "@/lib/types";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  return NextResponse.json(getStore().list(), {
    headers: { "Cache-Control": "no-store" },
  });
}
const customSchema = z.object({
  brand: z.string().trim().min(1).max(80),
  name: z.string().trim().min(1).max(160),
  japaneseName: z.string().trim().max(100).default(""),
  region: z.enum([...REGIONS, "Unknown"]),
  category: z.enum(CATEGORIES),
  notes: z.string().max(5000),
});
export async function POST(request: Request) {
  if (!mutationAllowed(request))
    return failure(
      "This request must come from the app's configured origin.",
      403,
    );
  if (Number(request.headers.get("content-length") || 0) > 6 * 1024 * 1024)
    return failure("Please choose an image smaller than 5 MB.", 413);
  let uploadPath: string | undefined;
  try {
    const reader = request.body?.getReader();
    if (!reader) return failure("Missing form data.");
    const chunks: Uint8Array[] = [];
    let length = 0;
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      length += part.value.length;
      if (length > 6 * 1024 * 1024) {
        await reader.cancel();
        return failure("Please choose an image smaller than 5 MB.", 413);
      }
      chunks.push(part.value);
    }
    const form = await new Response(Buffer.concat(chunks), {
      headers: { "Content-Type": request.headers.get("content-type") || "" },
    }).formData();
    const parsed = customSchema.safeParse(Object.fromEntries(form));
    if (!parsed.success)
      return failure(
        "Enter a brand, design name, and valid region/category. Notes must be under 5,000 characters.",
      );
    const file = form.get("image");
    let image = "";
    if (file instanceof File && file.size > 0) {
      if (
        file.size > 5 * 1024 * 1024 ||
        !["image/jpeg", "image/png", "image/webp"].includes(file.type)
      )
        return failure("Use a JPEG, PNG, or WebP image under 5 MB.");
      let output: Buffer;
      try {
        output = await sharp(Buffer.from(await file.arrayBuffer()), {
          limitInputPixels: 20_000_000,
        })
          .rotate()
          .resize(1000, 630, { fit: "contain", background: "#f3f2ed" })
          .webp({ quality: 90 })
          .toBuffer();
      } catch {
        return failure(
          "This image could not be read. Try a smaller JPEG, PNG, or WebP.",
        );
      }
      const filename = `${randomUUID()}.webp`;
      await mkdir(path.join(dataDirectory(), "uploads"), { recursive: true });
      uploadPath = path.join(dataDirectory(), "uploads", filename);
      await writeFile(uploadPath, output, { flag: "wx" });
      image = `/api/uploads/${filename}`;
    }
    const values = parsed.data;
    const existingBrand = getStore()
      .list()
      .find((c) => c.brand.toLowerCase() === values.brand.toLowerCase());
    const card = getStore().add(
      {
        ...values,
        brand: existingBrand?.brand || values.brand,
        id: `custom-${randomUUID()}`,
        image,
        issuer: "Personal catalog entry",
        compatibility: "Unknown",
        issuance: "Unknown",
        service: "Unknown",
        sourceUrl: "",
        imageSourceUrl: "",
        imageCredit: image ? "Personal upload" : "",
        imageLicense: image
          ? "User-provided image; rights retained by its owner"
          : "",
        verifiedDate: "",
        aliases: "",
        color: existingBrand?.color || "#3e6b58",
      },
      values.notes,
    );
    return NextResponse.json(card, { status: 201 });
  } catch (error) {
    if (uploadPath) await unlink(uploadPath).catch(() => {});
    console.error("Could not add design:", error);
    return failure("Could not save this design. Please try again.", 500);
  }
}
