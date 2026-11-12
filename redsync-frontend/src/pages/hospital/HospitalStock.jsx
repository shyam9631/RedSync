import { useCallback, useEffect, useState } from 'react'
import api, { errorMessage } from '../../lib/api'
import Modal from '../../components/ui/Modal'
import { Field, ErrorText, inputClass } from '../../components/forms/FormBits'
import { PostRequestModal } from './HospitalModals'
import { ALL_GROUPS, COMPONENTS, localISO, relTime } from '../../data/hospitalDemo'
import { formatDate } from '../../data/donorDemo'

const REFRESH_MS = 60000

const COMPONENT_SHORT = {
  'Whole Blood': 'Whole Blood',
  'Packed Red Cells': 'Red Cells',
  Platelets: 'Platelets',
  Plasma: 'Plasma',
}

const REASONS = {
  inward: ['Blood camp batch', 'Walk-in donor', 'Transfer from partner bank', 'Emergency inward', 'Other'],
  outward: ['Issued to patient', 'Issued to OT / ICU', 'Transfer to partner bank', 'Other'],
  discard: ['Expired', 'Quality check failed', 'Damaged / bag leak', 'Other'],
}

const MODE = {
  inward: { title: 'Add stock', icon: 'add_circle', save: 'Add to stock', hint: 'Record a new batch of blood.' },
  outward: { title: 'Issue stock', icon: 'send', save: 'Issue units', hint: 'Units leaving for a patient, ward or another bank.' },
  discard: { title: 'Discard units', icon: 'delete_forever', save: 'Discard units', hint: 'Expired, damaged or failed quality checks.' },
}

const STATUS = {
  available: { label: 'OPTIMAL', pill: 'bg-tertiary-container/20 text-tertiary', bar: 'bg-tertiary-container', circle: 'bg-surface-container-highest text-primary' },
  low: { label: 'LOW', pill: 'bg-amber-100 text-amber-800', bar: 'bg-amber-500', circle: 'bg-amber-100 text-amber-900' },
  critical: { label: 'CRITICAL', pill: 'bg-error text-on-error', bar: 'bg-error', circle: 'bg-primary-container text-on-primary' },
}

const KIND = {
  inward: { label: 'Stock in', tone: 'text-tertiary bg-tertiary-container/15' },
  outward: { label: 'Issued', tone: 'text-error bg-error-container' },
  discard: { label: 'Discarded', tone: 'text-error bg-error-container' },
  adjust: { label: 'Corrected', tone: 'text-on-surface-variant bg-surface-container-high' },
}

const addDays = (n) => {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return localISO(d)
}

