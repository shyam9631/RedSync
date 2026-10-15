import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

const bloodGroups = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-']

export default function Hero() {
  const [group, setGroup] = useState('ALL')
  const [location, setLocation] = useState('')
  const navigate = useNavigate()

  const handleSearch = (e) => {
    e.preventDefault()
    const params = new URLSearchParams()
    if (group !== 'ALL') params.set('group', group)
    if (location.trim()) params.set('location', location.trim())
    navigate(`/find-blood?${params.toString()}`)
  }

  return (
    <section className="relative w-full py-20 overflow-hidden bg-gradient-to-b from-[#FFF8F8] to-background">
      {/* Background glow */}
      <div className="absolute top-0 right-1/4 w-96 h-96 rounded-full bg-primary-fixed/30 blur-3xl pointer-events-none -z-10"></div>
      <div className="absolute -bottom-10 left-10 w-80 h-80 rounded-full bg-surface-container-high/40 blur-2xl pointer-events-none -z-10"></div>

      <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
        {/* Left column */}
        <div className="lg:col-span-7 flex flex-col space-y-6">
          <div className="inline-flex items-center gap-2 self-start px-3.5 py-1.5 rounded-full bg-surface-container-lowest shadow-sm">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary"></span>
            </span>
            <span className="font-label-md text-label-md text-on-surface">
              Live blood availability across your city
            </span>
          </div>

          <h1 className="font-headline-xl text-headline-xl-mobile sm:text-headline-xl tracking-tight text-on-surface">
            Find blood. <span className="text-primary-container">Save lives.</span> In real time.
          </h1>

          <p className="font-body-lg text-body-lg text-secondary max-w-2xl">
            Connecting patients, registered donors, and local blood banks with real-time
            stock availability, instant compatibility matching, and urgent dispatch support.
          </p>

          {/* Search card */}
          <form
            onSubmit={handleSearch}
            className="mt-4 p-5 bg-surface-container-lowest rounded-2xl shadow-xl space-y-4"
          >
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
              <div className="md:col-span-4 flex items-center gap-2 bg-surface-container-low px-3.5 py-2.5 rounded-xl">
                <span
                  className="material-symbols-outlined text-primary text-xl"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  bloodtype
                </span>
                <div className="flex-1">
                  <label className="block font-label-sm text-label-sm text-secondary" htmlFor="blood-select">
                    Group
                  </label>
                  <select
                    id="blood-select"
                    value={group}
                    onChange={(e) => setGroup(e.target.value)}
                    className="w-full bg-transparent font-title-md text-sm text-on-surface focus:outline-none cursor-pointer"
                  >
                    <option value="ALL">All Groups</option>
                    {bloodGroups.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="md:col-span-5 flex items-center gap-2 bg-surface-container-low px-3.5 py-2.5 rounded-xl">
                <span className="material-symbols-outlined text-secondary text-xl">location_on</span>
                <div className="flex-1">
                  <label className="block font-label-sm text-label-sm text-secondary" htmlFor="location-input">
                    Location
                  </label>
                  <input
                    id="location-input"
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="City, hospital, or PIN..."
                    className="w-full bg-transparent font-body-md text-body-md text-on-surface focus:outline-none placeholder:text-secondary-fixed-dim"
                  />
                </div>
              </div>

              <div className="md:col-span-3">
                <button
                  type="submit"
                  className="w-full h-full min-h-[48px] bg-primary-container text-on-primary hover:bg-primary font-label-md text-label-md rounded-xl shadow-md transition-all flex items-center justify-center gap-2 px-4 py-2.5 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-lg">search</span>
                  <span>Search</span>
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1 text-secondary">
              <span className="font-body-sm text-body-sm flex items-center gap-1.5">
                <span className="material-symbols-outlined text-sm text-tertiary">check_circle</span>
                Your contact details stay private
              </span>
              <div className="flex items-center gap-2 font-label-sm text-label-sm">
                <span className="text-outline">Search radius:</span>
                <span className="px-2 py-0.5 rounded bg-surface-container font-semibold text-primary">15 km</span>
              </div>
            </div>
          </form>

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-4 pt-2">
            <Link
              to="/request-blood"
              className="inline-flex items-center gap-2 bg-primary-container text-on-primary hover:bg-primary px-7 py-3.5 rounded-xl font-label-md text-label-md shadow-lg shadow-primary-container/20 transition-all"
            >
              <span className="material-symbols-outlined text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>
                emergency
              </span>
              <span>Request Blood</span>
            </Link>
            <Link
              to="/register/donor"
              className="inline-flex items-center gap-2 bg-surface-container-lowest text-on-surface hover:bg-surface-container-low px-7 py-3.5 rounded-xl font-label-md text-label-md shadow-sm transition-all"
            >
              <span className="material-symbols-outlined text-xl text-primary">volunteer_activism</span>
              <span>Become a Donor</span>
            </Link>
          </div>
        </div>

        {/* Right column: visual */}
        <div className="hidden lg:flex lg:col-span-5 relative items-center justify-center min-h-[460px]">
          <div className="absolute w-80 h-80 rounded-full bg-primary-fixed/20 animate-ping opacity-40"></div>
          <div className="absolute w-96 h-96 rounded-full bg-surface-container-high/60 -z-10"></div>

          <div className="relative w-64 h-80 rounded-full bg-gradient-to-br from-primary-container via-primary to-primary-container p-1 shadow-2xl flex items-center justify-center overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-b from-white/30 via-transparent to-black/20"></div>
            <div className="relative z-10 flex flex-col items-center text-center p-6 text-on-primary">
              <div className="w-16 h-16 rounded-2xl bg-surface-container-lowest/20 backdrop-blur-md flex items-center justify-center mb-3 shadow-inner">
                <span
                  className="material-symbols-outlined text-4xl text-on-primary"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  cardiology
                </span>
              </div>
              <span className="font-headline-sm text-headline-sm tracking-tight text-on-primary">RedSync</span>
              <span className="font-body-sm text-body-sm text-on-primary-container opacity-90 mt-1">
                Live Requests & Support
              </span>
              <svg className="w-48 h-12 mt-4 text-on-primary opacity-80" fill="none" viewBox="0 0 200 40">
                <path
                  d="M0 20 L40 20 L50 5 L60 35 L70 12 L80 26 L90 20 L130 20 L140 8 L150 32 L160 20 L200 20"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2.5"
                />
              </svg>
            </div>
          </div>

          {/* Floating card: donors */}
          <div className="absolute top-2 right-0 bg-surface-container-lowest/90 backdrop-blur-md px-4 py-3 rounded-2xl shadow-xl flex items-center gap-3">
            <div className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-tertiary-container opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-tertiary"></span>
            </div>
            <div>
              <div className="font-headline-sm text-sm text-on-surface">Donors ready nearby</div>
              <div className="font-body-sm text-body-sm text-secondary">On call right now</div>
            </div>
          </div>

          {/* Floating card: urgent need */}
          <div className="absolute bottom-4 left-0 bg-surface-container-lowest/95 backdrop-blur-md p-4 rounded-2xl shadow-xl max-w-xs">
            <div className="flex items-center justify-between mb-2">
              <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-error-container text-on-error-container font-label-sm text-label-sm">
                <span className="material-symbols-outlined text-xs">campaign</span>
                Urgent Need
              </div>
              <span className="font-body-sm text-body-sm text-secondary">2m ago</span>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-primary-container text-on-primary flex items-center justify-center font-badge-blood-group text-badge-blood-group shrink-0">
                O-
              </div>
              <div className="min-w-0">
                <p className="font-title-md text-sm text-on-surface truncate">City Hospital</p>
                <p className="font-body-sm text-body-sm text-secondary">1.8 km away • Emergency Ward</p>
              </div>
            </div>
          </div>

          {/* Floating card: speed */}
          <div className="absolute -bottom-2 right-8 bg-surface-container-lowest/90 backdrop-blur-md px-4 py-2.5 rounded-xl shadow-lg flex items-center gap-2">
            <span
              className="material-symbols-outlined text-primary text-xl"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              bolt
            </span>
            <div>
              <span className="font-body-sm text-body-sm text-secondary block">Avg. Match Speed</span>
              <span className="font-headline-sm text-sm text-on-surface">Minutes, not hours</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}