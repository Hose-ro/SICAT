export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    return
  }

  if (import.meta.env.DEV) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .getRegistrations()
        .then((registrations) =>
          Promise.all(
            registrations.map((registration) => registration.unregister()),
          ),
        )
        .catch((error) => {
          console.error('No se pudo desregistrar el service worker', error)
        })

      if ('caches' in window) {
        caches
          .keys()
          .then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
          .catch((error) => {
            console.error('No se pudo limpiar la caché local', error)
          })
      }
    })
    return
  }

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((error) => {
      console.error('No se pudo registrar el service worker', error)
    })
  })
}