function expiryLabel(hours) {
  if (hours < 0) return 'Expired'
  if (hours < 24) return `Expires in ${Math.max(1, hours)} hr`
  const days = Math.ceil(hours / 24)
  return days === 1 ? 'Expires tomorrow' : `Expires in ${days} days`
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

const selectClass =
  'w-full h-12 px-3 bg-surface-container-low rounded-xl font-body-md text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-container'

/* ---------- Add / issue / discard dialog ---------- */
function StockModal({ mode, hospitalName, groups, shelfDays, preset, onSave, onClose }) {
  const [group, setGroup] = useState(preset.group || '')
  const [component, setComponent] = useState(preset.component || COMPONENTS[1])
  const [units, setUnits] = useState('1')
  const [reason, setReason] = useState(preset.reason || REASONS[mode][0])
  const [expiry, setExpiry] = useState(addDays(shelfDays[preset.component || COMPONENTS[1]] || 35))
  const [expiryTouched, setExpiryTouched] = useState(false)
  const [batchCode, setBatchCode] = useState('')
  const [storage, setStorage] = useState('')
  const [note, setNote] = useState('')
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [today] = useState(() => localISO(new Date()))
  const meta = MODE[mode]

  const clear = (k) => setErrors((e) => ({ ...e, [k]: undefined }))
  const info = groups.find((g) => g.group === group)
  const inStock = info ? info.components[component] + (info.unspecified || 0) : null

  const pickComponent = (c) => {
    setComponent(c)
    clear('component')
    // Fill in the usual shelf life, unless the user typed their own date
    if (!expiryTouched) setExpiry(addDays(shelfDays[c] || 35))
  }

  const submit = async (e) => {
    e.preventDefault()
    const er = {}
    const n = Number(units)
    if (!group) er.group = 'Select a blood group.'
    if (!Number.isInteger(n) || n < 1 || n > 200) er.units = 'Enter between 1 and 200 units.'
    if (mode === 'inward') {
      if (!expiry) er.expiry = 'Enter the expiry date.'
      else if (expiry < today) er.expiry = 'The expiry date cannot be in the past.'
    }
    if (mode !== 'inward' && info && n > inStock && !er.units)
      er.units = `Only ${inStock} unit${inStock === 1 ? '' : 's'} of ${component} ${group} in stock.`
    setErrors(er)
    if (Object.keys(er).length) return

    const body = { blood_group: group, component, units: n, reason, note: note.trim() || undefined }
    if (mode === 'inward') {
      body.expiry_date = expiry
      body.batch_code = batchCode.trim() || undefined
      body.storage = storage.trim() || undefined
    }
    setSaving(true)
    setFormError('')
    try {
      await onSave(mode, body)
    } catch (err) {
      setFormError(errorMessage(err))
      setSaving(false)
    }
  }

  return (
    <Modal
      title={meta.title}
      subtitle={`${hospitalName} • ${meta.hint}`}
      leading={
        <div className="w-10 h-10 rounded-full bg-primary-fixed text-primary flex items-center justify-center shrink-0">
          <span className="material-symbols-outlined text-[22px]">{meta.icon}</span>
        </div>
      }
      onClose={onClose}
    >
      <form onSubmit={submit} noValidate className="space-y-5">
        <div>
          <span className="block font-label-md text-label-md text-on-surface mb-1.5">Blood group</span>
          <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
            {ALL_GROUPS.map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => {
                  setGroup(g)
                  clear('group')
                }}
                className={`py-2 rounded-xl font-bold font-label-md text-label-md cursor-pointer transition-colors ${
                  group === g
                    ? 'bg-primary-container text-on-primary shadow-sm'
                    : 'bg-surface-container-low text-on-surface hover:bg-surface-container'
                }`}
              >
                {g}
              </button>
            ))}
          </div>
          <ErrorText>{errors.group}</ErrorText>
        </div>

        <div>
          <span className="block font-label-md text-label-md text-on-surface mb-1.5">Component</span>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {COMPONENTS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => pickComponent(c)}
                className={`p-2 rounded-xl font-label-sm text-label-sm font-semibold text-center cursor-pointer transition-colors ${
                  component === c
                    ? 'bg-primary-fixed text-on-primary-fixed'
                    : 'bg-surface-container-low text-on-surface hover:bg-surface-container'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="st-units" className="block font-label-md text-label-md text-on-surface mb-1.5">
              Units
            </label>
            <div className={`flex items-center bg-surface-container-low rounded-xl p-1 ${errors.units ? 'ring-2 ring-error' : ''}`}>
              <button
                type="button"
                aria-label="One less"
                onClick={() => setUnits((u) => String(Math.max(1, (Number(u) || 1) - 1)))}
                className="w-10 h-10 rounded-lg bg-surface-container-lowest text-on-surface font-bold text-headline-sm hover:bg-surface-container-high cursor-pointer"
              >
                −
              </button>
              <input
                id="st-units"
                type="text"
                inputMode="numeric"
                value={units}
                onChange={(e) => {
                  setUnits(e.target.value.replace(/\D/g, '').slice(0, 3))
                  clear('units')
                }}
                className="w-full text-center bg-transparent font-headline-sm text-headline-sm text-on-surface focus:outline-none"
              />
              <button
                type="button"
                aria-label="One more"
                onClick={() => setUnits((u) => String(Math.min(200, (Number(u) || 0) + 1)))}
                className="w-10 h-10 rounded-lg bg-surface-container-lowest text-on-surface font-bold text-headline-sm hover:bg-surface-container-high cursor-pointer"
              >
                +
              </button>
            </div>
            {mode !== 'inward' && info && (
              <span className="font-body-sm text-body-sm text-secondary mt-1 block">
                In stock: {inStock} unit{inStock === 1 ? '' : 's'} of {component} {group}
              </span>
            )}
            <ErrorText>{errors.units}</ErrorText>
          </div>
          <Field label="Reason" htmlFor="st-reason">
            <select id="st-reason" value={reason} onChange={(e) => setReason(e.target.value)} className={selectClass}>
              {REASONS[mode].map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </Field>
        </div>

        {mode === 'inward' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Expiry date" htmlFor="st-expiry" required error={errors.expiry}>
              <input
                id="st-expiry"
                type="date"
                min={today}
                value={expiry}
                onChange={(e) => {
                  setExpiry(e.target.value)
                  setExpiryTouched(true)
                  clear('expiry')
                }}
                className={inputClass(errors.expiry)}
              />
              <span className="font-body-sm text-body-sm text-secondary mt-1 block">
                Filled in with the usual shelf life for {component}.
              </span>
            </Field>
            <Field label="Batch code" htmlFor="st-batch" optional>
              <input
                id="st-batch"
                type="text"
                maxLength={50}
                value={batchCode}
                onChange={(e) => setBatchCode(e.target.value)}
                placeholder="e.g. BLD-8942"
                className={inputClass(false)}
              />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Storage location" htmlFor="st-storage" optional>
                <input
                  id="st-storage"
                  type="text"
                  maxLength={80}
                  value={storage}
                  onChange={(e) => setStorage(e.target.value)}
                  placeholder="e.g. Cold room 1, Rack D"
                  className={inputClass(false)}
                />
              </Field>
            </div>
          </div>
        )}

        <Field label="Note" htmlFor="st-note" optional>
          <input
            id="st-note"
            type="text"
            maxLength={300}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={mode === 'outward' ? 'e.g. Ward, patient or bank it went to' : 'Anything worth remembering'}
            className={inputClass(false)}
          />
        </Field>

        {formError && (
          <div role="alert" className="flex items-start gap-2.5 rounded-xl bg-error-container px-4 py-3 text-on-error-container">
            <span className="material-symbols-outlined text-[20px] shrink-0">error</span>
            <p className="font-body-sm text-body-sm">{formError}</p>
          </div>
        )}

        <div className="flex items-center justify-end gap-3 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-full bg-surface-container hover:bg-surface-container-high text-on-surface font-label-md text-label-md transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className={`px-6 py-2.5 rounded-full text-on-primary font-label-md text-label-md shadow-sm transition-all flex items-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed ${
              mode === 'discard' ? 'bg-error hover:bg-on-error-container' : 'bg-primary-container hover:bg-primary'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">{meta.icon}</span>
            {saving ? 'Saving…' : meta.save}
          </button>
        </div>
      </form>
    </Modal>
  )
}

