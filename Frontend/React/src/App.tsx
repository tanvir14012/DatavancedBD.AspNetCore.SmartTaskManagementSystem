import { useSyncTheme } from './hooks/use-sync-theme'
import { useThemeStore } from './store/use-theme-store'

function App() {
  useSyncTheme()

  const mode = useThemeStore((state) => state.mode)
  const setMode = useThemeStore((state) => state.setMode)

  return (
    <main className="min-h-screen bg-background p-8 text-foreground">
      <section className="rounded-lg border border-border bg-card p-6 text-card-foreground">
        <h1 className="text-3xl font-bold">Smart Task Management System</h1>
        <p className="mt-4 text-muted-foreground">Theme mode: {mode}</p>

        <div className="mt-6 flex gap-2">
          <button
            className="rounded-md border border-border px-4 py-2"
            onClick={() => setMode('light')}
          >
            Light
          </button>

          <button
            className="rounded-md border border-border px-4 py-2"
            onClick={() => setMode('dark')}
          >
            Dark
          </button>

          <button
            className="rounded-md border border-border px-4 py-2"
            onClick={() => setMode('system')}
          >
            System
          </button>
        </div>
      </section>
    </main>
  )
}

export default App
