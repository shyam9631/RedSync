import { Link } from 'react-router-dom'

const criteria = [
  'Age between 18–65 years',
  'Weight above 50 kg',
  'General good health & feeling well',
  'At least 3 months since last donation',
]

export default function EligibilityCheck() {
  return (
    <section className="w-full my-12">
      <div className="bg-surface-container-lowest p-8 sm:p-10 rounded-3xl shadow-lg border border-surface-container-high flex flex-col lg:flex-row items-center justify-between gap-8">
        <div className="flex-1 space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary-fixed text-primary font-label-sm text-label-sm font-semibold">
            <span className="material-symbols-outlined text-sm">health_and_safety</span>
            Eligibility Check
          </div>
          <h2 className="font-headline-lg text-headline-md sm:text-headline-lg text-on-surface tracking-tight">
            Can I Donate Blood?
          </h2>
          <p className="font-body-md text-body-md text-secondary max-w-xl">
            Most healthy adults can safely donate blood and save up to three lives in under 30
            minutes. Check the quick criteria below.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3">
            {criteria.map((c) => (
              <div key={c} className="flex items-center gap-2.5">
                <span className="material-symbols-outlined text-tertiary text-xl font-bold">
                  check_circle
                </span>
                <span className="font-body-md text-sm text-on-surface">{c}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="w-full lg:w-auto shrink-0 flex flex-col sm:flex-row lg:flex-col items-center gap-3">
          <Link
            to="/eligibility"
            className="w-full sm:w-auto min-w-[220px] bg-primary-container text-on-primary hover:bg-primary px-8 py-4 rounded-xl font-headline-sm text-base shadow-lg shadow-primary-container/20 transition-all flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-xl">fact_check</span>
            <span>Check My Eligibility</span>
          </Link>
          <span className="text-xs text-secondary text-center">Quick 1-minute self assessment</span>
        </div>
      </div>
    </section>
  )
}