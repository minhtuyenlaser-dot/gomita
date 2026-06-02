self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || "GOMITA";
  const options = {
    body: data.body || "",
    tag: data.tag || "gomita-push",
    data: {
      url: data.url || "/iphone"
    }
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/iphone";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client && client.url.includes(targetUrl)) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
      return Promise.resolve();
    })
  );
});
