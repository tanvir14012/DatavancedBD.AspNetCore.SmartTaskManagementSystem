import { Link, useLocation } from 'react-router'

export function ComingSoonPage() {
  const location = useLocation()

  return (
    <section className="rounded-lg border border-border bg-card p-8">
      <h1 className="text-2xl font-bold">Coming Soon</h1>

      <p className="mt-3 text-muted-foreground">
        This feature is planned and will be available soon.
      </p>

      <p className="mt-2 text-sm text-muted-foreground">Route: {location.pathname}</p>

      <Link
        to="/dashboard"
        className="mt-6 inline-flex rounded-md bg-primary px-4 py-2 text-primary-foreground"
      >
        Back to Dashboard
      </Link>
    </section>
  )
}