/* ---------- Target dialog ---------- */
function TargetModal({ item, onSave, onClose }) {
  const [value, setValue] = useState(String(item.target))
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    const n = Number(value)
    if (!Number.isInteger(n) || n < 1 || n > 2000) {
      setError('Enter a target between 1 and 2000 units.')
      return
    }
    setSaving(true)
    try {
      await onSave(item.group, n)
    } catch (err) {
      setError(errorMessage(err))
      setSaving(false)
    }
  }

  return (
    <Modal
      title={`Target for ${item.group}`}
      subtitle="The number of units you want to hold. Used for the progress bars."
      onClose={onClose}
    >
      <form onSubmit={submit} noValidate className="space-y-5">
        <Field label="Target units" htmlFor="tg-units" required error={error}>
          <input
            id="tg-units"
            type="text"
            inputMode="numeric"
            value={value}
            onChange={(e) => {
              setValue(e.target.value.replace(/\D/g, '').slice(0, 4))
              setError('')
            }}
            className={inputClass(error)}
          />
        </Field>
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-full bg-surface-container hover:bg-surface-container-high text-on-surface font-label-md text-label-md cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 rounded-full bg-primary-container hover:bg-primary text-on-primary font-label-md text-label-md shadow-sm cursor-pointer disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Save target'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

/* ---------- Ledger rows (used on the page and in the full audit dialog) ---------- */
function LedgerTable({ items }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-left border-collapse">
        <thead>
          <tr className="bg-surface-container-low text-secondary font-label-sm text-label-sm uppercase tracking-wider">
            <th className="py-3 px-3.5 rounded-l-xl">Component</th>
            <th className="py-3 px-3">Group</th>
            <th className="py-3 px-3">Transaction</th>
            <th className="py-3 px-3 text-right">Units</th>
            <th className="py-3 px-3">Time</th>
            <th className="py-3 px-3.5 rounded-r-xl">Recorded by</th>
          </tr>
        </thead>
        <tbody className="font-body-md text-body-md text-on-surface">
          {items.map((r) => {
            const k = KIND[r.kind] || KIND.adjust
            return (
              <tr key={r.id} className="hover:bg-surface-container-low/50 transition-colors">
                <td className="py-3 px-3.5">
                  <div className="font-semibold text-on-surface text-label-md font-label-md">
                    {r.component || 'Total'}
                  </div>
                  {r.batch_code && <span className="font-body-sm text-body-sm text-secondary">#{r.batch_code}</span>}
                </td>
                <td className="py-3 px-3">
                  <span className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-primary-fixed text-primary font-bold font-label-sm text-label-sm">
                    {r.blood_group}
                  </span>
                </td>
                <td className="py-3 px-3">
                  <span className="font-medium text-on-surface">{r.reason}</span>
                  <div className="font-body-sm text-body-sm text-secondary">{r.note || `Balance ${r.balance_after}`}</div>
                </td>
                <td className="py-3 px-3 text-right">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-md font-semibold font-body-sm text-body-sm ${k.tone}`}>
                    {r.delta > 0 ? '+' : ''}
                    {r.delta} unit{Math.abs(r.delta) === 1 ? '' : 's'}
                  </span>
                </td>
                <td className="py-3 px-3 font-body-sm text-body-sm text-secondary whitespace-nowrap">
                  {relTime(new Date(r.created_at))}
                </td>
                <td className="py-3 px-3.5 font-body-sm text-body-sm text-on-surface-variant">{r.recorded_by}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function LedgerModal({ onClose }) {
  const PAGE = 20
  const [kind, setKind] = useState('')
  const [group, setGroup] = useState('')
  const [items, setItems] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchPage = useCallback(
    async (offset) => {
      const res = await api.get('/hospital/stock/ledger', {
        params: { limit: PAGE, offset, kind: kind || undefined, group: group || undefined },
      })
      return res.data
    },
    [kind, group]
  )

  useEffect(() => {
    let alive = true
    fetchPage(0)
      .then((d) => {
        if (!alive) return
        setItems(d.items)
        setTotal(d.total)
        setError('')
      })
      .catch((err) => alive && setError(errorMessage(err)))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [fetchPage])

  const more = async () => {
    try {
      const d = await fetchPage(items.length)
      setItems((x) => [...x, ...d.items])
      setTotal(d.total)
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  const change = (setter) => (e) => {
    setLoading(true)
    setter(e.target.value)
  }

  return (
    <Modal title="Stock audit ledger" subtitle="Every change to your blood stock, newest first." onClose={onClose}>
      <div className="flex items-center gap-2 flex-wrap mb-4">
        <label htmlFor="lg-kind" className="sr-only">
          Transaction type
        </label>
        <select
          id="lg-kind"
          value={kind}
          onChange={change(setKind)}
          className="h-10 px-4 rounded-full bg-surface-container-low font-label-md text-label-md text-on-surface cursor-pointer"
        >
          <option value="">All transactions</option>
          <option value="inward">Stock in</option>
          <option value="outward">Issued</option>
          <option value="discard">Discarded</option>
          <option value="adjust">Corrections</option>
        </select>
        <label htmlFor="lg-group" className="sr-only">
          Blood group
        </label>
        <select
          id="lg-group"
          value={group}
          onChange={change(setGroup)}
          className="h-10 px-4 rounded-full bg-surface-container-low font-label-md text-label-md text-on-surface cursor-pointer"
        >
          <option value="">All groups</option>
          {ALL_GROUPS.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
        <span className="font-body-sm text-body-sm text-secondary ml-auto">{total} entries</span>
      </div>
      {error && <p className="text-error font-body-sm text-body-sm mb-2">{error}</p>}
      {loading ? (
        <p className="py-8 text-center text-secondary font-body-md text-body-md">Loading…</p>
      ) : items.length === 0 ? (
        <p className="py-8 text-center text-secondary font-body-md text-body-md">No entries match.</p>
      ) : (
        <>
          <LedgerTable items={items} />
          {items.length < total && (
            <div className="pt-4 text-center">
              <button
                type="button"
                onClick={more}
                className="px-5 py-2 rounded-full bg-surface-container hover:bg-surface-container-high text-on-surface font-label-md text-label-md cursor-pointer"
              >
                Show more
              </button>
            </div>
          )}
        </>
      )}
    </Modal>
  )
}

/* ---------- Page ---------- */
export default function HospitalStock() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [actionError, setActionError] = useState('')
  const [modal, setModal] = useState(null)
  const [toast, setToast] = useState(null)
  const [query, setQuery] = useState('')
  const [level, setLevel] = useState('all')
  const [comp, setComp] = useState('all')
  const [view, setView] = useState('grid')

  const load = useCallback(async ({ quiet = false } = {}) => {
    try {
      const res = await api.get('/hospital/stock/overview')
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
    const timer = setInterval(() => load({ quiet: true }), REFRESH_MS)
    return () => clearInterval(timer)
  }, [load])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3500)
    return () => clearTimeout(t)
  }, [toast])

  const closeModal = () => setModal(null)

  const saveStock = async (mode, body) => {
    await api.post(`/hospital/stock/${mode}`, body)
    await load({ quiet: true })
    closeModal()
    const word = { inward: 'added to', outward: 'issued from', discard: 'discarded from' }[mode]
    setToast({ text: `${body.units} unit${body.units === 1 ? '' : 's'} of ${body.blood_group} ${word} stock.` })
  }

  const saveTarget = async (group, target) => {
    await api.put(`/hospital/stock/${group}/target`, { target_units: target })
    await load({ quiet: true })
    closeModal()
    setToast({ text: `Target for ${group} set to ${target} units.` })
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
    closeModal()
    const n = res.data.notified
    setToast({ text: `Request posted. ${n} matching donor${n === 1 ? '' : 's'} notified.` })
  }

  const discardExpired = async () => {
    const n = data.summary.expired_units
    if (!window.confirm(`Discard ${n} expired unit${n === 1 ? '' : 's'}? This is recorded in the ledger.`)) return
    setActionError('')
    try {
      const res = await api.post('/hospital/stock/discard-expired')
      await load({ quiet: true })
      setToast({ text: `${res.data.discarded} expired unit${res.data.discarded === 1 ? '' : 's'} discarded.` })
    } catch (err) {
      setActionError(errorMessage(err))
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-secondary">
        <span className="material-symbols-outlined text-[32px] animate-spin">progress_activity</span>
        <p className="mt-3 font-body-md text-body-md">Loading blood stock…</p>
      </div>
    )
  }

  if (loadError || !data) {
    return (
      <div className="max-w-md mx-auto py-20 text-center">
        <div className="w-12 h-12 rounded-full bg-error-container text-error flex items-center justify-center mx-auto mb-3">
          <span className="material-symbols-outlined text-[24px]">cloud_off</span>
        </div>
        <h2 className="font-headline-sm text-headline-sm text-on-surface">Could not load blood stock</h2>
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

  const { hospital, summary, groups, expiring, expired, shelf_days: shelfDays, ledger_recent: recent, month } = data
  const q = query.trim().toLowerCase()
  const visible = groups.filter(
    (g) =>
      (level === 'all' || (level === 'attention' ? g.status !== 'available' : g.status === level)) &&
      (comp === 'all' || g.components[comp] > 0) &&
      (!q || g.group.toLowerCase().includes(q) || COMPONENTS.some((c) => c.toLowerCase().includes(q) && g.components[c] > 0))
  )
  const critical = groups.filter((g) => g.status === 'critical')
  const attention = groups.filter((g) => g.status !== 'available')
  const hasAlert = critical.length > 0 || summary.expiring_units > 0 || summary.expired_units > 0
  const openStock = (mode, preset = {}) => setModal({ type: 'stock', mode, preset })

  const exportCsv = () =>
    downloadCsv(
      'redsync-blood-stock.csv',
      ['Blood group', 'Units', 'Target', 'Status', ...COMPONENTS, 'Not specified', 'Expired units'],
      groups.map((g) => [g.group, g.units, g.target, g.status, ...COMPONENTS.map((c) => g.components[c]), g.unspecified, g.expired_units])
    )

  return (
    <div className="w-full flex flex-col gap-space-lg pb-8">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-space-md bg-surface-container-lowest p-space-lg rounded-[16px] shadow-sm">
        <div className="flex items-start md:items-center gap-space-md min-w-0">
          <div className="w-14 h-14 rounded-2xl bg-primary-fixed flex items-center justify-center text-primary shrink-0 shadow-sm">
            <span className="material-symbols-outlined text-[32px]" style={{ fontVariationSettings: "'FILL' 1" }}>
              bloodtype
            </span>
          </div>
          <div className="flex flex-col gap-1 min-w-0">
            <div className="flex flex-wrap items-center gap-space-xs">
              <h1 className="font-headline-md text-headline-md text-on-surface tracking-tight">Blood Stock</h1>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-label-sm text-label-sm bg-tertiary-container/10 text-tertiary">
                <span className="w-2 h-2 rounded-full bg-tertiary animate-pulse"></span>
                Refreshes every 60 seconds
              </span>
            </div>
            <p className="font-body-md text-body-md text-secondary truncate">
              {hospital.name} • Facility code{' '}
              <span className="font-semibold text-on-surface">{hospital.facility_code}</span>
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-space-xs">
          <button
            type="button"
            onClick={exportCsv}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full font-label-md text-label-md text-on-surface bg-surface-container-high hover:bg-surface-container-highest transition-colors shadow-sm cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">download</span>
            Export CSV
          </button>
          <button
            type="button"
            onClick={() => setModal({ type: 'ledger' })}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full font-label-md text-label-md text-on-surface bg-surface-container-high hover:bg-surface-container-highest transition-colors shadow-sm cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">history</span>
            Audit log
          </button>
          <button
            type="button"
            onClick={() => openStock('inward')}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full font-label-md text-label-md text-on-primary bg-primary-container hover:bg-primary shadow-sm transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">add_circle</span>
            Add stock
          </button>
        </div>
      </div>

      {actionError && (
        <div role="alert" className="flex items-start gap-2.5 rounded-xl bg-error-container px-4 py-3 text-on-error-container">
          <span className="material-symbols-outlined text-[20px] shrink-0">error</span>
          <p className="font-body-sm text-body-sm">{actionError}</p>
        </div>
      )}

      {/* Alert banner */}
      {hasAlert && (
        <div className="bg-error-container/40 p-space-md rounded-[16px] flex flex-col md:flex-row items-start md:items-center justify-between gap-space-md shadow-sm">
          <div className="flex items-center gap-space-md">
            <div className="w-10 h-10 rounded-full bg-error text-on-error flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[22px]">warning</span>
            </div>
            <div>
              <span className="font-label-md text-label-md text-error uppercase tracking-wider">Needs attention</span>
              <p className="font-body-md text-body-md text-on-surface mt-0.5">
                {critical.length > 0 && (
                  <>
                    <strong className="text-error">
                      {critical.map((g) => `${g.group} (${g.units})`).join(', ')}
                    </strong>{' '}
                    {critical.length === 1 ? 'is' : 'are'} at critical level.{' '}
                  </>
                )}
                {summary.expired_units > 0 && (
                  <>
                    <strong className="text-error">{summary.expired_units} expired unit{summary.expired_units === 1 ? '' : 's'}</strong>{' '}
                    still counted in stock.{' '}
                  </>
                )}
                {summary.expiring_units > 0 && (
                  <>
                    {summary.expiring_units} unit{summary.expiring_units === 1 ? '' : 's'} expire within 72 hours.
                  </>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-space-xs shrink-0 w-full md:w-auto justify-end flex-wrap">
            {summary.expired_units > 0 && (
              <button
                type="button"
                onClick={discardExpired}
                className="px-3.5 py-1.5 rounded-full font-label-sm text-label-sm bg-error text-on-error hover:bg-on-error-container transition-colors shadow-sm cursor-pointer"
              >
                Discard expired
              </button>
            )}
            {critical.length > 0 && (
              <button
                type="button"
                onClick={() => setModal({ type: 'request', group: critical[0].group })}
                className="px-3.5 py-1.5 rounded-full font-label-sm text-label-sm bg-primary-container text-on-primary hover:bg-primary transition-colors shadow-sm cursor-pointer"
              >
                Request donors
              </button>
            )}
          </div>
        </div>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-space-md">
        <div className="bg-surface-container-lowest p-space-lg rounded-[16px] shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="font-label-md text-label-md text-secondary">Total units in stock</span>
            <span className="p-2 rounded-xl bg-surface-container text-primary">
              <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                bloodtype
              </span>
            </span>
          </div>
          <div className="mt-space-md">
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="font-headline-lg text-headline-lg text-on-surface">{summary.total_units}</span>
              <span className="font-body-md text-body-md text-secondary">
                / {summary.total_target} target ({summary.percent}%)
              </span>
            </div>
            <div className="w-full h-2 bg-surface-container-high rounded-full mt-2 overflow-hidden">
              <div className="h-full bg-primary-container rounded-full" style={{ width: `${Math.min(100, summary.percent)}%` }}></div>
            </div>
            <div className="grid grid-cols-2 gap-y-1 gap-x-2 mt-space-md font-body-sm text-body-sm text-secondary">
              {COMPONENTS.map((c) => (
                <span key={c}>
                  {COMPONENT_SHORT[c]}: <strong className="text-on-surface">{summary.components[c]}</strong>
                </span>
              ))}
              {summary.unspecified > 0 && (
                <span className="col-span-2">
                  Not specified: <strong className="text-on-surface">{summary.unspecified}</strong>
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="bg-surface-container-lowest p-space-lg rounded-[16px] shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="font-label-md text-label-md text-secondary">Low / critical groups</span>
            <span className="p-2 rounded-xl bg-error-container text-error">
              <span className="material-symbols-outlined text-[20px]">emergency</span>
            </span>
          </div>
          <div className="mt-space-md">
            <div className="flex items-baseline gap-2">
              <span className={`font-headline-lg text-headline-lg ${attention.length ? 'text-error' : 'text-tertiary'}`}>
                {attention.length} {attention.length === 1 ? 'group' : 'groups'}
              </span>
            </div>
            <p className="font-body-sm text-body-sm text-secondary mt-1">
              {attention.length ? 'Consider asking donors or another bank for supply.' : 'All groups are at a healthy level.'}
            </p>
            <div className="flex flex-col gap-2 mt-space-sm">
              {attention.slice(0, 3).map((g) => (
                <div key={g.group} className="flex items-center justify-between font-body-sm text-body-sm bg-surface-container-low p-2 rounded-lg">
                  <span className={`font-semibold flex items-center gap-1 ${g.status === 'critical' ? 'text-error' : 'text-amber-800'}`}>
                    <span className={`w-2 h-2 rounded-full ${g.status === 'critical' ? 'bg-error' : 'bg-amber-500'}`}></span>
                    {g.group}
                  </span>
                  <span className={`font-semibold ${g.status === 'critical' ? 'text-error' : 'text-amber-800'}`}>
                    {g.units} unit{g.units === 1 ? '' : 's'} ({g.status.toUpperCase()})
                  </span>
                </div>
              ))}
              {attention.length > 3 && (
                <span className="font-body-sm text-body-sm text-secondary">+ {attention.length - 3} more</span>
              )}
            </div>
          </div>
        </div>

        <div id="expiring" className="bg-surface-container-lowest p-space-lg rounded-[16px] shadow-sm flex flex-col justify-between scroll-mt-28">
          <div className="flex items-center justify-between">
            <span className="font-label-md text-label-md text-secondary">Expiring within 72 hours</span>
            <span className="p-2 rounded-xl bg-surface-container-high text-on-surface-variant">
              <span className="material-symbols-outlined text-[20px]">hourglass_top</span>
            </span>
          </div>
          <div className="mt-space-md">
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="font-headline-lg text-headline-lg text-on-surface">
                {summary.expiring_units} {summary.expiring_units === 1 ? 'unit' : 'units'}
              </span>
              {summary.expired_units > 0 && (
                <span className="font-label-sm text-label-sm px-2 py-0.5 rounded-full bg-error-container text-on-error-container font-bold">
                  {summary.expired_units} expired
                </span>
              )}
            </div>
            <div className="flex flex-col gap-2 mt-space-sm">
              {expiring.length === 0 && expired.length === 0 && (
                <p className="font-body-sm text-body-sm text-secondary">No batches close to expiry.</p>
              )}
              {[...expired, ...expiring].slice(0, 3).map((b) => (
                <div key={b.id} className="flex items-center justify-between font-body-sm text-body-sm">
                  <span className="text-on-surface">
                    {b.units}u {b.blood_group} {COMPONENT_SHORT[b.component]}
                  </span>
                  <span className={b.hours_left < 24 ? 'text-error font-medium' : 'text-on-surface-variant font-medium'}>
                    {expiryLabel(b.hours_left)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-surface-container-lowest p-space-lg rounded-[16px] shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="font-label-md text-label-md text-secondary">Stock movement this month</span>
            <span className="p-2 rounded-xl bg-tertiary-container/10 text-tertiary">
              <span className="material-symbols-outlined text-[20px]">swap_vert</span>
            </span>
          </div>
          <div className="mt-space-md">
            <div className="flex items-baseline gap-2">
              <span className="font-headline-lg text-headline-lg text-tertiary">+{month.inward}</span>
              <span className="font-body-md text-body-md text-secondary">units in</span>
            </div>
            <div className="flex flex-col gap-1.5 mt-space-sm font-body-sm text-body-sm">
              <div className="flex items-center justify-between">
                <span className="text-secondary">Issued</span>
                <span className="font-semibold text-on-surface">−{month.outward}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-secondary">Discarded</span>
                <span className="font-semibold text-on-surface">−{month.discard}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Inventory */}
      <div className="bg-surface-container-lowest rounded-[16px] shadow-sm p-space-lg flex flex-col gap-space-lg">
        <div className="flex flex-col gap-space-md">
          <div className="flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-space-md">
            <div className="relative flex-1 min-w-[240px]">
              <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-secondary text-[20px]">search</span>
              <label htmlFor="stock-search" className="sr-only">
                Filter stock
              </label>
              <input
                id="stock-search"
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Filter by blood group or component…"
                className="w-full h-11 pl-11 pr-4 bg-surface-container-low rounded-xl font-body-md text-body-md text-on-surface placeholder:text-secondary focus:outline-none focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary-container"
              />
            </div>
            <div className="flex flex-wrap items-center gap-space-xs">
              <label htmlFor="stock-level" className="sr-only">
                Stock level
              </label>
              <select
                id="stock-level"
                value={level}
                onChange={(e) => setLevel(e.target.value)}
                className="h-11 px-3 bg-surface-container-low rounded-xl text-on-surface font-label-md text-label-md cursor-pointer focus:outline-none"
              >
                <option value="all">All levels</option>
                <option value="attention">Low and critical</option>
                <option value="critical">Critical only</option>
                <option value="low">Low only</option>
                <option value="available">Optimal only</option>
              </select>
              <div className="bg-surface-container-low p-1 rounded-xl flex items-center">
                {[
                  ['grid', 'grid_view', 'Card view'],
                  ['table', 'view_list', 'Table view'],
                ].map(([key, icon, label]) => (
                  <button
                    key={key}
                    type="button"
                    aria-label={label}
                    aria-pressed={view === key}
                    onClick={() => setView(key)}
                    className={`p-1.5 rounded-lg cursor-pointer ${
                      view === key ? 'bg-surface-container-lowest text-on-surface shadow-sm' : 'text-secondary hover:text-on-surface'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[18px]">{icon}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-space-xs overflow-x-auto pb-1 whitespace-nowrap">
            {[['all', `All components (${summary.total_units})`], ...COMPONENTS.map((c) => [c, `${c} (${summary.components[c]})`])].map(
              ([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setComp(key)}
                  className={`px-3.5 py-1.5 rounded-full font-label-md text-label-md transition-colors cursor-pointer ${
                    comp === key
                      ? 'bg-on-surface text-surface-container-lowest shadow-sm'
                      : 'bg-surface-container-low text-secondary hover:text-on-surface hover:bg-surface-container'
                  }`}
                >
                  {label}
                </button>
              )
            )}
          </div>
        </div>

        {visible.length === 0 ? (
          <p className="py-8 text-center font-body-md text-body-md text-secondary">No blood groups match these filters.</p>
        ) : view === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-space-md">
            {visible.map((g) => {
              const st = STATUS[g.status]
              const diff = g.units - g.target
              return (
                <div key={g.group} className="bg-surface-container-low p-space-md rounded-[16px] flex flex-col justify-between gap-space-md shadow-xs hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-space-sm">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center font-headline-sm text-headline-sm shadow-sm ${st.circle}`}>
                      {g.group}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-headline-sm text-headline-sm text-on-surface">
                          {g.units} {g.units === 1 ? 'Unit' : 'Units'}
                        </span>
                        <span className={`font-label-sm text-label-sm px-2 py-0.5 rounded-full font-bold ${st.pill}`}>{st.label}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setModal({ type: 'target', item: g })}
                        className="font-body-sm text-body-sm text-secondary hover:text-primary inline-flex items-center gap-1 cursor-pointer"
                        title="Change target"
                      >
                        Target: {g.target} units
                        <span className="material-symbols-outlined text-[14px]">edit</span>
                      </button>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between items-center font-body-sm text-body-sm mb-1.5">
                      <span className="text-secondary font-medium">{g.percent}% of target</span>
                      <span className={`font-semibold ${diff < 0 ? 'text-error' : 'text-tertiary'}`}>
                        {diff < 0 ? `${diff} short` : diff === 0 ? 'On target' : `+${diff} surplus`}
                      </span>
                    </div>
                    <div className="w-full h-2.5 bg-surface-container-highest rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${st.bar}`} style={{ width: `${Math.min(100, g.percent)}%` }}></div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 font-body-sm text-body-sm bg-surface-container-lowest p-2.5 rounded-xl">
                    {COMPONENTS.map((c) => (
                      <div key={c} className={`flex flex-col ${comp === c ? 'text-primary' : ''}`}>
                        <span className="text-secondary text-[11px]">{COMPONENT_SHORT[c]}:</span>
                        <span className="font-semibold text-on-surface">
                          {g.components[c]} unit{g.components[c] === 1 ? '' : 's'}
                        </span>
                      </div>
                    ))}
                    {g.unspecified > 0 && (
                      <div className="flex flex-col col-span-2">
                        <span className="text-secondary text-[11px]">Not specified:</span>
                        <span className="font-semibold text-on-surface">{g.unspecified} units</span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center justify-between font-body-sm text-body-sm text-secondary gap-2">
                    <span>{g.last_inward ? `Last in: ${relTime(new Date(g.last_inward))}` : 'No stock in yet'}</span>
                    {g.expired_units > 0 ? (
                      <span className="text-error font-medium">{g.expired_units} expired</span>
                    ) : g.expiring_units > 0 ? (
                      <span className="text-error font-medium">{g.expiring_units} expiring soon</span>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2 pt-1 flex-wrap">
                    <button
                      type="button"
                      onClick={() => openStock('inward', { group: g.group })}
                      className="flex-1 min-w-[80px] py-2 rounded-xl bg-surface-container-lowest hover:bg-surface-container text-on-surface font-label-md text-label-md transition-colors text-center shadow-xs cursor-pointer"
                    >
                      Add
                    </button>
                    <button
                      type="button"
                      disabled={g.units === 0}
                      onClick={() => openStock('outward', { group: g.group })}
                      className="flex-1 min-w-[80px] py-2 rounded-xl bg-surface-container-lowest hover:bg-surface-container text-on-surface font-label-md text-label-md transition-colors text-center shadow-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Issue
                    </button>
                    {g.status !== 'available' && (
                      <button
                        type="button"
                        onClick={() => setModal({ type: 'request', group: g.group })}
                        className="w-full py-2 rounded-xl bg-error text-on-error font-label-md text-label-md hover:bg-on-error-container transition-colors text-center shadow-xs cursor-pointer"
                      >
                        Request donors
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-low text-secondary font-label-sm text-label-sm uppercase tracking-wider">
                  <th className="py-3 px-3.5 rounded-l-xl">Group</th>
                  <th className="py-3 px-3">Units</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3">Target</th>
                  {COMPONENTS.map((c) => (
                    <th key={c} className="py-3 px-3">
                      {COMPONENT_SHORT[c]}
                    </th>
                  ))}
                  <th className="py-3 px-3.5 rounded-r-xl"></th>
                </tr>
              </thead>
              <tbody className="font-body-md text-body-md text-on-surface">
                {visible.map((g) => (
                  <tr key={g.group} className="hover:bg-surface-container-low/50 transition-colors">
                    <td className="py-3 px-3.5 font-bold">{g.group}</td>
                    <td className="py-3 px-3 font-semibold">{g.units}</td>
                    <td className="py-3 px-3">
                      <span className={`font-label-sm text-label-sm px-2 py-0.5 rounded-full font-bold ${STATUS[g.status].pill}`}>
                        {STATUS[g.status].label}
                      </span>
                    </td>
                    <td className="py-3 px-3">{g.target}</td>
                    {COMPONENTS.map((c) => (
                      <td key={c} className="py-3 px-3">
                        {g.components[c]}
                      </td>
                    ))}
                    <td className="py-3 px-3.5 text-right whitespace-nowrap">
                      <button type="button" onClick={() => openStock('inward', { group: g.group })} className="text-primary hover:underline font-label-md text-label-md cursor-pointer mr-3">
                        Add
                      </button>
                      <button
                        type="button"
                        disabled={g.units === 0}
                        onClick={() => openStock('outward', { group: g.group })}
                        className="text-primary hover:underline font-label-md text-label-md cursor-pointer disabled:opacity-40 disabled:no-underline"
                      >
                        Issue
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Ledger and side column */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg">
        <div className="lg:col-span-8 flex flex-col gap-space-md min-w-0">
          <div className="bg-surface-container-lowest p-space-lg rounded-[16px] shadow-sm flex flex-col gap-space-md">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-space-xs">
                <span className="w-2.5 h-2.5 rounded-full bg-primary-container"></span>
                <h2 className="font-headline-sm text-headline-sm text-on-surface">Recent stock movements</h2>
              </div>
            </div>
            {recent.length === 0 ? (
              <p className="py-6 text-center font-body-md text-body-md text-secondary">
                No movements yet. Add stock or record a donation and it will show up here.
              </p>
            ) : (
              <LedgerTable items={recent} />
            )}
            <div className="flex items-center justify-between pt-space-xs">
              <span className="font-body-sm text-body-sm text-secondary">
                {data.ledger_month_count} entr{data.ledger_month_count === 1 ? 'y' : 'ies'} this month
              </span>
              <button
                type="button"
                onClick={() => setModal({ type: 'ledger' })}
                className="font-label-md text-label-md text-primary hover:underline inline-flex items-center gap-1 cursor-pointer"
              >
                View complete audit ledger
                <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-space-md">
            {[
              { icon: 'send', tone: 'bg-primary-container text-on-primary', title: 'Issue to OT / ICU', sub: 'Units leaving for a patient', run: () => openStock('outward', { reason: 'Issued to OT / ICU' }) },
              { icon: 'delete_forever', tone: 'bg-error-container text-error', title: 'Discard / quality fail', sub: 'Record units thrown away', run: () => openStock('discard', { reason: 'Quality check failed' }) },
              { icon: 'swap_horiz', tone: 'bg-secondary-container text-on-secondary-fixed', title: 'Partner bank transfer', sub: 'Send units to another bank', run: () => openStock('outward', { reason: 'Transfer to partner bank' }) },
            ].map((a) => (
              <button
                key={a.title}
                type="button"
                onClick={a.run}
                className="bg-surface-container-lowest p-space-md rounded-[16px] shadow-sm flex items-center gap-space-sm hover:bg-surface-container transition-colors text-left cursor-pointer"
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${a.tone}`}>
                  <span className="material-symbols-outlined text-[20px]">{a.icon}</span>
                </div>
                <div>
                  <div className="font-label-md text-label-md text-on-surface">{a.title}</div>
                  <div className="font-body-sm text-body-sm text-secondary">{a.sub}</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="lg:col-span-4 flex flex-col gap-space-md">
          <div className="bg-surface-container-lowest p-space-lg rounded-[16px] shadow-sm flex flex-col gap-space-md">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[20px] text-primary">event_busy</span>
                <h3 className="font-headline-sm text-headline-sm text-on-surface">Batches to watch</h3>
              </div>
              {summary.expired_units > 0 && (
                <button type="button" onClick={discardExpired} className="font-label-sm text-label-sm text-error hover:underline cursor-pointer">
                  Discard expired
                </button>
              )}
            </div>
            {expiring.length === 0 && expired.length === 0 ? (
              <p className="font-body-sm text-body-sm text-secondary">Nothing is expired or close to expiring.</p>
            ) : (
              <div className="flex flex-col gap-space-sm">
                {[...expired, ...expiring].map((b) => (
                  <div key={b.id} className="bg-surface-container-low p-3 rounded-xl flex items-center justify-between gap-2">
                    <div className="flex flex-col min-w-0">
                      <span className="font-label-md text-label-md text-on-surface">
                        {b.units}u {b.blood_group} {b.component}
                      </span>
                      <span className="font-body-sm text-body-sm text-secondary truncate">
                        {[b.batch_code && `#${b.batch_code}`, b.storage, formatDate(b.expiry_date)].filter(Boolean).join(' • ')}
                      </span>
                    </div>
                    <span className={`font-label-sm text-label-sm font-bold whitespace-nowrap ${b.hours_left < 24 ? 'text-error' : 'text-on-surface-variant'}`}>
                      {expiryLabel(b.hours_left)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-surface-container-lowest p-space-lg rounded-[16px] shadow-sm flex flex-col gap-space-md">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[20px] text-primary">clinical_notes</span>
              <h3 className="font-headline-sm text-headline-sm text-on-surface">Default shelf life</h3>
            </div>
            <p className="font-body-sm text-body-sm text-secondary -mt-2">
              Used to suggest an expiry date. You can always type your own.
            </p>
            <div className="space-y-2.5 font-body-sm text-body-sm">
              {COMPONENTS.map((c) => (
                <div key={c} className="flex items-center justify-between p-2 rounded-lg bg-surface-container-low">
                  <span className="font-medium text-on-surface">{c}</span>
                  <span className="font-semibold text-on-surface">
                    {shelfDays[c] >= 365 ? '1 year' : `${shelfDays[c]} days`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {modal?.type === 'stock' && (
        <StockModal
          mode={modal.mode}
          hospitalName={hospital.name}
          groups={groups}
          shelfDays={shelfDays}
          preset={modal.preset}
          onSave={saveStock}
          onClose={closeModal}
        />
      )}
      {modal?.type === 'target' && <TargetModal item={modal.item} onSave={saveTarget} onClose={closeModal} />}
      {modal?.type === 'ledger' && <LedgerModal onClose={closeModal} />}
      {modal?.type === 'request' && <PostRequestModal initialGroup={modal.group} onSave={postRequest} onClose={closeModal} />}

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