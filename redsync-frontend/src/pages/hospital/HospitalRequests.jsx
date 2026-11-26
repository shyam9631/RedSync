import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api, { errorMessage } from '../../lib/api'
import Modal from '../../components/ui/Modal'
import { Field, ErrorText, inputClass } from '../../components/forms/FormBits'
import { PostRequestModal, RecordDonationModal } from './HospitalModals'
import { ALL_GROUPS, initials, localDateTimeValue, relTime } from '../../data/hospitalDemo'

const REFRESH_MS = 30000

const URGENCY = {
  critical: { label: 'Critical', pill: 'bg-error-container text-on-error-container font-bold', circle: 'bg-primary-container text-on-primary' },
  urgent: { label: 'Urgent', pill: 'bg-amber-100 text-amber-800 font-semibold', circle: 'bg-primary-fixed text-primary' },
  normal: { label: 'Normal', pill: 'bg-surface-container-high text-secondary', circle: 'bg-primary-fixed text-primary' },
}

const RESPONSE = {
  accepted: { label: 'Accepted', pill: 'bg-surface-container-high text-on-surface' },
  confirmed: { label: 'Confirmed', pill: 'bg-amber-100 text-amber-800' },
  completed: { label: 'Donated', pill: 'bg-tertiary-fixed text-on-tertiary-fixed' },
}

const TABS = [
  { id: 'open', label: 'Open' },
  { id: 'fulfilled', label: 'Fulfilled' },
  { id: 'cancelled', label: 'Cancelled' },
]

const selectClass =
  'h-10 px-3 bg-surface-container-lowest rounded-full font-body-sm text-body-sm text-on-surface shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-container'

const when = (iso) =>
  new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })

const plural = (n) => (n === 1 ? '' : 's')

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

