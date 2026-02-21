import { NextResponse } from "next/server";
import { updateData } from "@/lib/server/data-store";

export const runtime = "nodejs";

type Context = { params: Promise<{ id: string }> };

export async function DELETE(_req: Request, context: Context) {
  const { id } = await context.params;

  const updated = await updateData((current) => ({
    ...current,
    events: current.events.filter((event) => event.id !== id),
    sentReminders: current.sentReminders.filter((key) => !key.startsWith(`${id}:`)),
  }));

  return NextResponse.json({ events: updated.events });
}
