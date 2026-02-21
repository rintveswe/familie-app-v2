import { NextResponse } from "next/server";
import { getData, updateData } from "@/lib/server/data-store";
import { sendPush, pushEnabled } from "@/lib/server/push";
import { findUser } from "@/lib/shared/users";

export const runtime = "nodejs";

const LOOKBACK_MS = 6 * 60 * 1000;

export async function GET(req: Request) {
  return runReminderJob(req);
}

export async function POST(req: Request) {
  return runReminderJob(req);
}

async function runReminderJob(req: Request) {
  if (!pushEnabled()) {
    return NextResponse.json({ error: "Push is not configured on server." }, { status: 500 });
  }

  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized cron call." }, { status: 401 });
  }

  const now = Date.now();
  const data = await getData();
  const newSentKeys = new Set<string>(data.sentReminders);
  let pushCount = 0;
  const deadEndpoints = new Set<string>();

  for (const event of data.events) {
    if (event.allDay) {
      continue;
    }

    const startAt = Date.parse(event.start);
    if (!Number.isFinite(startAt)) {
      continue;
    }

    const reminderAt = startAt - 60 * 60 * 1000;
    if (reminderAt > now || now - reminderAt > LOOKBACK_MS) {
      continue;
    }

    const targets = data.subscriptions.filter((record) => record.userId === event.ownerId);
    for (const target of targets) {
      const dedupeKey = `${event.id}:${target.subscription.endpoint}:${reminderAt}`;
      if (newSentKeys.has(dedupeKey)) {
        continue;
      }

      try {
        await sendPush(target.subscription, {
          title: `Paaminnelse for ${findUser(event.ownerId)?.name ?? "familie"}`,
          body: `${event.title} starter ${formatDateTime(event.start)}`,
          url: "/kalender",
        });
        newSentKeys.add(dedupeKey);
        pushCount += 1;
      } catch (error: unknown) {
        const statusCode =
          typeof error === "object" && error && "statusCode" in error ? Number(error.statusCode) : 0;
        if (statusCode === 404 || statusCode === 410) {
          deadEndpoints.add(target.subscription.endpoint ?? "");
        }
      }
    }
  }

  await updateData((current) => ({
    ...current,
    sentReminders: Array.from(newSentKeys).slice(-6000),
    subscriptions: current.subscriptions.filter((record) => !deadEndpoints.has(record.subscription.endpoint ?? "")),
  }));

  return NextResponse.json({ ok: true, pushed: pushCount, removedSubscriptions: deadEndpoints.size });
}

function isAuthorized(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return true;
  }
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

function formatDateTime(isoString: string) {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) {
    return isoString;
  }
  return new Intl.DateTimeFormat("nb-NO", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}
