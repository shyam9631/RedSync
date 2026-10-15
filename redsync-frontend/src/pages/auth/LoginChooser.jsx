import { Link } from 'react-router-dom'

const roles = [
  {
    to: '/login/donor',
    icon: 'volunteer_activism',
    title: "I'm a Donor",
    text: 'Sign in with your mobile number to see urgent requests near you and manage your donations.',
    cta: 'Continue as Donor',
  },
  {
    to: '/login/hospital',
    icon: 'local_hospital',
    title: "I'm a Hospital / Blood Bank",
    text: 'Manage your blood stock, post urgent needs and view registered donors.',
    cta: 'Continue as Hospital',
  },
]

export default function LoginChooser() {
  return (
    <div className="w-full max-w-3xl">
      <div className="text-center mb-space-xl">
        <h1 className="font-headline-lg text-headline-lg text-on-surface tracking-tight">
          Welcome to RedSync
        </h1>
        <p className="font-body-lg text-body-lg text-secondary mt-2">
          Choose how you want to sign in.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-space-lg">
        {roles.map((r) => (
          <Link
            key={r.to}
            to={r.to}
            className="group bg-surface-container-lowest p-space-xl rounded-xl shadow-md hover:shadow-xl hover:-translate-y-1 transition-all flex flex-col justify-between"
          >
            <div>
              <div className="w-14 h-14 rounded-2xl bg-primary-fixed flex items-center justify-center text-primary mb-space-md">
                <span
                  className="material-symbols-outlined text-3xl"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  {r.icon}
                </span>
              </div>
              <h2 className="font-headline-md text-headline-md text-on-surface">{r.title}</h2>
              <p className="font-body-md text-body-md text-secondary mt-2">{r.text}</p>
            </div>
            <span className="mt-space-lg inline-flex items-center gap-1 font-label-md text-label-md text-primary font-bold">
              {r.cta}
              <span className="material-symbols-outlined text-base group-hover:translate-x-1 transition-transform">
                arrow_forward
              </span>
            </span>
          </Link>
        ))}
      </div>

      <p className="text-center font-body-md text-body-md text-secondary mt-space-xl">
        New here?{' '}
        <Link to="/register/donor" className="text-primary font-bold hover:underline">
          Register as a Donor
        </Link>
        <span className="mx-2 text-outline">•</span>
        <Link to="/register/hospital" className="text-secondary hover:text-on-surface hover:underline">
          Register your hospital
        </Link>
      </p>
    </div>
  )
}