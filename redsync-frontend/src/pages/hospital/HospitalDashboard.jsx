import { useEffect, useState } from 'react'
import Modal from '../../components/ui/Modal'
import api, { errorMessage } from '../../lib/api'
import {
  UpdateStockModal,
  PostRequestModal,
  RecordDonationModal,
  CreateCampModal,
} from './HospitalModals'
import { formatDate } from '../../data/donorDemo'
import {
  ALL_GROUPS,
  LOW_AT,
  CRITICAL_AT,
  BAR_FULL,
  statusOf,
  daysUntil,
  relTime,
  initials,
} from '../../data/hospitalDemo'

const STATUS = {
  available: {
    label: 'Available',
    pill: 'bg-tertiary-fixed text-on-tertiary-fixed',
    bar: 'bg-tertiary',
  },
  low: { label: 'Low', pill: 'bg-amber-100 text-amber-800', bar: 'bg-amber-500' },
  critical: {
    label: 'Critical',
    pill: 'bg-error-container text-on-error-container font-semibold',
    bar: 'bg-error',
  },
}

const URGENCY = {
  critical: { label: 'Critical', pill: 'bg-error-container text-on-error-container font-bold' },
  urgent: { label: 'Urgent', pill: 'bg-amber-100 text-amber-800 font-semibold' },
  normal: { label: 'Normal', pill: 'bg-surface-container-high text-secondary' },
}

const TONE = {
  neutral: 'bg-surface-container text-primary',
  good: 'bg-tertiary-fixed text-tertiary',
  alert: 'bg-error-container text-error',
}

const groupName = (g) => `${g.replace(/[+-]/, '')} ${g.endsWith('+') ? 'positive' : 'negative'}`

const filterSelect =
  'w-full px-3 py-2 bg-surface-container-low rounded-lg font-body-md text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-container'

function expiryText(days) {
  if (days < 0) return 'expired'
  if (days === 0) return 'today'
  if (days === 1) return 'in 1 day'
  return `in ${days} days`
}

function formatTime(hhmm) {
  if (!hhmm) return ''
  const [h, m] = hhmm.split(':').map(Number)
  const d = new Date()
  d.setHours(h, m, 0, 0)
  return d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })
}

const neededBy = (iso) =>
  new Date(iso).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  })

// Loads everything the page shows in one go
async function fetchAll() {
  const [me, stock, donors, requests, activity, camps] = await Promise.all([
    api.get('/hospital/me'),
    api.get('/hospital/stock'),
    api.get('/hospital/donors'),
    api.get('/hospital/requests'),
    api.get('/hospital/activity'),
    api.get('/hospital/camps'),
  ])
  return {
    me: me.data,
    stock: stock.data,
    donors: donors.data.donors,
    requests: requests.data,
    activity: activity.data,
    camps: camps.data,
  }
}

