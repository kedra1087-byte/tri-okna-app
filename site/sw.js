/* Сервис-воркер таверны: только показывает пуши и открывает приложение по нажатию. Ничего не кэширует. */

self.addEventListener("install", () => self.skipWaiting())
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()))

self.addEventListener("push", (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { body: event.data ? event.data.text() : "" }
  }
  event.waitUntil(self.registration.showNotification(data.title || "Три окна", {
    body: data.body || "",
    tag: data.tag || "tri-okna",
    icon: "assets/icon-192.png",
    badge: "assets/badge-96.png",
    lang: "ru",
    data: { url: new URL(data.url || "./", self.registration.scope).href },
  }))
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  const target = event.notification.data?.url || self.registration.scope
  event.waitUntil((async () => {
    const tabs = await self.clients.matchAll({ type: "window", includeUncontrolled: true })
    const open = tabs.find((tab) => tab.url.startsWith(self.registration.scope))
    if (open) {
      if (new URL(target).hash) open.postMessage({ open: new URL(target).hash.slice(1) })
      return open.focus()
    }
    return self.clients.openWindow(target)
  })())
})
