import { Outlet, Link } from 'react-router-dom'

export default function AuthLayout() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="w-full max-w-7xl mx-auto px-margin pt-space-lg flex items-center justify-between">
        <Link to="/" className="flex items-center gap-space-sm">
          <span
            className="material-symbols-outlined text-primary-container text-3xl"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            water_drop
          </span>
          <span className="font-headline-sm text-headline-sm text-primary tracking-tight">
            RedSync
          </span>
        </Link>
        <Link
          to="/"
          className="inline-flex items-center gap-2 font-label-md text-label-md text-secondary hover:text-primary transition-colors"
        >
          <span className="material-symbols-outlined text-base">arrow_back</span>
          Back to Home
        </Link>
      </div>

      <main className="flex-1 flex items-center justify-center px-margin py-space-xl">
        <Outlet />
      </main>

      <p className="text-center font-body-sm text-body-sm text-secondary pb-space-lg">
        © 2026 RedSync. All rights reserved.
      </p>
    </div>
  )
}