import { useCallback, useEffect, useState } from 'react'
import api, { errorMessage } from '../../lib/api'
import Modal from '../../components/ui/Modal'
import { CreateCampModal } from './HospitalModals'
import { parseLocal } from '../../data/hospitalDemo'

const REFRESH_MS = 60000

const PHASE = {
  live: { label: 'Live now', pill: 'bg-tertiary text-on-tertiary' },
  today: { label: 'Today', pill: 'bg-amber-100 text-amber-900' },
  upcoming: { label: 'Upcoming', pill: 'bg-primary-fixed text-on-primary-fixed' },
  completed: { label: 'Completed', pill: 'bg-surface-container-high text-on-surface-variant' },
  cancelled: { label: 'Cancelled', pill: 'bg-error-container text-on-error-container' },
}

const TABS = [
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'completed', label: 'Completed' },
  { id: 'cancelled', label: 'Cancelled' },
]

const fmtDate = (iso) =>
  parseLocal(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })

function fmtTime(hhmm) {
  if (!hhmm) return ''
  const [h, m] = hhmm.split(':').map(Number)
  const d = new Date()
  d.setHours(h, m, 0, 0)
  return d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })
}

function whenLabel(c) {
  if (c.phase === 'live') return 'Happening now'
  if (c.phase === 'today') return 'Today'
  if (c.phase !== 'upcoming') return fmtDate(c.camp_date)
  if (c.days_until === 1) return 'Tomorrow'
  return `In ${c.days_until} days`
}

