self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload = {};
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "Familie App", body: event.data.text() };
  }

  const title = payload.title || "Familie App";
  const options = {
    body: payload.body || "Ny påminnelse",
    data: {
      url: payload.url || "/kalender",
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification?.data?.url || "/kalender";
  event.waitUntil(clients.openWindow(targetUrl));
});
