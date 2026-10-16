import { Link } from 'react-router-dom'

const donorPoints = [
  'Quick sign in with your mobile number and OTP',
  'See urgent blood requests near you',
  'Track your donation history',
]

const hospitalPoints = [
  'Manage your blood stock',
  'Post urgent blood requests',
  'View registered donors in your area',
]

function Check({ color }) {
  return (
    <span
      className={`flex items-center justify-center w-5 h-5 rounded-full bg-surface-container shrink-0 mt-0.5 ${color}`}
    >
      <span className="material-symbols-outlined text-sm font-bold">check</span>
    </span>
  )
}

export default function LoginChooser() {
  return (
    <div className="flex flex-col w-full relative overflow-hidden py-8 sm:py-12 md:py-16">
      {/* Ambient glows */}
      <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[720px] h-[360px] bg-gradient-to-b from-primary-fixed/40 via-surface-container/20 to-transparent blur-3xl pointer-events-none -z-10"></div>
      <div className="absolute top-1/2 -right-40 w-96 h-96 bg-surface-container-high/60 blur-3xl rounded-full pointer-events-none -z-10"></div>
      <div className="absolute bottom-10 -left-36 w-80 h-80 bg-primary-fixed/30 blur-2xl rounded-full pointer-events-none -z-10"></div>

      <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col items-center">
        <div className="w-full mb-6">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-on-surface-variant hover:text-primary transition-colors font-body-md text-body-md group"
          >
            <span className="material-symbols-outlined text-lg transition-transform group-hover:-translate-x-1">
              arrow_back
            </span>
            <span>Back to Home</span>
          </Link>
        </div>

        {/* Header */}
        <div className="text-center max-w-2xl mb-12 sm:mb-16">
          <h1 className="font-headline-xl-mobile sm:font-headline-xl text-headline-xl-mobile sm:text-headline-xl text-on-surface tracking-tight mb-3">
            Welcome to <span className="text-primary tracking-normal">RedSync</span>
          </h1>
          <p className="font-body-lg text-body-lg text-secondary max-w-xl mx-auto">
            Choose how you want to sign in.
          </p>
        </div>

        {/* Role cards */}
        <div className="w-full grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8 items-stretch mb-12">
          {/* Donor */}
          <div className="group relative flex flex-col justify-between bg-surface-container-lowest rounded-2xl p-7 sm:p-9 shadow-sm hover:shadow-xl transition-all duration-300">
            <div className="w-full flex items-center justify-between mb-8">
              <div className="relative flex items-center justify-center w-14 h-14 rounded-full bg-primary-fixed">
                <span
                  className="material-symbols-outlined text-primary text-2xl"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  bloodtype
                </span>
                <span className="absolute -bottom-1 -right-1 flex items-center justify-center w-6 h-6 rounded-full bg-primary text-on-primary shadow-sm">
                  <span
                    className="material-symbols-outlined text-xs"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    favorite
                  </span>
                </span>
              </div>
            </div>

            <div className="flex-1 mb-8">
              <h2 className="font-headline-md text-headline-md text-on-surface mb-2">
                Blood Donor & Volunteer
              </h2>
              <p className="font-body-md text-body-md text-secondary mb-6 leading-relaxed">
                For individual donors and community volunteers looking to donate blood, track
                donation history, and respond to urgent local needs.
              </p>
              <ul className="space-y-3.5">
                {donorPoints.map((p) => (
                  <li key={p} className="flex items-start gap-3">
                    <Check color="text-primary" />
                    <span className="font-body-md text-body-md text-on-surface">{p}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="pt-4 flex flex-col gap-2">
              <Link
                to="/login/donor"
                className="w-full inline-flex items-center justify-center gap-2 py-3.5 px-6 rounded-full bg-primary-container hover:bg-primary text-on-primary font-title-md text-title-md transition-all shadow-md hover:shadow-lg active:scale-[0.99]"
              >
                <span>Continue as Donor</span>
                <span className="material-symbols-outlined text-lg">arrow_forward</span>
              </Link>
              <p className="text-center font-body-sm text-body-sm text-secondary mt-1">
                Takes less than 30 seconds to sign in
              </p>
            </div>
          </div>

          {/* Hospital */}
          <div className="group relative flex flex-col justify-between bg-surface-container-lowest rounded-2xl p-7 sm:p-9 shadow-sm hover:shadow-xl transition-all duration-300">
            <div className="w-full flex items-center justify-between mb-8">
              <div className="relative flex items-center justify-center w-14 h-14 rounded-full bg-surface-container-high">
                <span
                  className="material-symbols-outlined text-on-surface text-2xl"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  local_hospital
                </span>
                <span className="absolute -bottom-1 -right-1 flex items-center justify-center w-6 h-6 rounded-full bg-inverse-surface text-inverse-on-surface shadow-sm">
                  <span className="material-symbols-outlined text-xs">shield</span>
                </span>
              </div>
            </div>

            <div className="flex-1 mb-8">
              <h2 className="font-headline-md text-headline-md text-on-surface mb-2">
                Hospital & Blood Bank
              </h2>
              <p className="font-body-md text-body-md text-secondary mb-6 leading-relaxed">
                For authorized hospitals, trauma centers, and licensed blood storage banks
                managing real-time stock inventory and emergency requisitions.
              </p>
              <ul className="space-y-3.5">
                {hospitalPoints.map((p) => (
                  <li key={p} className="flex items-start gap-3">
                    <Check color="text-on-surface" />
                    <span className="font-body-md text-body-md text-on-surface">{p}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="pt-4 flex flex-col gap-2">
              <Link
                to="/login/hospital"
                className="w-full inline-flex items-center justify-center gap-2 py-3.5 px-6 rounded-full bg-inverse-surface hover:bg-on-surface text-inverse-on-surface font-title-md text-title-md transition-all shadow-md hover:shadow-lg active:scale-[0.99]"
              >
                <span className="material-symbols-outlined text-lg">domain</span>
                <span>Continue as Hospital Staff</span>
                <span className="material-symbols-outlined text-lg">arrow_forward</span>
              </Link>
              <div className="flex items-center justify-center gap-1.5 mt-1">
                <span className="material-symbols-outlined text-xs text-secondary">verified_user</span>
                <p className="font-body-sm text-body-sm text-secondary">
                  For registered hospitals and blood banks
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Emergency strip */}
        <div className="w-full bg-surface-container-lowest rounded-2xl p-6 sm:p-8 shadow-sm mb-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4 text-left w-full md:w-auto">
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-error-container text-error shrink-0">
              <span className="material-symbols-outlined text-2xl animate-pulse">crisis_alert</span>
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-title-md text-title-md text-on-surface">
                  Need emergency blood right now?
                </span>
                <span className="font-label-sm text-label-sm bg-error text-on-error px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                  SOS Instant
                </span>
              </div>
              <p className="font-body-md text-body-md text-secondary">
                Skip account creation to send an urgent request to hospitals and nearby donors.
              </p>
            </div>
          </div>
          <Link
            to="/request-blood"
            className="w-full md:w-auto shrink-0 inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-surface-container text-primary hover:bg-primary hover:text-on-primary font-label-md text-label-md transition-all"
          >
            <span>Request Blood Instantly without logging in</span>
            <span className="material-symbols-outlined text-base">arrow_forward</span>
          </Link>
        </div>

        <p className="font-body-sm text-body-sm text-secondary pb-6">
          New hospital or blood storage center?
          <Link
            to="/register/hospital"
            className="font-label-md text-label-md text-primary hover:underline ml-1"
          >
            Register your facility
          </Link>
        </p>
      </div>
    </div>
  )
}