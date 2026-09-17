import { Component, Suspense } from 'react'
import { useLocation } from 'react-router-dom'
import { Button } from './ui/button'

export function RouteLoading() {
  return <div role="status" className="space-y-4 p-6 text-muted-foreground"><p>Cargando vista…</p><div aria-hidden="true" className="h-8 w-2/3 rounded bg-muted" /><div aria-hidden="true" className="h-40 rounded bg-muted" /></div>
}

class ModuleErrorBoundary extends Component {
  state = { error: null }
  static getDerivedStateFromProps(props, state) {
    return props.resetKey !== state.resetKey ? { resetKey: props.resetKey, error: null } : null
  }
  static getDerivedStateFromError(error) { return { error } }
  render() {
    if (this.state.error) {
      return <section role="alert" className="space-y-4 p-6 text-foreground">
        <h1 className="text-xl font-semibold">No se pudo abrir esta vista</h1>
        <p>Revisa tu conexión y vuelve a cargar. Si estabas capturando datos, comprueba que se hayan guardado.</p>
        <Button type="button" onClick={() => window.location.reload()}>Volver a cargar</Button>
      </section>
    }
    return this.props.children
  }
}

export default function RouteBoundary({ children }) {
  const { pathname } = useLocation()
  return <ModuleErrorBoundary resetKey={pathname}><Suspense fallback={<RouteLoading />}>{children}</Suspense></ModuleErrorBoundary>
}
