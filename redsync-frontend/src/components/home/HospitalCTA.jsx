import { Link } from 'react-router-dom'

export default function HospitalCTA() {
  return (
    <section className="w-full my-12">
      <div className="bg-surface-container p-8 sm:p-12 rounded-3xl border border-surface-container-highest flex flex-col lg:flex-row items-center justify-between gap-8">
        <div className="space-y-3 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-surface-container-lowest text-primary font-label-sm text-label-sm font-semibold shadow-sm">
            <span className="material-symbols-outlined text-sm">local_hospital</span>
            For Healthcare Facilities
          </div>
          <h2 className="font-headline-lg text-headline-md sm:text-headline-lg text-on-surface tracking-tight">
            Are you a hospital or blood bank?
          </h2>
          <p className="font-body-lg text-body-lg text-secondary">
            Manage your blood stock and find donors faster. Keep your stock visible to patients and
            send urgent requests to nearby donors.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto shrink-0">
          <Link
            to="/register/hospital"
            className="w-full sm:w-auto bg-primary-container text-on-primary hover:bg-primary px-7 py-3.5 rounded-xl font-label-md text-label-md shadow-md transition-all flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-lg">domain_add</span>
            <span>Register Your Hospital</span>
          </Link>
          <Link
            to="/login/hospital"
            className="w-full sm:w-auto bg-surface-container-lowest text-on-surface hover:bg-surface-container-high px-7 py-3.5 rounded-xl font-label-md text-label-md border border-outline-variant transition-all flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-lg">login</span>
            <span>Hospital Login</span>
          </Link>
        </div>
      </div>
    </section>
  )
}