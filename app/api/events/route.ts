import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { updateData, getData } from "@/lib/server/data-store";
import { CreateEventInput } from "@/lib/shared/types";
import { findUser, isUserId } from "@/lib/shared/users";

export const runtime = "nodejs";

export async function GET() {
  const data = await getData();
  return NextResponse.json({ events: data.events });
}

export async function POST(req: Request) {
  const body = (await req.json()) as Partial<CreateEventInput>;
  if (!body.title || !body.start || !isUserId(body.ownerId)) {
    return NextResponse.json({ error: "Invalid event payload." }, { status: 400 });
  }

  const owner = findUser(body.ownerId);
  const event = {
    id: randomUUID(),
    title: body.title.trim(),
    description: body.description?.trim() || undefined,
    start: body.start,
    end: body.end,
    allDay: Boolean(body.allDay),
    ownerId: body.ownerId,
    backgroundColor: owner?.color,
    borderColor: owner?.color,
    textColor: owner?.textColor,
  };

  const updated = await updateData((current) => ({
    ...current,
    events: [...current.events, event],
  }));

  return NextResponse.json({ event, events: updated.events }, { status: 201 });
}
