import { useSyncExternalStore } from 'react'

const query = '(min-width: 1024px)'
const subscribe = (onChange) => {
  const media = window.matchMedia(query)
  media.addEventListener('change', onChange)
  return () => media.removeEventListener('change', onChange)
}
export default function useDesktop() {
  return useSyncExternalStore(subscribe, () => window.matchMedia(query).matches, () => true)
}
