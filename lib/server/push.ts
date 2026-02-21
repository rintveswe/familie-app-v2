import webpush from "web-push";

let configured = false;

export function configurePush() {
  if (configured) {
    return;
  }

  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT ?? "mailto:admin@example.com";

  if (!publicKey || !privateKey) {
    return;
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
}

export function pushEnabled() {
  return Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

export async function sendPush(subscription: PushSubscriptionJSON, payload: Record<string, string>) {
  configurePush();
  await webpush.sendNotification(subscription as unknown as webpush.PushSubscription, JSON.stringify(payload));
}