function Kpi({ label, value, sub, icon, tone, alert }) {
  return (
    <div className={`p-space-lg rounded-xl shadow-sm flex flex-col gap-space-sm ${alert ? 'bg-error-container/40' : 'bg-surface-container-lowest'}`}>
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

function ErrorBanner({ children }) {
  return (
    <div role="alert" className="flex items-start gap-2.5 rounded-xl bg-error-container px-4 py-3 text-on-error-container">
      <span className="material-symbols-outlined text-[20px] shrink-0">error</span>
      <p className="font-body-sm text-body-sm">{children}</p>
    </div>
  )
}

/* ---------- Edit request ---------- */
function EditRequestModal({ request, onSave, onClose }) {
  const [urgency, setUrgency] = useState(request.urgency)
  const [requiredBy, setRequiredBy] = useState(localDateTimeValue(new Date(request.required_by)))
  const [notes, setNotes] = useState(request.notes || '')
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [minTime] = useState(() => localDateTimeValue(new Date()))

  const submit = async (e) => {
    e.preventDefault()
    const er = {}
    if (!requiredBy) er.requiredBy = 'Choose when the blood is needed.'
    else if (requiredBy <= minTime) er.requiredBy = 'Choose a time in the future.'
    setErrors(er)
    if (Object.keys(er).length) return
    setSaving(true)
    setFormError('')
    try {
      await onSave({ urgency, requiredBy: new Date(requiredBy), notes: notes.trim() })
    } catch (err) {
      setFormError(errorMessage(err))
      setSaving(false)
    }
  }

  return (
    <Modal
      title="Edit request"
      subtitle={`${request.blood_group} • ${request.units} unit${plural(request.units)} • ${request.component}`}
      leading={
        <div className="w-10 h-10 rounded-full bg-primary-container text-on-primary flex items-center justify-center font-badge-blood-group text-[15px] shrink-0">
          {request.blood_group}
        </div>
      }
      onClose={onClose}
    >
      <form onSubmit={submit} noValidate className="space-y-6">
        <p className="font-body-sm text-body-sm text-secondary">
          The blood group, units and component cannot be changed. Post a new request if you need something different.
          Donors who already accepted are told if the urgency or time changes.
        </p>
        <div>
          <span className="block font-label-md text-label-md text-on-surface mb-2">Urgency</span>
          <div className="grid grid-cols-3 gap-2">
            {Object.entries(URGENCY).map(([id, u]) => (
              <button
                key={id}
                type="button"
                aria-pressed={urgency === id}
                onClick={() => setUrgency(id)}
                className={`py-2.5 rounded-xl font-label-md text-label-md transition-all cursor-pointer ${
                  urgency === id ? 'bg-primary-container text-on-primary shadow-sm' : 'bg-surface-container-low text-on-surface hover:bg-surface-container-high'
                }`}
              >
                {u.label}
              </button>
            ))}
          </div>
        </div>
        <Field label="Needed by" htmlFor="er-by" required error={errors.requiredBy}>
          <input
            id="er-by"
            type="datetime-local"
            min={minTime}
            value={requiredBy}
            onChange={(e) => {
              setRequiredBy(e.target.value)
              setErrors({})
            }}
            className={inputClass(errors.requiredBy)}
          />
        </Field>
        <Field label="Notes" htmlFor="er-notes" optional>
          <textarea
            id="er-notes"
            rows={3}
            maxLength={300}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full px-4 py-3 bg-surface-container-low rounded-lg font-body-md text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-container"
          />
        </Field>
        {formError && <ErrorBanner>{formError}</ErrorBanner>}
        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-full bg-surface-container hover:bg-surface-container-high text-on-surface font-label-md text-label-md cursor-pointer">
            Cancel
          </button>
          <button type="submit" disabled={saving} className="px-6 py-2.5 rounded-full bg-primary-container hover:bg-primary text-on-primary font-label-md text-label-md shadow-sm cursor-pointer disabled:opacity-60">
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

/* ---------- Mark fulfilled (optionally issue stock) ---------- */
function FulfillModal({ request, onConfirm, onClose }) {
  const usable = request.usable_stock ?? 0
  const [issue, setIssue] = useState(String(Math.min(request.units, usable)))
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const n = Number(issue)
  const submit = async (e) => {
    e.preventDefault()
    if (!Number.isInteger(n) || n < 0 || n > request.units) {
      setError(`Enter between 0 and ${request.units}.`)
      return
    }
    setSaving(true)
    setError('')
    try {
      await onConfirm(n)
    } catch (err) {
      setError(errorMessage(err))
      setSaving(false)
    }
  }

  return (
    <Modal
      title="Mark as fulfilled"
      subtitle={`${request.blood_group} • ${request.units} unit${plural(request.units)} • ${request.component}`}
      leading={
        <div className="w-10 h-10 rounded-full bg-tertiary text-on-tertiary flex items-center justify-center shrink-0">
          <span className="material-symbols-outlined text-[20px]">task_alt</span>
        </div>
      }
      onClose={onClose}
    >
      <form onSubmit={submit} className="space-y-5">
        <p className="font-body-md text-body-md text-on-surface-variant">
          Closing the request stops it showing to donors. If the blood came from your own stock, take those units out now so the
          stock count stays correct.
        </p>
        <div className="rounded-xl bg-surface-container-low p-4">
          <label htmlFor="ff-issue" className="font-label-md text-label-md text-on-surface block mb-1.5">
            Units issued from your stock
          </label>
          <input
            id="ff-issue"
            type="text"
            inputMode="numeric"
            value={issue}
            onChange={(e) => {
              setIssue(e.target.value.replace(/\D/g, '').slice(0, 2))
              setError('')
            }}
            className="w-28 h-11 px-3 bg-surface-container-lowest rounded-lg font-body-md text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-container"
          />
          <p className="font-body-sm text-body-sm text-secondary mt-2">
            {usable > 0
              ? `You have ${usable} usable unit${plural(usable)} of ${request.component} ${request.blood_group}. Enter 0 if donors covered it.`
              : `You have no usable ${request.component} ${request.blood_group} in stock. Enter 0 if donors covered it.`}
          </p>
          <ErrorText>{error}</ErrorText>
        </div>
        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-full bg-surface-container hover:bg-surface-container-high text-on-surface font-label-md text-label-md cursor-pointer">
            Back
          </button>
          <button type="submit" disabled={saving} className="px-6 py-2.5 rounded-full bg-primary-container hover:bg-primary text-on-primary font-label-md text-label-md shadow-sm cursor-pointer disabled:opacity-60">
            {saving ? 'Saving…' : n > 0 ? `Fulfil and issue ${n}` : 'Mark fulfilled'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

/* ---------- Cancel request ---------- */
function CancelModal({ request, onConfirm, onClose }) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const active = request.responders.filter((p) => p.status !== 'completed').length

  const go = async () => {
    setSaving(true)
    setError('')
    try {
      await onConfirm()
    } catch (err) {
      setError(errorMessage(err))
      setSaving(false)
    }
  }

  return (
    <Modal
      title="Cancel this request?"
      subtitle={`${request.blood_group} • ${request.units} unit${plural(request.units)} • ${request.component}`}
      leading={
        <div className="w-10 h-10 rounded-full bg-error-container text-error flex items-center justify-center shrink-0">
          <span className="material-symbols-outlined text-[20px]">cancel</span>
        </div>
      }
      onClose={onClose}
    >
      <div className="space-y-5">
        <p className="font-body-md text-body-md text-on-surface-variant">
          {active > 0
            ? `${active} donor${plural(active)} who accepted will be told it was cancelled. `
            : 'No donor is waiting on this request. '}
          This cannot be undone.
        </p>
        {error && <ErrorBanner>{error}</ErrorBanner>}
        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-full bg-surface-container hover:bg-surface-container-high text-on-surface font-label-md text-label-md cursor-pointer">
            Keep request
          </button>
          <button type="button" disabled={saving} onClick={go} className="px-6 py-2.5 rounded-full bg-error text-on-error font-label-md text-label-md shadow-sm cursor-pointer disabled:opacity-60">
            {saving ? 'Cancelling…' : 'Cancel request'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

/* ---------- One open request ---------- */
function OpenCard({ r, busy, onEdit, onFulfil, onCancel, onConfirm, onRecord }) {
  const u = URGENCY[r.urgency]
  const [showDonors, setShowDonors] = useState(r.response_count > 0 && r.responders.some((p) => p.status === 'accepted'))
  const pledgedPct = Math.min(100, Math.round((r.pledged / r.units) * 100))
  const stockTone = r.usable_stock >= r.units ? 'text-tertiary' : r.usable_stock > 0 ? 'text-amber-800' : 'text-error'

  return (
    <div className={`rounded-xl bg-surface-container-lowest shadow-sm p-space-lg flex flex-col gap-space-md ${r.overdue ? 'ring-2 ring-error/40' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center font-badge-blood-group text-[16px] shadow-sm shrink-0 ${u.circle}`}>
            {r.blood_group}
          </div>
          <div className="min-w-0">
            <h3 className="font-title-md text-title-md font-bold text-on-surface">
              {r.units} unit{plural(r.units)} • {r.component}
            </h3>
            <p className="font-body-sm text-body-sm text-secondary">
              Posted {relTime(new Date(r.created_at)).toLowerCase()} • needed by {when(r.required_by)}
            </p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className={`px-2.5 py-0.5 rounded-full font-label-sm text-label-sm ${u.pill}`}>{u.label}</span>
          {r.overdue && <span className="px-2.5 py-0.5 rounded-full bg-error text-on-error font-label-sm text-label-sm font-bold">Overdue</span>}
        </div>
      </div>

      {r.notes && <p className="font-body-md text-body-md text-on-surface-variant">{r.notes}</p>}

      <div className="rounded-lg bg-surface-container-low p-space-md flex flex-col gap-2">
        <div className="flex items-center justify-between font-label-sm text-label-sm">
          <span className="text-on-surface font-semibold">
            {r.pledged} of {r.units} donor{plural(r.units)} pledged
          </span>
          <span className="text-secondary">{pledgedPct}%</span>
        </div>
        <div className="w-full h-2.5 rounded-full bg-surface-container-highest overflow-hidden">
          <div className="h-full rounded-full bg-tertiary transition-all duration-500" style={{ width: `${pledgedPct}%` }} />
        </div>
        <p className={`font-body-sm text-body-sm flex items-center gap-1 ${stockTone}`}>
          <span className="material-symbols-outlined text-[16px]">inventory_2</span>
          {r.usable_stock > 0
            ? `${r.usable_stock} usable unit${plural(r.usable_stock)} of ${r.component} ${r.blood_group} in your stock`
            : `No usable ${r.component} ${r.blood_group} in your stock`}
          <Link to="/hospital/stock" className="ml-1 underline font-semibold">
            Stock
          </Link>
        </p>
      </div>

      <div>
        <button
          type="button"
          onClick={() => setShowDonors(!showDonors)}
          aria-expanded={showDonors}
          className="inline-flex items-center gap-1 font-label-md text-label-md text-primary font-semibold cursor-pointer"
        >
          <span className="material-symbols-outlined text-[18px]">{showDonors ? 'expand_less' : 'expand_more'}</span>
          {r.response_count === 0 ? 'No donors have responded yet' : `${r.response_count} donor${plural(r.response_count)} responded`}
        </button>
        {showDonors && r.responders.length > 0 && (
          <ul className="mt-2 divide-y divide-surface-container rounded-xl bg-surface-container-low overflow-hidden">
            {r.responders.map((p) => {
              const st = RESPONSE[p.status] || RESPONSE.accepted
              return (
                <li key={p.response_id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <div className="w-9 h-9 rounded-full bg-surface-container-highest flex items-center justify-center text-[12px] font-bold text-on-surface shrink-0">
                    {initials(p.name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-label-md text-label-md font-semibold text-on-surface truncate">{p.name}</p>
                    <p className="font-body-sm text-body-sm text-secondary truncate">
                      {p.area} •{' '}
                      <a href={`tel:${p.phone}`} className="text-primary hover:underline font-medium">
                        {p.phone}
                      </a>
                    </p>
                  </div>
                  <span className={`px-2.5 py-0.5 rounded-full font-label-sm text-label-sm font-semibold ${st.pill}`}>{st.label}</span>
                  {p.status === 'accepted' && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => onConfirm(r, p)}
                      className="px-3 py-1.5 rounded-full bg-surface-container-high hover:bg-secondary-container text-on-surface font-label-sm text-label-sm font-semibold cursor-pointer disabled:opacity-50"
                    >
                      Confirm
                    </button>
                  )}
                  {p.status !== 'completed' && (
                    <button
                      type="button"
                      onClick={() => onRecord(p)}
                      className="px-3 py-1.5 rounded-full bg-primary-container hover:bg-primary text-on-primary font-label-sm text-label-sm font-semibold cursor-pointer"
                    >
                      Record donation
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        )}
        {showDonors && r.responders.length > 0 && (
          <p className="mt-2 font-body-sm text-body-sm text-secondary">Contact details are shown because these donors accepted your request.</p>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => onEdit(r)} className="inline-flex items-center gap-1 px-3 py-2 rounded-full text-on-surface hover:bg-surface-container-high font-label-md text-label-md cursor-pointer">
            <span className="material-symbols-outlined text-[18px]">edit</span>
            Edit
          </button>
          <button type="button" onClick={() => onCancel(r)} className="px-3 py-2 rounded-full text-secondary hover:text-error hover:bg-error-container font-label-md text-label-md cursor-pointer">
            Cancel request
          </button>
        </div>
        <button
          type="button"
          onClick={() => onFulfil(r)}
          className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full bg-tertiary text-on-tertiary hover:opacity-90 font-label-md text-label-md font-semibold shadow-sm cursor-pointer"
        >
          <span className="material-symbols-outlined text-[18px]">task_alt</span>
          Mark fulfilled
        </button>
      </div>
    </div>
  )
}

/* ---------- Page ---------- */
export default function HospitalRequests() {
  const [data, setData] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [loading, setLoading] = useState(true)
  const [actionError, setActionError] = useState('')
  const [busy, setBusy] = useState(false)
  const [tab, setTab] = useState('open')
  const [fUrgency, setFUrgency] = useState('all')
  const [fGroup, setFGroup] = useState('all')
  const [query, setQuery] = useState('')
  const [modal, setModal] = useState(null)
  const [donors, setDonors] = useState([])
  const [toast, setToast] = useState(null)

  const load = useCallback(async ({ quiet = false } = {}) => {
    try {
      const res = await api.get('/hospital/requests/overview')
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

  // Runs a quick action, refreshes the page, shows a message
  const act = async (fn, message) => {
    setBusy(true)
    setActionError('')
    try {
      await fn()
      await load({ quiet: true })
      if (message) setToast({ text: message })
    } catch (err) {
      setActionError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const postRequest = async (r) => {
    const res = await api.post('/hospital/requests', {
      blood_group: r.group,
      units: r.units,
      component: r.component,
      urgency: r.urgency,
      required_by: r.requiredBy.toISOString(),
      notes: r.notes || undefined,
    })
    await load({ quiet: true })
    closeModal()
    setTab('open')
    const n = res.data.notified
    setToast({ text: `Request posted. ${n} matching donor${plural(n)} notified.` })
  }

  const editRequest = (req) => async ({ urgency, requiredBy, notes }) => {
    const res = await api.patch(`/hospital/requests/${req.id}`, {
      urgency,
      required_by: requiredBy.toISOString(),
      notes,
    })
    await load({ quiet: true })
    closeModal()
    const n = res.data.notified
    setToast({ text: n ? `Request updated. ${n} donor${plural(n)} told.` : 'Request updated.' })
  }

  const fulfil = (req) => async (units) => {
    await api.post(`/hospital/requests/${req.id}/fulfill-with-stock`, { issue_units: units })
    await load({ quiet: true })
    closeModal()
    setToast({ text: units ? `Request fulfilled. ${units} unit${plural(units)} issued from stock.` : 'Request marked as fulfilled.' })
  }

  const cancelRequest = (req) => async () => {
    await api.post(`/hospital/requests/${req.id}/cancel`)
    await load({ quiet: true })
    closeModal()
    setToast({ text: 'Request cancelled.' })
  }

  const confirmResponse = (req, resp) =>
    act(
      () => api.patch(`/hospital/requests/${req.id}/responses/${resp.response_id}`, { status: 'confirmed' }),
      `Confirmed ${resp.name}. They have been asked to visit.`
    )

  const openRecord = async (resp) => {
    setActionError('')
    try {
      const res = await api.get('/hospital/donors')
      setDonors(res.data.donors)
      setModal({ type: 'record', donorId: resp.donor_id, responseId: resp.response_id })
    } catch (err) {
      setActionError(errorMessage(err))
    }
  }

  const recordDonation = async ({ donorId, date, component, units, batch, responseId }) => {
    const res = await api.post('/hospital/donations', {
      donor_id: donorId,
      donation_date: date,
      component,
      units,
      batch_id: batch || undefined,
      response_id: responseId || undefined,
    })
    await load({ quiet: true })
    closeModal()
    const d = res.data
    setToast({ text: d.warning ? `Donation recorded for ${d.donor_name}. Note: ${d.warning}` : `Donation recorded for ${d.donor_name}.` })
  }

  const forward = (p) =>
    act(async () => {
      const res = await api.post(`/hospital/public-requests/${p.id}/forward`)
      setToast({ text: `Sent to donors. ${res.data.notified} matching donor${plural(res.data.notified)} notified.` })
    })

  const dismiss = (p) => {
    if (!window.confirm(`Dismiss the ${p.blood_group} request from ${p.requester_name}? It will be removed from this list.`)) return
    act(() => api.post(`/hospital/public-requests/${p.id}/dismiss`), 'Patient request dismissed.')
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-secondary">
        <span className="material-symbols-outlined text-[32px] animate-spin">progress_activity</span>
        <p className="mt-3 font-body-md text-body-md">Loading requests…</p>
      </div>
    )
  }

  if (loadError || !data) {
    return (
      <div className="max-w-md mx-auto py-20 text-center">
        <div className="w-12 h-12 rounded-full bg-error-container text-error flex items-center justify-center mx-auto mb-3">
          <span className="material-symbols-outlined text-[24px]">cloud_off</span>
        </div>
        <h2 className="font-headline-sm text-headline-sm text-on-surface">Could not load requests</h2>
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

  const { summary, patient_requests: patients } = data
  const q = query.trim().toLowerCase()
  const matches = (r) =>
    (fUrgency === 'all' || r.urgency === fUrgency) &&
    (fGroup === 'all' || r.blood_group === fGroup) &&
    (!q || `${r.component} ${r.notes || ''} ${r.blood_group}`.toLowerCase().includes(q))

  const open = data.open.filter(matches)
  const fulfilled = data.closed.filter((r) => r.status === 'fulfilled' && matches(r))
  const cancelled = data.closed.filter((r) => r.status === 'cancelled' && matches(r))
  const counts = {
    open: data.open.length,
    fulfilled: data.closed.filter((r) => r.status === 'fulfilled').length,
    cancelled: data.closed.filter((r) => r.status === 'cancelled').length,
  }
  const closedRows = tab === 'fulfilled' ? fulfilled : cancelled
  const modalRequest = modal?.request ? data.open.find((r) => r.id === modal.request.id) || modal.request : null

  const exportCsv = () =>
    downloadCsv(
      'redsync-blood-requests.csv',
      ['ID', 'Blood group', 'Units', 'Component', 'Urgency', 'Status', 'Posted', 'Needed by', 'Donors responded', 'Notes'],
      [...data.open, ...data.closed].map((r) => [r.id, r.blood_group, r.units, r.component, r.urgency, r.status, r.created_at, r.required_by, r.response_count, r.notes])
    )

  return (
    <div className="w-full flex flex-col gap-space-lg pb-8">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-space-md bg-surface-container-lowest p-space-lg rounded-[16px] shadow-sm">
        <div className="flex items-start md:items-center gap-space-md min-w-0">
          <div className="w-14 h-14 rounded-2xl bg-primary-fixed flex items-center justify-center text-primary shrink-0 shadow-sm">
            <span className="material-symbols-outlined text-[32px]" style={{ fontVariationSettings: "'FILL' 1" }}>
              emergency
            </span>
          </div>
          <div className="min-w-0">
            <h1 className="font-headline-md text-headline-md text-on-surface tracking-tight">Blood Requests</h1>
            <p className="font-body-md text-body-md text-secondary">Post requests, track donors who respond and close them when the blood is arranged.</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-space-xs">
          <button
            type="button"
            onClick={exportCsv}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full font-label-md text-label-md text-on-surface bg-surface-container-high hover:bg-surface-container-highest shadow-sm cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">download</span>
            Export CSV
          </button>
          <button
            type="button"
            onClick={() => setModal({ type: 'post' })}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full font-label-md text-label-md text-on-primary bg-primary-container hover:bg-primary shadow-sm cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">add_circle</span>
            Post urgent request
          </button>
        </div>
      </div>

      {actionError && <ErrorBanner>{actionError}</ErrorBanner>}

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-gutter">
        <Kpi
          label="Open requests"
          value={summary.open}
          icon="pending_actions"
          tone="bg-primary-fixed text-primary"
          sub={summary.overdue ? `${summary.overdue} past the needed-by time` : 'None are overdue'}
        />
        <Kpi
          label="Critical"
          value={summary.critical}
          icon="priority_high"
          tone="bg-error-container text-error"
          alert={summary.critical > 0}
          sub={summary.critical ? 'Needs blood within hours' : 'No critical requests'}
        />
        <Kpi
          label="Waiting for you"
          value={summary.waiting_for_confirmation}
          icon="how_to_reg"
          tone="bg-surface-container-high text-on-surface"
          sub="Donors who accepted and need confirming"
        />
        <Kpi
          label="Fulfilled (30 days)"
          value={summary.fulfilled_30_days}
          icon="task_alt"
          tone="bg-tertiary-fixed text-tertiary"
          sub="Requests posted in the last 30 days"
        />
      </div>

      {/* Patient requests */}
      {patients.length > 0 && (
        <section className="rounded-xl bg-surface-container-lowest shadow-sm p-space-lg flex flex-col gap-space-md">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[22px]">inbox</span>
            <h2 className="font-title-md text-title-md font-bold text-on-surface">Requests from patients' families</h2>
            <span className="min-w-5 h-5 px-1.5 rounded-full bg-primary text-on-primary text-xs flex items-center justify-center font-bold">{patients.length}</span>
          </div>
          <p className="font-body-sm text-body-sm text-secondary -mt-2">
            Sent from the public Request Blood form for your city. Forward one to alert matching donors, or dismiss it.
          </p>
          <ul className="divide-y divide-surface-container">
            {patients.map((p) => (
              <li key={p.id} className="py-3 flex flex-wrap items-center gap-3">
                <div className={`w-11 h-11 rounded-full flex items-center justify-center font-badge-blood-group text-[15px] shrink-0 ${URGENCY[p.urgency].circle}`}>
                  {p.blood_group}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-label-md text-label-md font-semibold text-on-surface">
                    {p.units} unit{plural(p.units)} • {p.component} •{' '}
                    <span className={`px-2 py-0.5 rounded-full text-[11px] ${URGENCY[p.urgency].pill}`}>{URGENCY[p.urgency].label}</span>
                  </p>
                  <p className="font-body-sm text-body-sm text-secondary">
                    {p.requester_name} •{' '}
                    <a href={`tel:${p.phone}`} className="text-primary hover:underline font-medium">
                      {p.phone}
                    </a>{' '}
                    • patient at {p.hospital_name} • {relTime(new Date(p.created_at)).toLowerCase()}
                  </p>
                  {p.notes && <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">{p.notes}</p>}
                </div>
                <div className="flex gap-2">
                  <button type="button" disabled={busy} onClick={() => dismiss(p)} className="px-4 py-2 rounded-full bg-surface-container hover:bg-surface-container-high text-on-surface font-label-md text-label-md cursor-pointer disabled:opacity-50">
                    Dismiss
                  </button>
                  <button type="button" disabled={busy} onClick={() => forward(p)} className="px-4 py-2 rounded-full bg-primary-container hover:bg-primary text-on-primary font-label-md text-label-md cursor-pointer disabled:opacity-50">
                    Forward to donors
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Tabs and filters */}
      <div className="flex flex-col gap-space-md">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-space-sm">
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
          <div className="flex flex-wrap items-center gap-2">
            <select aria-label="Filter by urgency" value={fUrgency} onChange={(e) => setFUrgency(e.target.value)} className={selectClass}>
              <option value="all">All urgencies</option>
              <option value="critical">Critical</option>
              <option value="urgent">Urgent</option>
              <option value="normal">Normal</option>
            </select>
            <select aria-label="Filter by blood group" value={fGroup} onChange={(e) => setFGroup(e.target.value)} className={selectClass}>
              <option value="all">All blood groups</option>
              {ALL_GROUPS.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
            <div className="relative">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search notes or component…"
                aria-label="Search requests"
                className="h-10 pl-9 pr-3 rounded-full bg-surface-container-lowest text-on-surface font-body-sm text-body-sm shadow-sm outline-none focus:ring-2 focus:ring-primary w-56"
              />
              <span className="material-symbols-outlined text-[18px] text-secondary absolute left-3 top-2.5">search</span>
            </div>
          </div>
        </div>

        {tab === 'open' &&
          (open.length ? (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-gutter items-start">
              {open.map((r) => (
                <OpenCard
                  key={r.id}
                  r={r}
                  busy={busy}
                  onEdit={(req) => setModal({ type: 'edit', request: req })}
                  onFulfil={(req) => setModal({ type: 'fulfil', request: req })}
                  onCancel={(req) => setModal({ type: 'cancel', request: req })}
                  onConfirm={confirmResponse}
                  onRecord={openRecord}
                />
              ))}
            </div>
          ) : (
            <Empty
              icon="bloodtype"
              text={counts.open ? 'No open requests match your filters.' : 'No open requests. Post one and matching donors in your city are alerted.'}
              action={!counts.open && { label: 'Post urgent request', run: () => setModal({ type: 'post' }) }}
            />
          ))}

        {tab !== 'open' &&
          (closedRows.length ? (
            <div className="rounded-xl bg-surface-container-lowest shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-surface-container-low text-secondary font-label-sm text-label-sm uppercase tracking-wider">
                      <th className="py-space-md px-space-md">Blood</th>
                      <th className="py-space-md px-space-md">Request</th>
                      <th className="py-space-md px-space-md">Posted</th>
                      <th className="py-space-md px-space-md">Urgency</th>
                      <th className="py-space-md px-space-md text-right">Donors responded</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-container font-body-sm text-body-sm text-on-surface">
                    {closedRows.map((r) => (
                      <tr key={r.id} className="hover:bg-surface-container-low/50">
                        <td className="py-space-md px-space-md">
                          <span className="w-9 h-9 rounded-full bg-primary-fixed text-primary font-badge-blood-group text-[13px] flex items-center justify-center font-bold">{r.blood_group}</span>
                        </td>
                        <td className="py-space-md px-space-md">
                          <div className="font-semibold">
                            {r.units} unit{plural(r.units)} • {r.component}
                          </div>
                          {r.notes && <div className="text-secondary">{r.notes}</div>}
                        </td>
                        <td className="py-space-md px-space-md">{when(r.created_at)}</td>
                        <td className="py-space-md px-space-md">
                          <span className={`px-2.5 py-0.5 rounded-full font-label-sm text-label-sm ${URGENCY[r.urgency].pill}`}>{URGENCY[r.urgency].label}</span>
                        </td>
                        <td className="py-space-md px-space-md text-right">{r.response_count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="px-space-md py-space-sm bg-surface-container-low font-label-sm text-label-sm text-secondary">Showing the most recent closed requests.</p>
            </div>
          ) : (
            <Empty icon={tab === 'fulfilled' ? 'task_alt' : 'event_busy'} text={tab === 'fulfilled' ? 'No fulfilled requests to show.' : 'No cancelled requests to show.'} />
          ))}
      </div>

      {modal?.type === 'post' && <PostRequestModal onSave={postRequest} onClose={closeModal} />}
      {modal?.type === 'edit' && modalRequest && <EditRequestModal request={modalRequest} onSave={editRequest(modalRequest)} onClose={closeModal} />}
      {modal?.type === 'fulfil' && modalRequest && <FulfillModal request={modalRequest} onConfirm={fulfil(modalRequest)} onClose={closeModal} />}
      {modal?.type === 'cancel' && modalRequest && <CancelModal request={modalRequest} onConfirm={cancelRequest(modalRequest)} onClose={closeModal} />}
      {modal?.type === 'record' && (
        <RecordDonationModal donors={donors} initialDonorId={modal.donorId} responseId={modal.responseId} onSave={recordDonation} onClose={closeModal} />
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
        <button type="button" onClick={action.run} className="mt-4 px-5 py-2.5 rounded-full bg-primary-container hover:bg-primary text-on-primary font-label-md text-label-md cursor-pointer">
          {action.label}
        </button>
      )}
    </div>
  )
}