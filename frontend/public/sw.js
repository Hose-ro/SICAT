const SHELL_CACHE = "sicat-shell-v3"
const RUNTIME_CACHE = "sicat-runtime-v3"

const APP_SHELL = [
  "/",
  "/index.html",
  "/manifest.webmanifest",
  "/app-icon.svg?v=20260319b",
  "/apple-touch-icon.png?v=20260319b",
  "/pwa-192.png?v=20260319b",
  "/pwa-512.png?v=20260319b",
]

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(APP_SHELL)),
  )

  self.skipWaiting()
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== SHELL_CACHE && key !== RUNTIME_CACHE)
          .map((key) => caches.delete(key)),
      ),
    ),
  )

  self.clients.claim()
})

self.addEventListener("fetch", (event) => {
  const { request } = event

  if (request.method !== "GET") {
    return
  }

  const url = new URL(request.url)

  if (url.origin !== self.location.origin) {
    return
  }

  if (url.pathname.startsWith("/api/")) {
    return
  }

  if (request.mode === "navigate") {
    event.respondWith(handleNavigation(request))
    return
  }

  if (isStaticAsset(request, url)) {
    event.respondWith(cacheFirst(request))
  }
})

async function handleNavigation(request) {
  try {
    const response = await fetch(request)
    const cache = await caches.open(SHELL_CACHE)
    cache.put("/index.html", response.clone())
    return response
  } catch {
    const cachedPage = await caches.match("/index.html")
    return cachedPage || Response.error()
  }
}

async function cacheFirst(request) {
  const cachedResponse = await caches.match(request)

  if (cachedResponse) {
    return cachedResponse
  }

  const response = await fetch(request)

  if (response.ok) {
    const cache = await caches.open(RUNTIME_CACHE)
    cache.put(request, response.clone())
  }

  return response
}

function isStaticAsset(request, url) {
  if (url.pathname.startsWith("/assets/")) {
    return true
  }

  return ["style", "script", "image", "font", "manifest"].includes(request.destination)
}
