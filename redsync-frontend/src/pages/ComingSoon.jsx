import { Link, useLocation } from 'react-router-dom'

export default function ComingSoon() {
  const { pathname } = useLocation()
  return (
    <section className="py-24 text-center">
      <span className="material-symbols-outlined text-primary-container text-6xl">construction</span>
      <h1 className="font-headline-lg text-headline-lg text-on-surface mt-4">Coming soon</h1>
      <p className="font-body-lg text-body-lg text-secondary mt-2">
        The page <code className="font-semibold">{pathname}</code> is not built yet.
      </p>
      <Link
        to="/"
        className="inline-block mt-6 bg-primary-container text-on-primary hover:bg-primary px-6 py-3 rounded-xl font-label-md text-label-md"
      >
        Back to Home
      </Link>
    </section>
  )
}