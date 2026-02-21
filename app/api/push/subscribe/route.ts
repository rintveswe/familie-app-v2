import { NextResponse } from "next/server";
import { updateData } from "@/lib/server/data-store";
import { pushEnabled } from "@/lib/server/push";
import { isUserId } from "@/lib/shared/users";

export const runtime = "nodejs";

type SubscribeBody = {
  userId?: string;
  subscription?: PushSubscriptionJSON;
};

export async function POST(req: Request) {
  if (!pushEnabled()) {
    return NextResponse.json({ error: "Push is not configured on server." }, { status: 500 });
  }

  const body = (await req.json()) as SubscribeBody;
  if (!isUserId(body.userId) || !body.subscription?.endpoint) {
    return NextResponse.json({ error: "Invalid subscription payload." }, { status: 400 });
  }

  const userId = body.userId;
  const subscription = body.subscription;
  const endpoint = body.subscription.endpoint;

  await updateData((current) => {
    const rest = current.subscriptions.filter((record) => record.subscription.endpoint !== endpoint);
    return {
      ...current,
      subscriptions: [
        ...rest,
        {
          userId,
          subscription,
          createdAt: new Date().toISOString(),
        },
      ],
    };
  });

  return NextResponse.json({ ok: true });
}
