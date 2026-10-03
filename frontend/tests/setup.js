import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'
afterEach(cleanup)

// jsdom no implementa matchMedia y varios componentes lo usan (useIsMobile).
// El ancho se controla con innerWidth; cada prueba puede reemplazarlo.
if (typeof window !== 'undefined' && !window.matchMedia) {
  window.matchMedia = (media) => ({
    matches: false,
    media,
    onchange: null,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent: () => false,
  })
}
