import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api, { errorMessage } from '../../lib/api'
import { useAuth } from '../../context/AuthContext'
import { formatDate } from '../../data/donorDemo'

const SHOWN = 3 // how many camps the landing page shows

function formatTime(hhmm) {
  if (!hhmm) return ''
  const [h, m] = hhmm.split(':').map(Number)
  const d = new Date()
  d.setHours(h, m, 0, 0)
  return d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })
}

// "Today", "Tomorrow", "In 5 days", or the date once it is more than a week away
function whenLabel(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const days = Math.round((new Date(y, m - 1, d) - today) / 86400000)
  if (days <= 0) return 'Today'
  if (days === 1) return 'Tomorrow'
  if (days <= 7) return `In ${days} days`
  return formatDate(dateStr)
}

export default function DonationCamps() {
  const { user } = useAuth()
  const isDonor = user?.role === 'donor'
  const isHospital = user?.role === 'hospital'

  const [camps, setCamps] = useState(null) // null while loading
  const [failed, setFailed] = useState(false)
  const [registered, setRegistered] = useState([]) // camp ids the logged-in donor joined
  const [busyId, setBusyId] = useState(null)
  const [message, setMessage] = useState('')

  useEffect(() => {
    let alive = true
    api
      .get('/public/camps')
      .then((res) => alive && setCamps(res.data))
      .catch(() => alive && setFailed(true))
    return () => {
      alive = false
    }
  }, [])

  // A logged-in donor also needs to know which camps they already joined
  useEffect(() => {
    if (!isDonor) return
    let alive = true
    api
      .get('/donor/camps')
      .then((res) => alive && setRegistered(res.data.filter((c) => c.is_registered).map((c) => c.id)))
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [isDonor])

  const toggle = async (c) => {
    const joined = registered.includes(c.id)
    setBusyId(c.id)
    setMessage('')
    try {
      if (joined) await api.delete(`/donor/camps/${c.id}/register`)
      else await api.post(`/donor/camps/${c.id}/register`)
      setRegistered((r) => (joined ? r.filter((x) => x !== c.id) : [...r, c.id]))
      // keep the "slots left" number honest
      setCamps((list) =>
        list.map((x) => (x.id === c.id ? { ...x, registered: x.registered + (joined ? -1 : 1) } : x))
      )
    } catch (err) {
      setMessage(errorMessage(err))
    } finally {
      setBusyId(null)
    }
  }

  const shown = camps ? camps.slice(0, SHOWN) : []

  return (
    <section className="w-full py-16">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10">
        <div>
          <span className="text-primary font-label-sm text-label-sm tracking-widest uppercase font-bold">
            Community Drives
          </span>
          <h2 className="font-headline-lg text-headline-lg-mobile sm:text-headline-lg text-on-surface mt-1 tracking-tight">
            Upcoming Donation Camps
          </h2>
          <p className="font-body-md text-body-md text-secondary mt-1">
            Join scheduled blood drives organised by partner hospitals.
          </p>
        </div>
        {camps && camps.length > SHOWN && (
          <Link
            to="/camps"
            className="inline-flex items-center gap-1 text-primary hover:underline font-label-md text-label-md font-semibold self-start sm:self-auto"
          >
            View all {camps.length} camps{' '}
            <span className="material-symbols-outlined text-base">arrow_forward</span>
          </Link>
        )}
      </div>

      {message && (
        <div
          role="alert"
          className="mb-6 flex items-start gap-2.5 rounded-xl bg-error-container px-4 py-3 text-on-error-container"
        >
          <span className="material-symbols-outlined text-[20px] shrink-0">error</span>
          <p className="font-body-sm text-body-sm">{message}</p>
        </div>
      )}

      {failed ? (
        <div className="p-8 text-center bg-surface-container-lowest rounded-2xl border border-surface-container">
          <span className="material-symbols-outlined text-secondary text-[32px]">cloud_off</span>
          <p className="font-body-md text-body-md text-secondary mt-2">
            Could not load donation camps right now. Please try again in a moment.
          </p>
        </div>
      ) : camps === null ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6" aria-busy="true">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-56 rounded-2xl bg-surface-container-lowest animate-pulse"></div>
          ))}
        </div>
      ) : shown.length === 0 ? (
        <div className="p-8 text-center bg-surface-container-lowest rounded-2xl border border-surface-container">
          <span className="material-symbols-outlined text-secondary text-[32px]">event</span>
          <h3 className="font-headline-sm text-headline-sm text-on-surface mt-2">
            No camps scheduled yet
          </h3>
          <p className="font-body-md text-body-md text-secondary mt-1">
            Hospitals can create donation camps from their dashboard, and they will show up here.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {shown.map((c, i) => {
            const joined = registered.includes(c.id)
            const slotsLeft = Math.max(0, c.target_units - c.registered)
            return (
              <div
                key={c.id}
                className="bg-surface-container-lowest p-6 rounded-2xl shadow-md border border-surface-container hover:shadow-xl transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
                        i === 0 ? 'bg-primary-fixed text-primary' : 'bg-surface-container text-on-surface'
                      }`}
                    >
                      <span className="material-symbols-outlined text-sm">calendar_month</span>
                      {whenLabel(c.camp_date)}
                    </span>
                    <span className="text-xs font-semibold text-tertiary">
                      {slotsLeft > 0 ? `${slotsLeft} slots left` : 'Fully booked'}
                    </span>
                  </div>
                  <h3 className="font-title-md text-base text-on-surface font-semibold mb-2">{c.title}</h3>
                  <div className="space-y-2 text-xs text-secondary font-body-sm">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-base">schedule</span>
                      <span>
                        {formatDate(c.camp_date)}, {formatTime(c.start_time)} – {formatTime(c.end_time)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-base">location_on</span>
                      <span>
                        {c.venue}, {c.city}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-base">corporate_fare</span>
                      <span>Organizer: {c.hospital_name}</span>
                    </div>
                  </div>
                </div>
                <div className="pt-6 mt-6 border-t border-surface-container-high flex items-center justify-between gap-3">
                  <span className="text-xs text-secondary">
                    {c.registered} donor{c.registered === 1 ? '' : 's'} registered
                  </span>
                  {isHospital ? null : isDonor ? (
                    <button
                      type="button"
                      disabled={busyId === c.id || (!joined && slotsLeft === 0)}
                      onClick={() => toggle(c)}
                      className={`px-4 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                        joined
                          ? 'bg-tertiary-fixed text-on-tertiary-fixed hover:opacity-90'
                          : 'bg-primary-container text-on-primary hover:bg-primary'
                      }`}
                    >
                      {busyId === c.id ? 'Please wait…' : joined ? 'Registered ✓' : 'Register'}
                    </button>
                  ) : (
                    <Link
                      to="/register/donor"
                      className="bg-primary-container text-on-primary hover:bg-primary px-4 py-2 rounded-xl text-xs font-semibold transition-colors"
                    >
                      Register
                    </Link>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}