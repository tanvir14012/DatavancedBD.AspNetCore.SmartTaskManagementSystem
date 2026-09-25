import type { PropsWithChildren } from 'react'
import { ErrorBoundary } from 'react-error-boundary'

function AppErrorFallback() {
  return (
    <main role="alert">
      <h1>Something went wrong</h1>
      <p>Please refresh the page and try again</p>
    </main>
  )
}

export function AppErrorBoundary({ children }: PropsWithChildren) {
  return <ErrorBoundary FallbackComponent={AppErrorFallback}>{children}</ErrorBoundary>
}
