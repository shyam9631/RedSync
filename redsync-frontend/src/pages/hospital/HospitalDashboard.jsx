import { useAuth } from '../../context/AuthContext'

export default function HospitalDashboard() {
  const { user } = useAuth()
  return (
    <section className="py-16">
      <h1 className="font-headline-lg text-headline-lg text-on-surface tracking-tight">
        Hospital Dashboard
      </h1>
      <p className="font-body-lg text-body-lg text-secondary mt-3 max-w-2xl">
        Signed in as {user?.email}. Blood stock and the registered donor list (with the
        online/active toggle) will be added here later.
      </p>
    </section>
  )
}