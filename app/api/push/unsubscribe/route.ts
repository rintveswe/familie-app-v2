import { NextResponse } from "next/server";
import { updateData } from "@/lib/server/data-store";

export const runtime = "nodejs";

type UnsubscribeBody = {
  endpoint?: string;
};

export async function POST(req: Request) {
  const body = (await req.json()) as UnsubscribeBody;
  if (!body.endpoint) {
    return NextResponse.json({ error: "Missing endpoint." }, { status: 400 });
  }

  await updateData((current) => ({
    ...current,
    subscriptions: current.subscriptions.filter((record) => record.subscription.endpoint !== body.endpoint),
  }));

  return NextResponse.json({ ok: true });
}
