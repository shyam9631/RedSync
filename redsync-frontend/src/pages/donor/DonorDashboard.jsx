import { useAuth } from '../../context/AuthContext'

export default function DonorDashboard() {
  const { user } = useAuth()
  return (
    <section className="py-16">
      <h1 className="font-headline-lg text-headline-lg text-on-surface tracking-tight">
        Welcome, <span className="text-primary-container">{user?.name}</span>
      </h1>
      <p className="font-body-lg text-body-lg text-secondary mt-3 max-w-2xl">
        You are signed in as a donor. The full dashboard (urgent requests, donation
        history, eligibility) comes in a later step.
      </p>
    </section>
  )
}