const csvCell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
function downloadCsv(name, header, rows) {
  const text = [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\n')
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

function Bar({ percent, tone = 'bg-tertiary' }) {
  return (
    <div className="w-full h-2.5 rounded-full bg-surface-container-highest overflow-hidden">
      <div className={`h-full rounded-full transition-all duration-500 ${tone}`} style={{ width: `${percent}%` }} />
    </div>
  )
}

function PhasePill({ phase }) {
  const p = PHASE[phase]
  return (
    <span className={`px-2 py-0.5 rounded font-label-sm text-label-sm font-bold uppercase tracking-wide ${p.pill}`}>
      {phase === 'live' && '● '}
      {p.label}
    </span>
  )
}

function Kpi({ label, value, sub, icon, tone }) {
  return (
    <div className="p-space-lg rounded-xl bg-surface-container-lowest shadow-sm flex flex-col justify-between gap-space-sm">
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-1">
          <span className="font-label-sm text-label-sm text-secondary uppercase font-semibold tracking-wider">{label}</span>
          <span className="font-headline-md text-headline-md font-bold text-on-surface">{value}</span>
        </div>
        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${tone}`}>
          <span className="material-symbols-outlined text-[22px]">{icon}</span>
        </div>
      </div>
      <p className="font-body-sm text-body-sm text-secondary">{sub}</p>
    </div>
  )
}

/* ---------- Cancel dialog ---------- */
function CancelModal({ camp, onConfirm, onClose }) {
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      await onConfirm(reason.trim())
    } catch (err) {
      setError(errorMessage(err))
      setSaving(false)
    }
  }

  return (
    <Modal
      title="Cancel this camp?"
      subtitle={camp.title}
      leading={
        <div className="w-10 h-10 rounded-full bg-error-container text-error flex items-center justify-center shrink-0">
          <span className="material-symbols-outlined text-[20px]">event_busy</span>
        </div>
      }
      onClose={onClose}
    >
      <form onSubmit={submit} className="space-y-5">
        <p className="font-body-md text-body-md text-on-surface-variant">
          {camp.registered > 0
            ? `${camp.registered} registered donor${camp.registered === 1 ? '' : 's'} will get a notification. `
            : 'No donors have registered yet. '}
          This cannot be undone.
        </p>
        <div>
          <label htmlFor="cancel-reason" className="font-label-md text-label-md text-on-surface block mb-1.5">
            Reason <span className="text-secondary font-normal">(optional, shown to donors)</span>
          </label>
          <input
            id="cancel-reason"
            type="text"
            maxLength={150}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Venue not available on that day"
            className="w-full h-12 px-4 bg-surface-container-low rounded-xl font-body-md text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-container"
          />
        </div>
        {error && (
          <div role="alert" className="flex items-start gap-2.5 rounded-xl bg-error-container px-4 py-3 text-on-error-container">
            <span className="material-symbols-outlined text-[20px] shrink-0">error</span>
            <p className="font-body-sm text-body-sm">{error}</p>
          </div>
        )}
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-full bg-surface-container hover:bg-surface-container-high text-on-surface font-label-md text-label-md cursor-pointer"
          >
            Keep camp
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 rounded-full bg-error text-on-error font-label-md text-label-md shadow-sm cursor-pointer disabled:opacity-60"
          >
            {saving ? 'Cancelling…' : 'Cancel camp'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

/* ---------- Camp details: donors and attendance ---------- */
function CampModal({ campId, onClose, onEdit, onCancel, onChanged }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(null)
  const [actionError, setActionError] = useState('')
  const [confirm, setConfirm] = useState(null)

  const load = useCallback(async () => {
    try {
      const res = await api.get(`/hospital/camps/${campId}`)
      setData(res.data)
      setError('')
    } catch (err) {
      setError(errorMessage(err))
    }
  }, [campId])

  useEffect(() => {
    load()
  }, [load])

  const mark = async (donor, status) => {
    setBusy(donor.donor_id)
    setActionError('')
    setConfirm(null)
    try {
      await api.post(`/hospital/camps/${campId}/attendance`, { donor_id: donor.donor_id, status })
      await load()
      onChanged()
    } catch (err) {
      setActionError(errorMessage(err))
    } finally {
      setBusy(null)
    }
  }

  const camp = data?.camp
  const canChange = camp && (camp.phase === 'upcoming' || camp.phase === 'today' || camp.phase === 'live')

  const exportCsv = () =>
    downloadCsv(
      `camp-${campId}-donors.csv`,
      ['Donor ID', 'Name', 'Blood group', 'Area', 'City', 'Registered', 'Result'],
      data.donors.map((d) => [d.code, d.name, d.blood_group, d.area, d.city, d.registered_at, d.attendance || ''])
    )

  return (
    <Modal
      title={camp ? camp.title : 'Camp details'}
      subtitle={camp ? `${fmtDate(camp.camp_date)} • ${fmtTime(camp.start_time)} – ${fmtTime(camp.end_time)}` : ''}
      leading={
        <div className="w-10 h-10 rounded-full bg-primary-container text-on-primary flex items-center justify-center shrink-0">
          <span className="material-symbols-outlined text-[20px]">event</span>
        </div>
      }
      onClose={onClose}
    >
      {error && (
        <p role="alert" className="font-body-md text-body-md text-error">
          {error}
        </p>
      )}
      {!data && !error && (
        <p className="py-10 text-center text-secondary font-body-md text-body-md">Loading camp…</p>
      )}
      {data && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-2">
            <PhasePill phase={camp.phase} />
            <span className="inline-flex items-center gap-1 font-body-sm text-body-sm text-secondary">
              <span className="material-symbols-outlined text-[16px] text-primary">pin_drop</span>
              {camp.venue}, {camp.city}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              ['Registered', camp.registered],
              ['Donated', camp.donated],
              ['Deferred', camp.deferred],
              ['Target', camp.target_units],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl bg-surface-container-low p-3 text-center">
                <div className="font-headline-sm text-headline-sm font-bold text-on-surface">{value}</div>
                <div className="font-label-sm text-label-sm text-secondary uppercase tracking-wider">{label}</div>
              </div>
            ))}
          </div>

          {Object.keys(data.groups).length > 0 && (
            <div className="flex flex-wrap gap-2">
              {Object.entries(data.groups)
                .sort()
                .map(([g, n]) => (
                  <span
                    key={g}
                    className="inline-flex items-center gap-1.5 pl-1 pr-2.5 py-1 rounded-full bg-surface-container-low font-label-sm text-label-sm text-on-surface"
                  >
                    <span className="w-6 h-6 rounded-full bg-primary-fixed text-primary font-bold flex items-center justify-center text-[11px]">
                      {g}
                    </span>
                    {n}
                  </span>
                ))}
            </div>
          )}

          {actionError && (
            <div role="alert" className="flex items-start gap-2.5 rounded-xl bg-error-container px-4 py-3 text-on-error-container">
              <span className="material-symbols-outlined text-[20px] shrink-0">error</span>
              <p className="font-body-sm text-body-sm">{actionError}</p>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-title-md text-title-md font-bold text-on-surface">Registered donors</h4>
              {data.donors.length > 0 && (
                <button
                  type="button"
                  onClick={exportCsv}
                  className="inline-flex items-center gap-1 font-label-sm text-label-sm text-primary font-semibold hover:underline cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px]">download</span>
                  CSV
                </button>
              )}
            </div>
            {!data.can_mark_attendance && camp.phase !== 'cancelled' && data.donors.length > 0 && (
              <p className="font-body-sm text-body-sm text-secondary mb-2">
                You can mark who donated once the camp day starts.
              </p>
            )}

            {data.donors.length === 0 ? (
              <p className="rounded-xl bg-surface-container-low px-4 py-6 text-center font-body-md text-body-md text-secondary">
                No donors have registered yet.
              </p>
            ) : (
              <ul className="divide-y divide-surface-container rounded-xl bg-surface-container-low overflow-hidden">
                {data.donors.map((d) => (
                  <li key={d.donor_id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                    <span className="w-9 h-9 rounded-full bg-primary-fixed text-primary font-bold flex items-center justify-center text-[13px] shrink-0">
                      {d.blood_group}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-label-md text-label-md font-semibold text-on-surface truncate">{d.name}</p>
                      <p className="font-body-sm text-body-sm text-secondary truncate">
                        {d.code} • {d.area}, {d.city}
                      </p>
                      {!d.attendance && !d.eligible_on_camp_day && d.next_eligible && (
                        <p className="font-body-sm text-body-sm text-amber-800">
                          Not due to donate until {fmtDate(d.next_eligible)}
                        </p>
                      )}
                    </div>
                    {d.attendance === 'donated' && (
                      <span className="px-2.5 py-1 rounded-full bg-tertiary-container/15 text-tertiary font-label-sm text-label-sm font-bold">
                        Donated
                      </span>
                    )}
                    {d.attendance === 'deferred' && (
                      <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-900 font-label-sm text-label-sm font-bold">
                        Deferred
                      </span>
                    )}
                    {!d.attendance && data.can_mark_attendance && (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={busy === d.donor_id}
                          onClick={() => setConfirm(d)}
                          className="px-3 py-1.5 rounded-full bg-primary-container hover:bg-primary text-on-primary font-label-sm text-label-sm font-semibold cursor-pointer disabled:opacity-60"
                        >
                          Donated
                        </button>
                        <button
                          type="button"
                          disabled={busy === d.donor_id}
                          onClick={() => mark(d, 'deferred')}
                          className="px-3 py-1.5 rounded-full bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-label-sm text-label-sm font-semibold cursor-pointer disabled:opacity-60"
                        >
                          Deferred
                        </button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {confirm && (
            <div role="alertdialog" className="rounded-xl bg-primary-fixed/50 p-4 space-y-3">
              <p className="font-body-md text-body-md text-on-surface">
                Record <strong>{confirm.name}</strong>'s donation? This adds 1 unit of {confirm.blood_group} whole blood
                to your stock and counts towards their next eligible date. It cannot be undone here.
              </p>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setConfirm(null)}
                  className="px-4 py-2 rounded-full bg-surface-container hover:bg-surface-container-high font-label-md text-label-md cursor-pointer"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => mark(confirm, 'donated')}
                  className="px-4 py-2 rounded-full bg-primary-container hover:bg-primary text-on-primary font-label-md text-label-md cursor-pointer"
                >
                  Record donation
                </button>
              </div>
            </div>
          )}

          {canChange && (
            <div className="flex flex-wrap justify-between gap-3 pt-2">
              <button
                type="button"
                onClick={() => onCancel(camp)}
                className="px-5 py-2.5 rounded-full text-error hover:bg-error-container font-label-md text-label-md cursor-pointer"
              >
                Cancel camp
              </button>
              <button
                type="button"
                onClick={() => onEdit(camp)}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-label-md text-label-md cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">edit</span>
                Edit camp
              </button>
            </div>
          )}
        </div>
      )}
    </Modal>
  )
}

/* ---------- Cards ---------- */
function LiveCard({ c, onOpen }) {
  const live = c.phase === 'live'
  return (
    <div className="p-space-lg rounded-xl bg-surface-container-lowest shadow-md flex flex-col gap-space-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <PhasePill phase={c.phase} />
          <h3 className="font-headline-sm text-headline-sm font-bold text-on-surface mt-2">{c.title}</h3>
          <span className="font-body-sm text-body-sm text-secondary flex items-center gap-1 mt-1">
            <span className="material-symbols-outlined text-[16px] text-primary">pin_drop</span>
            {c.venue}
          </span>
        </div>
        <div className="text-right shrink-0">
          <div className="font-label-sm text-label-sm text-secondary">Operating window</div>
          <div className="font-label-md text-label-md font-bold text-on-surface">
            {fmtTime(c.start_time)} – {fmtTime(c.end_time)}
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-1.5 p-space-md rounded-lg bg-surface-container-low">
        <div className="flex items-center justify-between font-label-sm text-label-sm">
          <span className="text-on-surface font-semibold">
            {c.donated} donated • {c.registered} registered • target {c.target_units}
          </span>
          <span className="font-bold text-tertiary">{c.percent}% collected</span>
        </div>
        <Bar percent={c.percent} />
        <p className="font-body-sm text-body-sm text-secondary pt-1">
          {live
            ? `${Math.max(0, c.registered - c.donated - c.deferred)} registered donor${
                c.registered - c.donated - c.deferred === 1 ? '' : 's'
              } still to be marked`
            : `Opens at ${fmtTime(c.start_time)}`}
        </p>
      </div>
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => onOpen(c.id)}
          className="px-space-md py-2 rounded-full bg-primary-container text-on-primary hover:bg-primary transition-all font-label-md text-label-md font-semibold flex items-center gap-1 shadow-sm cursor-pointer"
        >
          <span className="material-symbols-outlined text-[16px]">fact_check</span>
          Manage &amp; mark attendance
        </button>
      </div>
    </div>
  )
}

function CampCard({ c, onOpen }) {
  return (
    <div className="p-space-lg rounded-xl bg-surface-container-lowest shadow-sm flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <span className="px-2 py-0.5 rounded bg-surface-container-high text-on-surface font-label-sm text-label-sm font-semibold">
          {whenLabel(c)} • {fmtDate(c.camp_date)}
        </span>
        <span className="font-label-sm text-label-sm text-primary font-bold">Target: {c.target_units} units</span>
      </div>
      <div>
        <h4 className="font-title-md text-title-md font-bold text-on-surface">{c.title}</h4>
        <p className="font-body-sm text-body-sm text-secondary mt-0.5">
          {fmtTime(c.start_time)} – {fmtTime(c.end_time)} • {c.venue}
        </p>
      </div>
      <div className="flex flex-col gap-1">
        <Bar percent={c.fill_percent} tone="bg-primary-container" />
        <span className="font-body-sm text-body-sm text-tertiary flex items-center gap-1">
          <span className="material-symbols-outlined text-[16px]">groups</span>
          {c.registered} donor{c.registered === 1 ? '' : 's'} registered ({c.fill_percent}% of target)
        </span>
      </div>
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => onOpen(c.id)}
          className="font-label-md text-label-md text-primary font-semibold hover:underline cursor-pointer"
        >
          View donors &amp; manage →
        </button>
      </div>
    </div>
  )
}

/* ---------- Page ---------- */
export default function HospitalCamps() {
  const [data, setData] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [loading, setLoading] = useState(true)
  const [actionError, setActionError] = useState('')
  const [tab, setTab] = useState('upcoming')
  const [query, setQuery] = useState('')
  const [modal, setModal] = useState(null)
  const [toast, setToast] = useState(null)

  const load = useCallback(async ({ quiet = false } = {}) => {
    try {
      const res = await api.get('/hospital/camps/overview')
      setData(res.data)
      setLoadError('')
    } catch (err) {
      if (quiet) setActionError(errorMessage(err))
      else setLoadError(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    const t = setInterval(() => load({ quiet: true }), REFRESH_MS)
    return () => clearInterval(t)
  }, [load])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 4000)
    return () => clearTimeout(t)
  }, [toast])

  const closeModal = () => setModal(null)

  const createCamp = async ({ title, campDate, start, end, venue, target }) => {
    await api.post('/hospital/camps', {
      title,
      camp_date: campDate,
      start_time: start,
      end_time: end,
      venue,
      target_units: target,
    })
    await load({ quiet: true })
    closeModal()
    setTab('upcoming')
    setToast({ text: 'Camp created. Donors in your city can now register.' })
  }

  const editCamp = (camp) => async ({ title, campDate, start, end, venue, target }) => {
    const res = await api.put(`/hospital/camps/${camp.id}`, {
      title,
      camp_date: campDate,
      start_time: start,
      end_time: end,
      venue,
      target_units: target,
    })
    await load({ quiet: true })
    closeModal()
    const n = res.data.notified
    setToast({ text: n ? `Camp updated. ${n} donor${n === 1 ? '' : 's'} notified.` : 'Camp updated.' })
  }

  const cancelCamp = (camp) => async (reason) => {
    const res = await api.post(`/hospital/camps/${camp.id}/cancel`, { reason: reason || null })
    await load({ quiet: true })
    closeModal()
    const n = res.data.notified
    setToast({ text: n ? `Camp cancelled. ${n} donor${n === 1 ? '' : 's'} notified.` : 'Camp cancelled.' })
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-secondary">
        <span className="material-symbols-outlined text-[32px] animate-spin">progress_activity</span>
        <p className="mt-3 font-body-md text-body-md">Loading donation camps…</p>
      </div>
    )
  }

  if (loadError || !data) {
    return (
      <div className="max-w-md mx-auto py-20 text-center">
        <div className="w-12 h-12 rounded-full bg-error-container text-error flex items-center justify-center mx-auto mb-3">
          <span className="material-symbols-outlined text-[24px]">cloud_off</span>
        </div>
        <h2 className="font-headline-sm text-headline-sm text-on-surface">Could not load donation camps</h2>
        <p className="font-body-md text-body-md text-secondary mt-1">{loadError}</p>
        <button
          type="button"
          onClick={() => {
            setLoading(true)
            load()
          }}
          className="mt-5 px-6 py-2.5 rounded-full bg-primary-container hover:bg-primary text-on-primary font-label-md text-label-md cursor-pointer"
        >
          Try again
        </button>
      </div>
    )
  }

  const { summary, camps } = data
  const q = query.trim().toLowerCase()
  const matches = (c) => !q || c.title.toLowerCase().includes(q) || c.venue.toLowerCase().includes(q)
  const live = camps.filter((c) => c.phase === 'live' || c.phase === 'today')
  const upcoming = camps
    .filter((c) => c.phase === 'upcoming' && matches(c))
    .sort((a, b) => a.camp_date.localeCompare(b.camp_date) || a.start_time.localeCompare(b.start_time))
  const completed = camps.filter((c) => c.phase === 'completed' && matches(c))
  const cancelled = camps.filter((c) => c.phase === 'cancelled' && matches(c))
  const counts = { upcoming: upcoming.length, completed: completed.length, cancelled: cancelled.length }
  const finished = camps.filter((c) => c.phase === 'completed')
  const yieldPct = summary.target_completed
    ? Math.round((finished.reduce((sum, c) => sum + c.donated, 0) / summary.target_completed) * 100)
    : 0

  const exportCsv = () =>
    downloadCsv(
      'redsync-donation-camps.csv',
      ['Camp', 'Date', 'Start', 'End', 'Venue', 'Status', 'Target units', 'Registered', 'Donated', 'Deferred', 'No-show'],
      camps.map((c) => [
        c.title, c.camp_date, c.start_time, c.end_time, c.venue, PHASE[c.phase].label,
        c.target_units, c.registered, c.donated, c.deferred, c.no_show,
      ])
    )

  return (
    <div className="w-full flex flex-col gap-space-lg pb-8">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-space-md bg-surface-container-lowest p-space-lg rounded-[16px] shadow-sm">
        <div className="flex items-start md:items-center gap-space-md min-w-0">
          <div className="w-14 h-14 rounded-2xl bg-primary-fixed flex items-center justify-center text-primary shrink-0 shadow-sm">
            <span className="material-symbols-outlined text-[32px]" style={{ fontVariationSettings: "'FILL' 1" }}>
              volunteer_activism
            </span>
          </div>
          <div className="min-w-0">
            <h1 className="font-headline-md text-headline-md text-on-surface tracking-tight">Donation Camps</h1>
            <p className="font-body-md text-body-md text-secondary">
              Organise blood drives, see who has registered and record who donated.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-space-xs">
          <button
            type="button"
            onClick={exportCsv}
            disabled={camps.length === 0}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full font-label-md text-label-md text-on-surface bg-surface-container-high hover:bg-surface-container-highest transition-colors shadow-sm cursor-pointer disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[18px]">download</span>
            Export CSV
          </button>
          <button
            type="button"
            onClick={() => setModal({ type: 'create' })}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full font-label-md text-label-md text-on-primary bg-primary-container hover:bg-primary shadow-sm transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">add_circle</span>
            Organise new camp
          </button>
        </div>
      </div>

      {actionError && (
        <div role="alert" className="flex items-start gap-2.5 rounded-xl bg-error-container px-4 py-3 text-on-error-container">
          <span className="material-symbols-outlined text-[20px] shrink-0">error</span>
          <p className="font-body-sm text-body-sm">{actionError}</p>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-gutter">
        <Kpi
          label="Total camps"
          value={summary.total}
          icon="event_available"
          tone="bg-surface-container text-primary"
          sub={`${summary.completed} completed • ${summary.live + summary.today} today • ${summary.upcoming} upcoming`}
        />
        <Kpi
          label="Units collected"
          value={summary.units_collected}
          icon="bloodtype"
          tone="bg-primary-fixed text-primary"
          sub={summary.completed ? `${yieldPct}% of the target for finished camps` : 'From camps you have recorded'}
        />
        <Kpi
          label="Happening today"
          value={summary.live + summary.today}
          icon="sensors"
          tone="bg-tertiary-fixed text-tertiary"
          sub={summary.live ? `${summary.live} live right now` : 'No camp is live right now'}
        />
        <Kpi
          label="Registered donors"
          value={summary.registered_upcoming}
          icon="groups"
          tone="bg-surface-container-high text-on-surface"
          sub="Across upcoming and live camps"
        />
      </div>

      {/* Today */}
      {live.length > 0 && (
        <div className="flex flex-col gap-space-md">
          <div className="flex items-center gap-space-sm">
            <span className="flex h-3 w-3 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-tertiary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-tertiary"></span>
            </span>
            <h2 className="font-title-md text-title-md font-bold text-on-surface">Happening today</h2>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-gutter">
            {live.map((c) => (
              <LiveCard key={c.id} c={c} onOpen={(id) => setModal({ type: 'camp', id })} />
            ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex flex-col gap-space-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-sm">
          <div role="tablist" className="inline-flex p-1 rounded-xl bg-surface-container-high self-start">
            {TABS.map((t) => (
              <button
                key={t.id}
                role="tab"
                aria-selected={tab === t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`px-4 py-2 rounded-lg font-label-md text-label-md font-semibold transition-all cursor-pointer ${
                  tab === t.id ? 'bg-surface-container-lowest text-on-surface shadow-sm' : 'text-secondary hover:text-on-surface'
                }`}
              >
                {t.label} <span className="text-secondary font-normal">({counts[t.id]})</span>
              </button>
            ))}
          </div>
          <div className="relative">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search camp or venue…"
              aria-label="Search camps"
              className="h-10 pl-9 pr-3 rounded-full bg-surface-container-lowest text-on-surface font-body-sm text-body-sm shadow-sm outline-none focus:ring-2 focus:ring-primary w-full sm:w-64"
            />
            <span className="material-symbols-outlined text-[18px] text-secondary absolute left-3 top-2.5">search</span>
          </div>
        </div>

        {tab === 'upcoming' &&
          (upcoming.length ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-gutter">
              {upcoming.map((c) => (
                <CampCard key={c.id} c={c} onOpen={(id) => setModal({ type: 'camp', id })} />
              ))}
            </div>
          ) : (
            <Empty
              icon="event"
              text={q ? 'No upcoming camps match your search.' : 'No upcoming camps. Organise one and donors in your city can register.'}
              action={!q && { label: 'Organise new camp', run: () => setModal({ type: 'create' }) }}
            />
          ))}

        {tab === 'completed' &&
          (completed.length ? (
            <div className="rounded-xl bg-surface-container-lowest shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-surface-container-low text-secondary font-label-sm text-label-sm uppercase tracking-wider">
                      <th className="py-space-md px-space-md">Camp</th>
                      <th className="py-space-md px-space-md">Date</th>
                      <th className="py-space-md px-space-md">Venue</th>
                      <th className="py-space-md px-space-md text-right">Registered</th>
                      <th className="py-space-md px-space-md text-right">Donated</th>
                      <th className="py-space-md px-space-md text-right">Target met</th>
                      <th className="py-space-md px-space-md"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-container font-body-sm text-body-sm text-on-surface">
                    {completed.map((c) => (
                      <tr key={c.id} className="hover:bg-surface-container-low/50 transition-colors">
                        <td className="py-space-md px-space-md font-semibold">{c.title}</td>
                        <td className="py-space-md px-space-md">
                          {fmtDate(c.camp_date)}
                          <div className="text-secondary">
                            {fmtTime(c.start_time)} – {fmtTime(c.end_time)}
                          </div>
                        </td>
                        <td className="py-space-md px-space-md text-secondary">{c.venue}</td>
                        <td className="py-space-md px-space-md text-right">
                          {c.registered}
                          {c.no_show > 0 && <div className="text-secondary">{c.no_show} no-show</div>}
                        </td>
                        <td className="py-space-md px-space-md text-right font-bold text-tertiary">{c.donated}</td>
                        <td className="py-space-md px-space-md text-right">
                          <span className={`font-bold ${c.percent >= 100 ? 'text-tertiary' : 'text-on-surface'}`}>
                            {c.donated} / {c.target_units}
                          </span>
                          <div className="text-secondary">{c.percent}%</div>
                        </td>
                        <td className="py-space-md px-space-md text-right">
                          <button
                            type="button"
                            onClick={() => setModal({ type: 'camp', id: c.id })}
                            className="font-label-sm text-label-sm text-primary font-semibold hover:underline cursor-pointer"
                          >
                            Details
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <Empty icon="history_edu" text={q ? 'No completed camps match your search.' : 'No completed camps yet.'} />
          ))}

        {tab === 'cancelled' &&
          (cancelled.length ? (
            <ul className="rounded-xl bg-surface-container-lowest shadow-sm divide-y divide-surface-container">
              {cancelled.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 px-space-md py-space-md">
                  <div>
                    <p className="font-label-md text-label-md font-semibold text-on-surface">{c.title}</p>
                    <p className="font-body-sm text-body-sm text-secondary">
                      {fmtDate(c.camp_date)} • {c.venue}
                    </p>
                  </div>
                  <PhasePill phase="cancelled" />
                </li>
              ))}
            </ul>
          ) : (
            <Empty icon="event_busy" text={q ? 'No cancelled camps match your search.' : 'No cancelled camps.'} />
          ))}
      </div>

      {modal?.type === 'create' && <CreateCampModal onSave={createCamp} onClose={closeModal} />}
      {modal?.type === 'edit' && <CreateCampModal camp={modal.camp} onSave={editCamp(modal.camp)} onClose={closeModal} />}
      {modal?.type === 'cancel' && <CancelModal camp={modal.camp} onConfirm={cancelCamp(modal.camp)} onClose={closeModal} />}
      {modal?.type === 'camp' && (
        <CampModal
          campId={modal.id}
          onClose={closeModal}
          onEdit={(camp) => setModal({ type: 'edit', camp })}
          onCancel={(camp) => setModal({ type: 'cancel', camp })}
          onChanged={() => load({ quiet: true })}
        />
      )}

      {toast && (
        <div
          role="status"
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[70] max-w-[calc(100vw-2rem)] px-5 py-3 rounded-full shadow-xl font-label-md text-label-md flex items-center gap-2 bg-inverse-surface text-inverse-on-surface"
        >
          <span className="material-symbols-outlined text-[18px] text-tertiary-fixed-dim">check_circle</span>
          <span>{toast.text}</span>
        </div>
      )}
    </div>
  )
}

function Empty({ icon, text, action }) {
  return (
    <div className="rounded-xl bg-surface-container-lowest shadow-sm py-14 px-6 text-center">
      <div className="w-12 h-12 rounded-full bg-surface-container flex items-center justify-center mx-auto mb-3 text-secondary">
        <span className="material-symbols-outlined text-[24px]">{icon}</span>
      </div>
      <p className="font-body-md text-body-md text-secondary max-w-sm mx-auto">{text}</p>
      {action && (
        <button
          type="button"
          onClick={action.run}
          className="mt-4 px-5 py-2.5 rounded-full bg-primary-container hover:bg-primary text-on-primary font-label-md text-label-md cursor-pointer"
        >
          {action.label}
        </button>
      )}
    </div>
  )
}