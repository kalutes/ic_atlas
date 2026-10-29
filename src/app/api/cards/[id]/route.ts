import { NextResponse } from "next/server";
import { z } from "zod";
import { getStore } from "@/lib/db";
import { failure, mutationAllowed } from "@/lib/http";
export const runtime = "nodejs";
const patchSchema = z
  .object({
    owned: z.boolean().optional(),
    notes: z.string().max(5000).optional(),
    acquiredDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .refine((value) => {
        const date = new Date(`${value}T00:00:00Z`);
        return (
          !Number.isNaN(date.getTime()) &&
          date.toISOString().slice(0, 10) === value
        );
      })
      .nullable()
      .optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0);
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!mutationAllowed(request))
    return failure(
      "This request must come from the app's configured origin.",
      403,
    );
  const body = await request.text();
  if (body.length > 25000) return failure("Request too large.", 413);
  let json: unknown;
  try {
    json = JSON.parse(body);
  } catch {
    return failure("Invalid request.");
  }
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success)
    return failure("Check the date and notes (maximum 5,000 characters).");
  const { id } = await params;
  if (
    !getStore()
      .list()
      .some((c) => c.id === id)
  )
    return failure("Card not found.", 404);
  try {
    return NextResponse.json(getStore().update(id, parsed.data));
  } catch (error) {
    console.error(error);
    return failure("Could not save your changes. Please try again.", 500);
  }
}