export default function HospitalDashboard() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [busy, setBusy] = useState(false)
  const [modal, setModal] = useState(null)
  const [toast, setToast] = useState(null) // { text, error }

  const [q, setQ] = useState('')
  const [fGroup, setFGroup] = useState('all')
  const [fElig, setFElig] = useState('all')
  const [fStatus, setFStatus] = useState('all')

  // First load
  useEffect(() => {
    let alive = true
    fetchAll()
      .then((d) => alive && setData(d))
      .catch((err) => alive && setLoadError(errorMessage(err)))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), toast.error ? 6000 : 3500)
    return () => clearTimeout(t)
  }, [toast])

  const retry = () => {
    setLoading(true)
    setLoadError('')
    fetchAll()
      .then(setData)
      .catch((err) => setLoadError(errorMessage(err)))
      .finally(() => setLoading(false))
  }

  // Refresh after a change. A failed refresh keeps the old data on screen.
  const refresh = async () => {
    try {
      setData(await fetchAll())
    } catch (err) {
      setToast({ text: errorMessage(err), error: true })
    }
  }

  // For buttons on the page itself: runs the call, refreshes, shows a message
  const act = async (fn, okText) => {
    setBusy(true)
    try {
      const result = await fn()
      await refresh()
      if (okText) setToast({ text: typeof okText === 'function' ? okText(result) : okText })
    } catch (err) {
      setToast({ text: errorMessage(err), error: true })
    } finally {
      setBusy(false)
    }
  }

  const closeModal = () => setModal(null)

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-secondary">
        <span className="material-symbols-outlined text-[32px] animate-spin">progress_activity</span>
        <p className="mt-3 font-body-md text-body-md">Loading your dashboard…</p>
      </div>
    )
  }

  if (loadError || !data) {
    return (
      <div className="max-w-md mx-auto py-20 text-center">
        <div className="w-12 h-12 rounded-full bg-error-container text-error flex items-center justify-center mx-auto mb-3">
          <span className="material-symbols-outlined text-[24px]">cloud_off</span>
        </div>
        <h2 className="font-headline-sm text-headline-sm text-on-surface">
          Could not load your dashboard
        </h2>
        <p className="font-body-md text-body-md text-secondary mt-1">{loadError}</p>
        <button
          type="button"
          onClick={retry}
          className="mt-5 px-6 py-2.5 rounded-full bg-primary-container hover:bg-primary text-on-primary font-label-md text-label-md cursor-pointer"
        >
          Try again
        </button>
      </div>
    )
  }

  const { me, stock, donors, requests, activity, camps } = data

  /* ---------- derived numbers ---------- */
  const totalUnits = stock.reduce((sum, i) => sum + i.units, 0)
  const lowItems = stock.filter((i) => statusOf(i.units) !== 'available')
  const criticalCount = lowItems.filter((i) => statusOf(i.units) === 'critical').length
  const activeDonors = donors.filter((d) => d.active)
  const eligibleActive = activeDonors.filter((d) => d.eligible).length
  const responseCount = requests.reduce((sum, r) => sum + r.response_count, 0)
  const expiring = stock.filter((i) => i.expiry && i.units > 0 && daysUntil(i.expiry) <= 3)

  const shownDonors = donors.filter((d) => {
    const term = q.trim().toLowerCase()
    if (
      term &&
      !(
        d.name.toLowerCase().includes(term) ||
        d.area.toLowerCase().includes(term) ||
        d.code.toLowerCase().includes(term)
      )
    )
      return false
    if (fGroup !== 'all' && d.blood_group !== fGroup) return false
    if (fElig === 'eligible' && !d.eligible) return false
    if (fElig === 'not' && d.eligible) return false
    if (fStatus === 'active' && !d.active) return false
    if (fStatus === 'offline' && d.active) return false
    return true
  })

  /* ---------- actions ---------- */
  // Modal saves throw on failure so the modal can show the server's message
  const saveStock = async ({ group, units, expiry, notes }) => {
    await api.put(`/hospital/stock/${group}`, {
      units,
      expiry: expiry || undefined,
      notes: notes || undefined,
    })
    await refresh()
    setToast({ text: `Stock updated for ${group}.` })
    closeModal()
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
    await refresh()
    const n = res.data.notified
    setToast({
      text: `Request posted. ${n} matching donor${n === 1 ? '' : 's'} notified.`,
    })
    closeModal()
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
    await refresh()
    const d = res.data
    setToast({
      text: d.warning
        ? `Donation recorded for ${d.donor_name}. Note: ${d.warning}`
        : `Donation recorded for ${d.donor_name}.`,
    })
    closeModal()
  }

  const createCamp = async ({ title, campDate, start, end, venue, target }) => {
    await api.post('/hospital/camps', {
      title,
      camp_date: campDate,
      start_time: start,
      end_time: end,
      venue,
      target_units: target,
    })
    await refresh()
    setToast({ text: 'Camp created. Donors in your city can now register.' })
    closeModal()
  }

  const toggleDonor = (d) =>
    act(() => api.patch(`/hospital/donors/${d.id}/active`, { active: !d.active }))

  const fulfil = (r) =>
    act(() => api.post(`/hospital/requests/${r.id}/fulfill`), 'Request marked as fulfilled.')

  const cancelRequest = (r) => {
    if (!window.confirm(`Cancel the ${r.blood_group} request? Donors who accepted will be told.`))
      return
    act(() => api.post(`/hospital/requests/${r.id}/cancel`), 'Request cancelled.')
  }

  const confirmResponse = (req, resp) =>
    act(
      () =>
        api.patch(`/hospital/requests/${req.id}/responses/${resp.response_id}`, {
          status: 'confirmed',
        }),
      `Confirmed ${resp.name}. They have been asked to visit.`
    )

  const cancelCamp = (c) => {
    if (!window.confirm(`Cancel the camp "${c.title}"? Registered donors will be told.`)) return
    act(() => api.delete(`/hospital/camps/${c.id}`), 'Camp cancelled.')
  }

  const stockItem = modal?.type === 'stock' ? stock.find((s) => s.group === modal.group) : null
  const respReq = modal?.type === 'responses' ? requests.find((r) => r.id === modal.id) : null
  const nextCamp = camps[0]

  return (
    <div className="flex flex-col w-full pb-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-space-md mb-8">
        <div className="flex flex-wrap items-center gap-space-sm sm:gap-space-md">
          <h1 className="font-headline-lg text-headline-lg-mobile sm:text-headline-lg text-on-surface tracking-tight">
            {me.name}
          </h1>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 font-mono text-label-sm text-secondary bg-surface-container rounded-full">
            <span className="w-2 h-2 rounded-full bg-tertiary"></span>
            Facility code: {me.facility_code}
          </span>
        </div>
        <div className="flex items-center gap-space-sm shrink-0 flex-wrap">
          <button
            type="button"
            onClick={() => setModal({ type: 'request' })}
            className="inline-flex items-center gap-2 bg-primary-container text-on-primary hover:bg-primary px-5 py-2.5 rounded-full font-label-md text-label-md shadow-sm hover:shadow transition-all active:scale-95 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">add_alert</span>
            <span>Post urgent request</span>
          </button>
          <button
            type="button"
            onClick={() => setModal({ type: 'record' })}
            className="inline-flex items-center gap-2 bg-surface-container-lowest text-on-surface hover:bg-surface-container-low px-5 py-2.5 rounded-full font-label-md text-label-md shadow-sm border border-surface-container transition-all active:scale-95 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">biotech</span>
            <span>Record a donation</span>
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        <div className="bg-surface-container-lowest rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <span className="font-body-md text-body-md text-secondary font-medium">Total units in stock</span>
            <div className="w-10 h-10 rounded-xl bg-surface-container-high flex items-center justify-center text-primary">
              <span className="material-symbols-outlined text-[22px]">inventory_2</span>
            </div>
          </div>
          <div className="font-headline-xl text-headline-xl-mobile sm:text-headline-xl text-on-surface leading-none mb-2">
            {totalUnits}
          </div>
          <p className="font-body-sm text-body-sm text-secondary">Across all 8 blood groups</p>
        </div>

        <div className="bg-surface-container-lowest rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <span className="font-body-md text-body-md text-secondary font-medium">Blood groups running low</span>
            <div className="w-10 h-10 rounded-xl bg-error-container/60 flex items-center justify-center text-error">
              <span className="material-symbols-outlined text-[22px]">warning</span>
            </div>
          </div>
          <div
            className={`font-headline-xl text-headline-xl-mobile sm:text-headline-xl leading-none mb-2 ${
              lowItems.length ? 'text-error' : 'text-on-surface'
            }`}
          >
            {lowItems.length}
          </div>
          <p className="font-body-sm text-body-sm text-secondary">
            {lowItems.length
              ? `${lowItems.map((i) => i.group).join(', ')}${
                  criticalCount ? ` (${criticalCount} critical)` : ''
                }`
              : 'All groups above the low level'}
          </p>
        </div>

        <div className="bg-surface-container-lowest rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <span className="font-body-md text-body-md text-secondary font-medium">Open requests</span>
            <div className="w-10 h-10 rounded-xl bg-primary-fixed flex items-center justify-center text-primary-container">
              <span className="material-symbols-outlined text-[22px]">emergency</span>
            </div>
          </div>
          <div className="font-headline-xl text-headline-xl-mobile sm:text-headline-xl text-primary-container leading-none mb-2">
            {requests.length}
          </div>
          <p className="font-body-sm text-body-sm text-secondary">
            {responseCount} donor response{responseCount === 1 ? '' : 's'}
          </p>
        </div>

        <div className="bg-surface-container-lowest rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <span className="font-body-md text-body-md text-secondary font-medium">Active donors in list</span>
            <div className="w-10 h-10 rounded-xl bg-surface-container flex items-center justify-center text-tertiary">
              <span className="material-symbols-outlined text-[22px]">group</span>
            </div>
          </div>
          <div className="font-headline-xl text-headline-xl-mobile sm:text-headline-xl text-on-surface leading-none mb-2">
            {activeDonors.length}
          </div>
          <p className="font-body-sm text-body-sm text-secondary">
            {eligibleActive} eligible to donate today
          </p>
        </div>
      </div>

      {/* Main area */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* LEFT */}
        <div className="lg:col-span-8 flex flex-col gap-8 min-w-0">
          {/* Stock */}
          <div className="bg-surface-container-lowest rounded-2xl p-6 shadow-sm">
            <div className="mb-4">
              <h2 className="font-headline-sm text-headline-sm text-on-surface">Blood stock</h2>
              <p className="font-body-sm text-body-sm text-secondary">
                Low is {LOW_AT} units or fewer. Critical is {CRITICAL_AT} or fewer.
              </p>
            </div>

            {expiring.length > 0 && (
              <div className="mb-6 rounded-xl bg-amber-100 p-3.5 flex items-center justify-between gap-3 text-amber-900">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="material-symbols-outlined text-[20px] shrink-0">alarm</span>
                  <span className="font-body-sm text-body-sm">
                    <strong>Check expiry:</strong>{' '}
                    {expiring.map((i) => `${i.group} (${expiryText(daysUntil(i.expiry))})`).join(', ')}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setModal({ type: 'stock', group: expiring[0].group })}
                  className="font-label-sm text-label-sm text-primary hover:underline shrink-0 cursor-pointer"
                >
                  Update
                </button>
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left">
                <thead>
                  <tr className="text-label-sm font-label-sm text-secondary uppercase tracking-wider bg-surface-container-low/70">
                    <th className="py-2.5 px-3 rounded-l-lg">Group</th>
                    <th className="py-2.5 px-3">Available</th>
                    <th className="py-2.5 px-3 w-36">Stock level</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Last updated</th>
                    <th className="py-2.5 px-3 text-right rounded-r-lg">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {stock.map((s) => {
                    const st = statusOf(s.units)
                    return (
                      <tr
                        key={s.group}
                        className={`hover:bg-surface-container-low/50 transition-colors ${
                          st === 'critical' ? 'bg-error-container/20' : ''
                        }`}
                      >
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-10 h-10 rounded-full flex items-center justify-center font-badge-blood-group text-badge-blood-group ${
                                st === 'critical'
                                  ? 'bg-primary-container text-on-primary'
                                  : 'bg-primary-fixed text-primary'
                              }`}
                            >
                              {s.group}
                            </div>
                            <span className="font-label-md text-label-md text-on-surface">
                              {groupName(s.group)}
                            </span>
                          </div>
                        </td>
                        <td
                          className={`py-3 px-3 font-title-md text-title-md ${
                            st === 'critical' ? 'text-error' : 'text-on-surface'
                          }`}
                        >
                          {s.units}{' '}
                          <span className="font-body-sm text-body-sm text-secondary font-normal">units</span>
                        </td>
                        <td className="py-3 px-3">
                          <div className="w-full bg-surface-container h-2 rounded-full overflow-hidden">
                            <div
                              className={`${STATUS[st].bar} h-full rounded-full`}
                              style={{ width: `${Math.min(100, (s.units / BAR_FULL) * 100)}%` }}
                            ></div>
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full font-label-sm text-label-sm ${STATUS[st].pill}`}
                          >
                            {STATUS[st].label}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-body-sm text-body-sm text-secondary whitespace-nowrap">
                          {s.updated_at ? relTime(new Date(s.updated_at)) : 'Not set yet'}
                        </td>
                        <td className="py-3 px-3 text-right">
                          <button
                            type="button"
                            onClick={() => setModal({ type: 'stock', group: s.group })}
                            className={`px-3 py-1.5 rounded-lg font-label-sm text-label-sm transition-colors cursor-pointer ${
                              st === 'critical'
                                ? 'bg-primary text-on-primary hover:bg-primary-container shadow-sm'
                                : 'bg-surface-container-high text-on-surface hover:bg-secondary-container'
                            }`}
                          >
                            Update
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <p className="mt-3 font-body-sm text-[12px] text-secondary">
              Bars show stock against {BAR_FULL} units.
            </p>
          </div>

          {/* Donor list */}
          <div className="bg-surface-container-lowest rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-2">
              <h2 className="font-headline-sm text-headline-sm text-on-surface">Donor list</h2>
              <span className="px-2.5 py-0.5 text-label-sm font-label-sm rounded-full bg-surface-container text-on-surface-variant font-semibold">
                {shownDonors.length} of {donors.length} donors
              </span>
            </div>
            <p className="font-body-sm text-body-sm text-secondary mb-4">
              Registered donors in {me.city} appear here. Mark a donor Active once you have verified
              them.
            </p>
            <div className="mb-5 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-container-low text-secondary font-body-sm text-body-sm">
              <span className="material-symbols-outlined text-[16px] text-tertiary">lock</span>
              <span>Phone shared after a donor accepts a request</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 mb-6">
              <div className="sm:col-span-5 relative">
                <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[18px] text-secondary">
                  search
                </span>
                <input
                  type="text"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  aria-label="Search donors"
                  placeholder="Search by name, area or ID"
                  className="w-full pl-10 pr-4 py-2 bg-surface-container-low rounded-lg font-body-md text-body-md text-on-surface placeholder:text-secondary focus:outline-none focus:ring-2 focus:ring-primary-container"
                />
              </div>
              <div className="sm:col-span-3">
                <select
                  aria-label="Filter by blood group"
                  value={fGroup}
                  onChange={(e) => setFGroup(e.target.value)}
                  className={filterSelect}
                >
                  <option value="all">All blood groups</option>
                  {ALL_GROUPS.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <select
                  aria-label="Filter by eligibility"
                  value={fElig}
                  onChange={(e) => setFElig(e.target.value)}
                  className={filterSelect}
                >
                  <option value="all">All eligibility</option>
                  <option value="eligible">Eligible</option>
                  <option value="not">Not yet eligible</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <select
                  aria-label="Filter by status"
                  value={fStatus}
                  onChange={(e) => setFStatus(e.target.value)}
                  className={filterSelect}
                >
                  <option value="all">All status</option>
                  <option value="active">Active</option>
                  <option value="offline">Offline</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left">
                <thead>
                  <tr className="text-label-sm font-label-sm text-secondary uppercase tracking-wider bg-surface-container-low/70">
                    <th className="py-2.5 px-3 rounded-l-lg">Donor</th>
                    <th className="py-2.5 px-3">Blood</th>
                    <th className="py-2.5 px-3">Area</th>
                    <th className="py-2.5 px-3">Last donation</th>
                    <th className="py-2.5 px-3">Eligibility</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3 text-right rounded-r-lg">Contact</th>
                  </tr>
                </thead>
                <tbody>
                  {shownDonors.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-10 text-center font-body-md text-body-md text-secondary">
                        {donors.length === 0
                          ? `No donors have registered in ${me.city} yet.`
                          : 'No donors match your filters.'}
                      </td>
                    </tr>
                  ) : (
                    shownDonors.map((d) => (
                      <tr key={d.id} className="hover:bg-surface-container-low/50 transition-colors">
                        <td className="py-3.5 px-3">
                          <div className="font-title-md text-title-md text-on-surface">{d.name}</div>
                          <div className="font-body-sm text-body-sm text-secondary">ID: {d.code}</div>
                        </td>
                        <td className="py-3.5 px-3">
                          <span
                            className={`inline-flex items-center justify-center w-8 h-8 rounded-full font-badge-blood-group text-[12px] ${
                              d.blood_group === 'O-'
                                ? 'bg-primary-container text-on-primary'
                                : 'bg-primary-fixed text-primary'
                            }`}
                          >
                            {d.blood_group}
                          </span>
                        </td>
                        <td className="py-3.5 px-3 text-secondary">{d.area}</td>
                        <td className="py-3.5 px-3 text-secondary whitespace-nowrap">
                          {d.never_donated || !d.last_donation ? 'Never' : formatDate(d.last_donation)}
                        </td>
                        <td className="py-3.5 px-3">
                          {d.eligible ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full font-label-sm text-label-sm bg-tertiary-fixed text-on-tertiary-fixed font-semibold">
                              Eligible
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full font-label-sm text-label-sm bg-secondary-fixed text-on-secondary-fixed whitespace-nowrap">
                              Not yet ({d.days_left}d)
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-3">
                          <label className="relative inline-flex items-center cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={d.active}
                              disabled={busy}
                              onChange={() => toggleDonor(d)}
                              aria-label={`${d.name} is ${d.active ? 'active' : 'offline'}`}
                              className="sr-only peer"
                            />
                            <div className="w-9 h-5 bg-surface-container-highest rounded-full peer peer-checked:bg-tertiary-container after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full peer-focus-visible:ring-2 peer-focus-visible:ring-primary-container"></div>
                            <span
                              className={`ml-2 font-label-sm text-label-sm ${
                                d.active ? 'text-on-surface' : 'text-secondary'
                              }`}
                            >
                              {d.active ? 'Active' : 'Offline'}
                            </span>
                          </label>
                        </td>
                        <td className="py-3.5 px-3 text-right">
                          {d.phone ? (
                            <a
                              href={`tel:${d.phone}`}
                              title={`Call ${d.phone}`}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-tertiary-fixed text-on-tertiary-fixed font-label-sm text-label-sm font-semibold hover:opacity-90"
                            >
                              <span className="material-symbols-outlined text-[16px]">call</span>
                              {d.phone}
                            </a>
                          ) : (
                            <button
                              type="button"
                              disabled
                              title="Phone shared after the donor accepts a request"
                              className="w-8 h-8 rounded-lg bg-surface-container inline-flex items-center justify-center text-outline cursor-not-allowed"
                            >
                              <span className="material-symbols-outlined text-[16px]">lock</span>
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* RIGHT */}
        <div className="lg:col-span-4 flex flex-col gap-6 min-w-0">
          {/* Open requests */}
          <div className="bg-surface-container-lowest rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <h2 className="font-headline-sm text-headline-sm text-on-surface">Open requests</h2>
                <span className="min-w-5 h-5 px-1 rounded-full bg-primary text-on-primary text-xs flex items-center justify-center font-bold">
                  {requests.length}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setModal({ type: 'request' })}
                className="text-primary hover:text-primary-container font-label-sm text-label-sm flex items-center gap-1 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">add</span> New
              </button>
            </div>

            {requests.length === 0 ? (
              <p className="font-body-md text-body-md text-secondary">
                No open requests. Use Post urgent request when you need blood.
              </p>
            ) : (
              <div className="space-y-4">
                {requests.map((r) => {
                  const u = URGENCY[r.urgency]
                  const n = r.response_count
                  return (
                    <div key={r.id} className="bg-surface-container-low rounded-xl p-4 flex flex-col gap-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={`w-11 h-11 rounded-full flex items-center justify-center font-badge-blood-group text-[16px] shadow-sm shrink-0 ${
                              r.urgency === 'critical'
                                ? 'bg-primary-container text-on-primary'
                                : 'bg-primary-fixed text-primary'
                            }`}
                          >
                            {r.blood_group}
                          </div>
                          <div className="min-w-0">
                            <div className="font-title-md text-[16px] leading-5 font-semibold text-on-surface">
                              {r.units} unit{r.units === 1 ? '' : 's'} • {r.component}
                            </div>
                            <div className="font-body-sm text-body-sm text-secondary">
                              Posted {relTime(new Date(r.created_at)).toLowerCase()} • needed by{' '}
                              {neededBy(r.required_by)}
                            </div>
                          </div>
                        </div>
                        <span
                          className={`px-2.5 py-0.5 rounded-full font-label-sm text-label-sm shrink-0 ${u.pill}`}
                        >
                          {u.label}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        {n > 0 && (
                          <div className="flex -space-x-2">
                            {r.responders.slice(0, 3).map((p) => (
                              <div
                                key={p.response_id}
                                className="w-6 h-6 rounded-full bg-surface-container-highest border-2 border-surface-container-lowest flex items-center justify-center text-[10px] font-bold text-on-surface"
                              >
                                {initials(p.name)}
                              </div>
                            ))}
                            {n > 3 && (
                              <div className="w-6 h-6 rounded-full bg-secondary-fixed border-2 border-surface-container-lowest flex items-center justify-center text-[10px] font-bold text-secondary">
                                +{n - 3}
                              </div>
                            )}
                          </div>
                        )}
                        <span className="font-body-sm text-body-sm text-on-surface font-medium">
                          {n === 0 ? 'No responses yet' : `${n} donor${n === 1 ? '' : 's'} responded`}
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-2 flex-wrap bg-surface-container-lowest/60 rounded-lg p-2">
                        <button
                          type="button"
                          onClick={() => setModal({ type: 'responses', id: r.id })}
                          className="text-primary hover:underline font-label-sm text-label-sm font-semibold cursor-pointer"
                        >
                          View responses
                        </button>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => fulfil(r)}
                            className="text-tertiary hover:underline font-label-sm text-label-sm cursor-pointer disabled:opacity-50"
                          >
                            Mark fulfilled
                          </button>
                          <span className="text-secondary text-xs">•</span>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => cancelRequest(r)}
                            className="text-secondary hover:text-error font-label-sm text-label-sm cursor-pointer disabled:opacity-50"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Recent activity */}
          <div className="bg-surface-container-lowest rounded-2xl p-6 shadow-sm">
            <h2 className="font-headline-sm text-headline-sm text-on-surface mb-4">Recent activity</h2>
            {activity.length === 0 ? (
              <p className="font-body-md text-body-md text-secondary">
                Nothing yet. Stock updates, requests and donations will show up here.
              </p>
            ) : (
              <div className="space-y-4">
                {activity.map((a) => (
                  <div key={a.id} className="flex items-start gap-3">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                        TONE[a.tone] || TONE.neutral
                      }`}
                    >
                      <span className="material-symbols-outlined text-[16px]">{a.icon}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-body-md text-body-md text-on-surface leading-tight">{a.text}</div>
                      <div className="font-body-sm text-body-sm text-secondary">
                        {relTime(new Date(a.created_at))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Camps */}
          <div className="bg-surface-container-lowest rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-headline-sm text-headline-sm text-on-surface">Donation camps</h2>
              <span className="material-symbols-outlined text-secondary text-[20px]">event</span>
            </div>

            {nextCamp ? (
              <div className="bg-surface-container-low rounded-xl p-4 mb-4">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="font-title-md text-title-md text-on-surface font-semibold">
                    {nextCamp.title}
                  </div>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => cancelCamp(nextCamp)}
                    className="font-label-sm text-label-sm text-secondary hover:text-error shrink-0 cursor-pointer disabled:opacity-50"
                  >
                    Cancel camp
                  </button>
                </div>
                <div className="flex items-center gap-1.5 font-body-sm text-body-sm text-secondary mb-1">
                  <span className="material-symbols-outlined text-[16px]">schedule</span>
                  <span>
                    {formatDate(nextCamp.camp_date)} • {formatTime(nextCamp.start_time)} –{' '}
                    {formatTime(nextCamp.end_time)}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 font-body-sm text-body-sm text-secondary mb-3">
                  <span className="material-symbols-outlined text-[16px]">pin_drop</span>
                  <span>{nextCamp.venue}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 bg-surface-container-lowest/80 rounded-lg p-2.5">
                  <div>
                    <div className="font-body-sm text-body-sm text-secondary">Target</div>
                    <div className="font-title-md text-title-md text-on-surface font-bold">
                      {nextCamp.target_units} units
                    </div>
                  </div>
                  <div>
                    <div className="font-body-sm text-body-sm text-secondary">Registered</div>
                    <div className="font-title-md text-title-md text-tertiary font-bold">
                      {nextCamp.registered} donor{nextCamp.registered === 1 ? '' : 's'}
                    </div>
                  </div>
                </div>
                {camps.length > 1 && (
                  <p className="mt-3 font-body-sm text-[12px] text-secondary">
                    +{camps.length - 1} more upcoming camp{camps.length - 1 === 1 ? '' : 's'}
                  </p>
                )}
              </div>
            ) : (
              <p className="font-body-md text-body-md text-secondary mb-4">
                No upcoming camps. Create one and donors in {me.city} can register.
              </p>
            )}

            <button
              type="button"
              onClick={() => setModal({ type: 'camp' })}
              className="w-full py-2.5 px-4 rounded-full bg-surface-container-high text-on-surface hover:bg-secondary-container font-label-md text-label-md transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">add_circle</span>
              <span>Create camp</span>
            </button>
          </div>
        </div>
      </div>

      {/* Modals */}
      {modal?.type === 'stock' && stockItem && (
        <UpdateStockModal item={stockItem} onSave={saveStock} onClose={closeModal} />
      )}
      {modal?.type === 'request' && <PostRequestModal onSave={postRequest} onClose={closeModal} />}
      {modal?.type === 'record' && (
        <RecordDonationModal
          donors={donors}
          initialDonorId={modal.donorId}
          responseId={modal.responseId}
          onSave={recordDonation}
          onClose={closeModal}
        />
      )}
      {modal?.type === 'camp' && <CreateCampModal onSave={createCamp} onClose={closeModal} />}
      {modal?.type === 'responses' && respReq && (
        <Modal
          title={`Responses: ${respReq.blood_group} request`}
          subtitle={`${respReq.units} unit${respReq.units === 1 ? '' : 's'} • ${respReq.component}`}
          leading={
            <div className="w-10 h-10 rounded-full bg-primary-container text-on-primary flex items-center justify-center font-badge-blood-group text-[16px] shrink-0">
              {respReq.blood_group}
            </div>
          }
          onClose={closeModal}
        >
          {respReq.responders.length === 0 ? (
            <p className="font-body-md text-body-md text-secondary">
              No donors have responded yet. Responses appear here as donors accept.
            </p>
          ) : (
            <ul className="divide-y divide-surface-container-high">
              {respReq.responders.map((p) => (
                <li key={p.response_id} className="py-3 flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-surface-container-highest flex items-center justify-center text-[12px] font-bold text-on-surface shrink-0">
                      {initials(p.name)}
                    </div>
                    <div className="min-w-0">
                      <div className="font-label-md text-label-md font-semibold text-on-surface">
                        {p.name}
                      </div>
                      <div className="font-body-sm text-body-sm text-secondary flex items-center gap-2 flex-wrap">
                        <span>{p.area}</span>
                        <span>•</span>
                        <a href={`tel:${p.phone}`} className="text-primary hover:underline font-medium">
                          {p.phone}
                        </a>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {p.status === 'completed' ? (
                      <span className="px-2.5 py-0.5 rounded-full bg-tertiary-fixed text-on-tertiary-fixed font-label-sm text-label-sm font-semibold">
                        Donated
                      </span>
                    ) : (
                      <>
                        {p.status === 'accepted' ? (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => confirmResponse(respReq, p)}
                            className="px-3 py-1.5 rounded-full bg-surface-container-high hover:bg-secondary-container text-on-surface font-label-sm text-label-sm font-semibold cursor-pointer disabled:opacity-50"
                          >
                            Confirm
                          </button>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 font-label-sm text-label-sm font-semibold">
                            Confirmed
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() =>
                            setModal({ type: 'record', donorId: p.donor_id, responseId: p.response_id })
                          }
                          className="px-3 py-1.5 rounded-full bg-primary-container hover:bg-primary text-on-primary font-label-sm text-label-sm font-semibold cursor-pointer"
                        >
                          Record donation
                        </button>
                      </>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-4 font-body-sm text-body-sm text-secondary">
            Contact details are shown because these donors accepted your request.
          </p>
        </Modal>
      )}

      {/* Toast */}
      {toast && (
        <div
          role="status"
          className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[70] max-w-[calc(100vw-2rem)] px-5 py-3 rounded-full shadow-xl font-label-md text-label-md flex items-center gap-2 ${
            toast.error
              ? 'bg-error text-on-error'
              : 'bg-inverse-surface text-inverse-on-surface'
          }`}
        >
          <span
            className={`material-symbols-outlined text-[18px] ${
              toast.error ? '' : 'text-tertiary-fixed-dim'
            }`}
          >
            {toast.error ? 'error' : 'check_circle'}
          </span>
          <span>{toast.text}</span>
        </div>
      )}
    </div>
  )
}