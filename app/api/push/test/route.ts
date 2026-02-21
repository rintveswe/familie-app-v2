import { NextResponse } from "next/server";
import { getData } from "@/lib/server/data-store";
import { pushEnabled, sendPush } from "@/lib/server/push";
import { findUser, isUserId } from "@/lib/shared/users";

export const runtime = "nodejs";

type TestPushBody = {
  userId?: string;
};

export async function POST(req: Request) {
  if (!pushEnabled()) {
    return NextResponse.json({ error: "Push is not configured on server." }, { status: 500 });
  }

  const body = (await req.json()) as TestPushBody;
  if (!isUserId(body.userId)) {
    return NextResponse.json({ error: "Invalid user." }, { status: 400 });
  }

  const data = await getData();
  const targets = data.subscriptions.filter((record) => record.userId === body.userId);
  let sent = 0;

  for (const target of targets) {
    try {
      await sendPush(target.subscription, {
        title: `Test push for ${findUser(body.userId)?.name ?? "user"}`,
        body: "Dette er en testmelding fra Familie App.",
        url: "/kalender",
      });
      sent += 1;
    } catch {
      // Ignore failed subscriptions here; cleanup happens in reminder job.
    }
  }

  return NextResponse.json({ ok: true, sent });
}
