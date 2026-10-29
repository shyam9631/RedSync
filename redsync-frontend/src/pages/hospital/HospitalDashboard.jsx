import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import Modal from '../../components/ui/Modal'
import { UpdateStockModal, PostRequestModal, RecordDonationModal } from './HospitalModals'
import { getEligibility, formatDate } from '../../data/donorDemo'
import {
  ALL_GROUPS,
  SAMPLE_HOSPITAL,
  LOW_AT,
  CRITICAL_AT,
  BAR_FULL,
  statusOf,
  buildStock,
  buildDonors,
  buildRequests,
  buildActivity,
  buildHospitalCamp,
  daysUntil,
  relTime,
  initials,
  shortName,
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

export default function HospitalDashboard() {
  const { user } = useAuth()
  const code = user?.facilityCode || SAMPLE_HOSPITAL.code

  const [stock, setStock] = useState(buildStock)
  const [donors, setDonors] = useState(buildDonors)
  const [requests, setRequests] = useState(buildRequests)
  const [activity, setActivity] = useState(buildActivity)
  const [camp] = useState(buildHospitalCamp)
  const [modal, setModal] = useState(null)
  const [toast, setToast] = useState('')

  const [q, setQ] = useState('')
  const [fGroup, setFGroup] = useState('all')
  const [fElig, setFElig] = useState('all')
  const [fStatus, setFStatus] = useState('all')

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(''), 3500)
    return () => clearTimeout(t)
  }, [toast])

  const closeModal = () => setModal(null)

  const addActivity = (icon, tone, text) =>
    setActivity((list) =>
      [{ id: `${Date.now()}-${Math.random()}`, icon, tone, text, at: new Date() }, ...list].slice(0, 8)
    )

  /* ---------- derived numbers ---------- */
  const totalUnits = stock.reduce((sum, i) => sum + i.units, 0)
  const lowItems = stock.filter((i) => statusOf(i.units) !== 'available')
  const criticalCount = lowItems.filter((i) => statusOf(i.units) === 'critical').length
  const activeDonors = donors.filter((d) => d.active)
  const eligibleActive = activeDonors.filter((d) => getEligibility(d).eligible).length
  const responseCount = requests.reduce((sum, r) => sum + r.responders.length, 0)
  const expiring = stock.filter((i) => i.expiry && daysUntil(i.expiry) <= 3)

  const shownDonors = donors.filter((d) => {
    const term = q.trim().toLowerCase()
    if (term && !(d.name.toLowerCase().includes(term) || d.area.toLowerCase().includes(term) || d.code.toLowerCase().includes(term)))
      return false
    if (fGroup !== 'all' && d.group !== fGroup) return false
    const elig = getEligibility(d).eligible
    if (fElig === 'eligible' && !elig) return false
    if (fElig === 'not' && elig) return false
    if (fStatus === 'active' && !d.active) return false
    if (fStatus === 'offline' && d.active) return false
    return true
  })

  /* ---------- actions ---------- */
  const saveStock = ({ group, units, expiry }) => {
    setStock((list) =>
      list.map((i) =>
        i.group === group
          ? { ...i, units, expiry: expiry || i.expiry, updatedAt: new Date() }
          : i
      )
    )
    addActivity('autorenew', 'neutral', `Stock updated: ${group} (${units} unit${units === 1 ? '' : 's'})`)
    setToast(`Stock updated for ${group}.`)
    closeModal()
  }

  const postRequest = (r) => {
    setRequests((list) => [
      { id: `q${Date.now()}`, ...r, postedAt: new Date(), responders: [] },
      ...list,
    ])
    addActivity(
      'campaign',
      'alert',
      `Request posted: ${r.group} ${r.units} unit${r.units === 1 ? '' : 's'} ${r.component}`
    )
    setToast('Request posted. In demo mode no donors are notified yet.')
    closeModal()
  }

  const recordDonation = ({ donorId, date, component, units }) => {
    const donor = donors.find((d) => d.id === donorId)
    setDonors((list) =>
      list.map((d) =>
        d.id === donorId ? { ...d, lastDonation: date, neverDonated: false } : d
      )
    )
    setStock((list) =>
      list.map((i) =>
        i.group === donor.group ? { ...i, units: i.units + units, updatedAt: new Date() } : i
      )
    )
    addActivity('check_circle', 'good', `Donation recorded: ${donor.group} ${component} from ${shortName(donor.name)}`)
    setToast(`Donation recorded for ${donor.name}.`)
    closeModal()
  }

  const toggleDonor = (id) => {
    const donor = donors.find((d) => d.id === id)
    const nextActive = !donor.active
    setDonors((list) => list.map((d) => (d.id === id ? { ...d, active: nextActive } : d)))
    addActivity(
      'verified_user',
      'neutral',
      nextActive
        ? `Donor marked Active: ${shortName(donor.name)}`
        : `Donor set to Offline: ${shortName(donor.name)}`
    )
  }

  const fulfil = (r) => {
    setRequests((list) => list.filter((x) => x.id !== r.id))
    addActivity('task_alt', 'good', `Request fulfilled: ${r.group} ${r.units} unit${r.units === 1 ? '' : 's'}`)
    setToast('Request marked as fulfilled.')
  }

  const cancelRequest = (r) => {
    if (!window.confirm(`Cancel the ${r.group} request?`)) return
    setRequests((list) => list.filter((x) => x.id !== r.id))
    addActivity('cancel', 'neutral', `Request cancelled: ${r.group} ${r.units} unit${r.units === 1 ? '' : 's'}`)
    setToast('Request cancelled.')
  }

  const stockItem = modal?.type === 'stock' ? stock.find((s) => s.group === modal.group) : null
  const respReq = modal?.type === 'responses' ? requests.find((r) => r.id === modal.id) : null

  return (
    <div className="flex flex-col w-full pb-8">
      <div className="mb-6 flex items-start gap-2.5 rounded-xl bg-surface-container px-4 py-3 text-on-surface-variant">
        <span className="material-symbols-outlined text-[20px] text-primary shrink-0">info</span>
        <p className="font-body-sm text-body-sm">
          Demo mode: stock, donors and requests below are sample data. Your changes reset when you
          refresh the page.
        </p>
      </div>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-space-md mb-8">
        <div className="flex flex-wrap items-center gap-space-sm sm:gap-space-md">
          <h1 className="font-headline-lg text-headline-lg-mobile sm:text-headline-lg text-on-surface tracking-tight">
            {SAMPLE_HOSPITAL.name}
          </h1>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 font-mono text-label-sm text-secondary bg-surface-container rounded-full">
            <span className="w-2 h-2 rounded-full bg-tertiary"></span>
            Facility code: {code}
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
                          {relTime(s.updatedAt)}
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
              Donors who chose your hospital or live in your area appear here. Mark a donor Active once
              you have verified them.
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
                        No donors match your filters.
                      </td>
                    </tr>
                  ) : (
                    shownDonors.map((d) => {
                      const elig = getEligibility(d)
                      return (
                        <tr key={d.id} className="hover:bg-surface-container-low/50 transition-colors">
                          <td className="py-3.5 px-3">
                            <div className="font-title-md text-title-md text-on-surface">{d.name}</div>
                            <div className="font-body-sm text-body-sm text-secondary">ID: {d.code}</div>
                          </td>
                          <td className="py-3.5 px-3">
                            <span
                              className={`inline-flex items-center justify-center w-8 h-8 rounded-full font-badge-blood-group text-[12px] ${
                                d.group === 'O-'
                                  ? 'bg-primary-container text-on-primary'
                                  : 'bg-primary-fixed text-primary'
                              }`}
                            >
                              {d.group}
                            </span>
                          </td>
                          <td className="py-3.5 px-3 text-secondary">{d.area}</td>
                          <td className="py-3.5 px-3 text-secondary whitespace-nowrap">
                            {d.neverDonated || !d.lastDonation ? 'Never' : formatDate(d.lastDonation)}
                          </td>
                          <td className="py-3.5 px-3">
                            {elig.eligible ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full font-label-sm text-label-sm bg-tertiary-fixed text-on-tertiary-fixed font-semibold">
                                Eligible
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full font-label-sm text-label-sm bg-secondary-fixed text-on-secondary-fixed whitespace-nowrap">
                                Not yet ({elig.daysLeft}d)
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-3">
                            <label className="relative inline-flex items-center cursor-pointer select-none">
                              <input
                                type="checkbox"
                                checked={d.active}
                                onChange={() => toggleDonor(d.id)}
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
                            <button
                              type="button"
                              disabled
                              title="Phone shared after the donor accepts a request"
                              className="w-8 h-8 rounded-lg bg-surface-container inline-flex items-center justify-center text-outline cursor-not-allowed"
                            >
                              <span className="material-symbols-outlined text-[16px]">lock</span>
                            </button>
                          </td>
                        </tr>
                      )
                    })
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
                  const n = r.responders.length
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
                            {r.group}
                          </div>
                          <div className="min-w-0">
                            <div className="font-title-md text-[16px] leading-5 font-semibold text-on-surface">
                              {r.units} unit{r.units === 1 ? '' : 's'} • {r.component}
                            </div>
                            <div className="font-body-sm text-body-sm text-secondary">
                              Posted {relTime(r.postedAt).toLowerCase()}
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
                                key={p.name}
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
                            onClick={() => fulfil(r)}
                            className="text-tertiary hover:underline font-label-sm text-label-sm cursor-pointer"
                          >
                            Mark fulfilled
                          </button>
                          <span className="text-secondary text-xs">•</span>
                          <button
                            type="button"
                            onClick={() => cancelRequest(r)}
                            className="text-secondary hover:text-error font-label-sm text-label-sm cursor-pointer"
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
            <div className="space-y-4">
              {activity.map((a) => (
                <div key={a.id} className="flex items-start gap-3">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${TONE[a.tone]}`}
                  >
                    <span className="material-symbols-outlined text-[16px]">{a.icon}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-body-md text-body-md text-on-surface leading-tight">{a.text}</div>
                    <div className="font-body-sm text-body-sm text-secondary">{relTime(a.at)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Camps */}
          <div className="bg-surface-container-lowest rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-headline-sm text-headline-sm text-on-surface">Donation camps</h2>
              <span className="material-symbols-outlined text-secondary text-[20px]">event</span>
            </div>
            <div className="bg-surface-container-low rounded-xl p-4 mb-4">
              <div className="font-title-md text-title-md text-on-surface font-semibold mb-1">
                {camp.title}
              </div>
              <div className="flex items-center gap-1.5 font-body-sm text-body-sm text-secondary mb-1">
                <span className="material-symbols-outlined text-[16px]">schedule</span>
                <span>
                  {formatDate(camp.date)} • {camp.time}
                </span>
              </div>
              <div className="flex items-center gap-1.5 font-body-sm text-body-sm text-secondary mb-3">
                <span className="material-symbols-outlined text-[16px]">pin_drop</span>
                <span>{camp.venue}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 bg-surface-container-lowest/80 rounded-lg p-2.5">
                <div>
                  <div className="font-body-sm text-body-sm text-secondary">Target</div>
                  <div className="font-title-md text-title-md text-on-surface font-bold">
                    {camp.target} units
                  </div>
                </div>
                <div>
                  <div className="font-body-sm text-body-sm text-secondary">Registered</div>
                  <div className="font-title-md text-title-md text-tertiary font-bold">
                    {camp.registered} donors
                  </div>
                </div>
              </div>
            </div>
            <Link
              to="/hospital/camps"
              className="w-full py-2.5 px-4 rounded-full bg-surface-container-high text-on-surface hover:bg-secondary-container font-label-md text-label-md transition-colors flex items-center justify-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[18px]">add_circle</span>
              <span>Create camp</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Modals */}
      {modal?.type === 'stock' && stockItem && (
        <UpdateStockModal item={stockItem} onSave={saveStock} onClose={closeModal} />
      )}
      {modal?.type === 'request' && <PostRequestModal onSave={postRequest} onClose={closeModal} />}
      {modal?.type === 'record' && (
        <RecordDonationModal donors={donors} onSave={recordDonation} onClose={closeModal} />
      )}
      {modal?.type === 'responses' && respReq && (
        <Modal
          title={`Responses: ${respReq.group} request`}
          subtitle={`${respReq.units} unit${respReq.units === 1 ? '' : 's'} • ${respReq.component}`}
          leading={
            <div className="w-10 h-10 rounded-full bg-primary-container text-on-primary flex items-center justify-center font-badge-blood-group text-[16px] shrink-0">
              {respReq.group}
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
                <li key={p.name} className="py-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-surface-container-highest flex items-center justify-center text-[12px] font-bold text-on-surface shrink-0">
                      {initials(p.name)}
                    </div>
                    <div className="min-w-0">
                      <div className="font-label-md text-label-md font-semibold text-on-surface">
                        {p.name}
                      </div>
                      <div className="font-body-sm text-body-sm text-secondary">
                        {p.distanceKm} km away
                      </div>
                    </div>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full bg-tertiary-fixed text-on-tertiary-fixed font-label-sm text-label-sm font-semibold">
                    Accepted
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-4 font-body-sm text-body-sm text-secondary">
            In the full version, each donor's contact details appear here after they accept.
          </p>
        </Modal>
      )}

      {/* Toast */}
      {toast && (
        <div
          role="status"
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[70] max-w-[calc(100vw-2rem)] bg-inverse-surface text-inverse-on-surface px-5 py-3 rounded-full shadow-xl font-label-md text-label-md flex items-center gap-2"
        >
          <span className="material-symbols-outlined text-[18px] text-tertiary-fixed-dim">check_circle</span>
          <span>{toast}</span>
        </div>
      )}
    </div>
  )
}