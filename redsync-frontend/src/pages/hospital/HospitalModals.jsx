import { useState } from 'react'
import Modal from '../../components/ui/Modal'
import { Field, ErrorText, inputClass } from '../../components/forms/FormBits'
import {
  ALL_GROUPS,
  COMPONENTS,
  statusOf,
  localISO,
  localDateTimeValue,
  parseLocal,
} from '../../data/hospitalDemo'
import { formatDate } from '../../data/donorDemo'

const STATUS_PILL = {
  available: 'bg-tertiary-fixed text-on-tertiary-fixed',
  low: 'bg-amber-100 text-amber-800',
  critical: 'bg-error-container text-on-error-container',
}
const STATUS_LABEL = { available: 'Available', low: 'Low', critical: 'Critical' }

const selectClass =
  'w-full h-12 px-4 rounded-lg bg-surface-container-low text-on-surface focus:outline-none focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary-container font-body-md text-body-md'

function Buttons({ onClose, saveLabel, saveIcon }) {
  return (
    <div className="flex items-center justify-end gap-3 pt-2">
      <button
        type="button"
        onClick={onClose}
        className="px-5 py-2.5 rounded-full bg-surface-container hover:bg-surface-container-high text-on-surface font-label-md text-label-md transition-colors cursor-pointer"
      >
        Cancel
      </button>
      <button
        type="submit"
        className="px-6 py-2.5 rounded-full bg-primary-container text-on-primary hover:bg-primary font-label-md text-label-md shadow-sm transition-all flex items-center gap-2 cursor-pointer"
      >
        {saveIcon && <span className="material-symbols-outlined text-[18px]">{saveIcon}</span>}
        <span>{saveLabel}</span>
      </button>
    </div>
  )
}

/* ---------------- Update stock ---------------- */
export function UpdateStockModal({ item, onSave, onClose }) {
  const [units, setUnits] = useState(String(item.units))
  const [expiry, setExpiry] = useState(item.expiry || '')
  const [notes, setNotes] = useState('')
  const [errors, setErrors] = useState({})

  const today = localISO(new Date())
  const n = Number(units)
  const valid = units !== '' && Number.isInteger(n) && n >= 0 && n <= 1000
  const previewStatus = valid ? statusOf(n) : null

  const bump = (d) => {
    const base = Number.isFinite(n) ? n : 0
    setUnits(String(Math.max(0, base + d)))
    setErrors((e) => ({ ...e, units: undefined }))
  }

  const submit = (e) => {
    e.preventDefault()
    const er = {}
    if (!valid) er.units = 'Enter a whole number between 0 and 1000.'
    if (expiry && expiry < today) er.expiry = 'The expiry date cannot be in the past.'
    setErrors(er)
    if (Object.keys(er).length) return
    onSave({ group: item.group, units: n, expiry, notes: notes.trim() })
  }

  return (
    <Modal
      title={`Update blood stock: ${item.group}`}
      subtitle="Enter the units you currently hold for this blood group."
      leading={
        <div className="w-10 h-10 rounded-full bg-primary-container text-on-primary flex items-center justify-center font-badge-blood-group text-[16px] shrink-0">
          {item.group}
        </div>
      }
      onClose={onClose}
    >
      <form onSubmit={submit} noValidate className="space-y-6">
        <div>
          <label
            htmlFor="units-input"
            className="block font-label-md text-label-md text-on-surface mb-2"
          >
            Available units
          </label>
          <div className="flex items-center gap-3 flex-wrap">
            <button
              type="button"
              onClick={() => bump(-1)}
              aria-label="Decrease units"
              className="w-11 h-11 rounded-xl bg-surface-container hover:bg-surface-container-high flex items-center justify-center text-on-surface font-title-md text-title-md transition-colors cursor-pointer"
            >
              −
            </button>
            <input
              id="units-input"
              type="text"
              inputMode="numeric"
              value={units}
              onChange={(e) => {
                setUnits(e.target.value.replace(/\D/g, '').slice(0, 4))
                setErrors((er) => ({ ...er, units: undefined }))
              }}
              className={`w-24 text-center py-2.5 bg-surface-container-low rounded-xl font-headline-sm text-headline-sm text-on-surface font-bold focus:outline-none focus:ring-2 focus:ring-primary-container ${
                errors.units ? 'ring-2 ring-error' : ''
              }`}
            />
            <button
              type="button"
              onClick={() => bump(1)}
              aria-label="Increase units"
              className="w-11 h-11 rounded-xl bg-surface-container hover:bg-surface-container-high flex items-center justify-center text-on-surface font-title-md text-title-md transition-colors cursor-pointer"
            >
              +
            </button>
            {previewStatus && (
              <span
                className={`px-2.5 py-1 rounded-full font-label-sm text-label-sm font-semibold ${STATUS_PILL[previewStatus]}`}
              >
                Status: {STATUS_LABEL[previewStatus]}
              </span>
            )}
          </div>
          <ErrorText>{errors.units}</ErrorText>
        </div>

        <Field label="Earliest batch expiry" htmlFor="expiry-input" optional error={errors.expiry}>
          <input
            id="expiry-input"
            type="date"
            min={today}
            value={expiry}
            onChange={(e) => {
              setExpiry(e.target.value)
              setErrors((er) => ({ ...er, expiry: undefined }))
            }}
            className={inputClass(errors.expiry)}
          />
        </Field>

        <Field label="Notes" htmlFor="stock-notes" optional>
          <textarea
            id="stock-notes"
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. batch number or storage unit"
            className="w-full px-4 py-2.5 bg-surface-container-low rounded-lg font-body-md text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-container resize-none"
          />
        </Field>

        <Buttons onClose={onClose} saveLabel="Save updates" />
      </form>
    </Modal>
  )
}

/* ---------------- Post urgent request ---------------- */
export function PostRequestModal({ onSave, onClose }) {
  const [group, setGroup] = useState('')
  const [units, setUnits] = useState('1')
  const [component, setComponent] = useState(COMPONENTS[0])
  const [urgency, setUrgency] = useState('urgent')
  const [requiredBy, setRequiredBy] = useState('')
  const [notes, setNotes] = useState('')
  const [errors, setErrors] = useState({})

  const clear = (key) => setErrors((e) => ({ ...e, [key]: undefined }))

  const submit = (e) => {
    e.preventDefault()
    const er = {}
    const n = Number(units)
    if (!group) er.group = 'Select the blood group you need.'
    if (!Number.isInteger(n) || n < 1 || n > 50) er.units = 'Enter between 1 and 50 units.'
    if (!requiredBy) er.requiredBy = 'Choose when the blood is needed.'
    else if (new Date(requiredBy) <= new Date()) er.requiredBy = 'Choose a time in the future.'
    setErrors(er)
    if (Object.keys(er).length) return
    onSave({
      group,
      units: n,
      component,
      urgency,
      requiredBy: new Date(requiredBy),
      notes: notes.trim(),
    })
  }

  const urgencies = [
    { key: 'critical', label: 'Critical' },
    { key: 'urgent', label: 'Urgent' },
    { key: 'normal', label: 'Normal' },
  ]

  return (
    <Modal
      title="Post urgent blood request"
      subtitle="Matching donors near your hospital will be notified."
      leading={
        <div className="w-10 h-10 rounded-full bg-primary-container text-on-primary flex items-center justify-center shrink-0">
          <span className="material-symbols-outlined text-[20px]">emergency</span>
        </div>
      }
      onClose={onClose}
    >
      <form onSubmit={submit} noValidate className="space-y-6">
        <div>
          <span className="block font-label-md text-label-md text-on-surface mb-3">
            Required blood group <span className="text-error">*</span>
          </span>
          <div className="grid grid-cols-4 sm:grid-cols-8 gap-3">
            {ALL_GROUPS.map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => {
                  setGroup(g)
                  clear('group')
                }}
                className={`w-12 h-12 rounded-full font-badge-blood-group text-[15px] flex items-center justify-center transition-all cursor-pointer ${
                  group === g
                    ? 'bg-primary-container text-on-primary ring-2 ring-primary ring-offset-2'
                    : 'bg-surface-container text-on-surface hover:bg-primary-fixed'
                }`}
              >
                {g}
              </button>
            ))}
          </div>
          <ErrorText>{errors.group}</ErrorText>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Units needed" htmlFor="req-units" required error={errors.units}>
            <input
              id="req-units"
              type="text"
              inputMode="numeric"
              value={units}
              onChange={(e) => {
                setUnits(e.target.value.replace(/\D/g, '').slice(0, 2))
                clear('units')
              }}
              className={inputClass(errors.units)}
            />
          </Field>
          <Field label="Component" htmlFor="req-component" required>
            <select
              id="req-component"
              value={component}
              onChange={(e) => setComponent(e.target.value)}
              className={selectClass}
            >
              {COMPONENTS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <span className="block font-label-md text-label-md text-on-surface mb-1">
              Urgency level <span className="text-error">*</span>
            </span>
            <div className="flex items-center gap-2 pt-1">
              {urgencies.map((u) => (
                <button
                  key={u.key}
                  type="button"
                  onClick={() => setUrgency(u.key)}
                  className={`flex-1 py-2.5 rounded-full font-label-sm text-label-sm transition-colors cursor-pointer ${
                    urgency === u.key
                      ? 'bg-primary-container text-on-primary font-bold'
                      : 'bg-surface-container text-on-surface hover:bg-surface-container-high'
                  }`}
                >
                  {u.label}
                </button>
              ))}
            </div>
          </div>
          <Field label="Required by" htmlFor="req-by" required error={errors.requiredBy}>
            <input
              id="req-by"
              type="datetime-local"
              min={localDateTimeValue(new Date())}
              value={requiredBy}
              onChange={(e) => {
                setRequiredBy(e.target.value)
                clear('requiredBy')
              }}
              className={inputClass(errors.requiredBy)}
            />
          </Field>
        </div>

        <Field label="Notes" htmlFor="req-notes" optional>
          <input
            id="req-notes"
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. Emergency surgery. Do not add patient names."
            className={inputClass(false)}
          />
        </Field>

        <div className="p-3 bg-surface-container-low rounded-xl flex items-center gap-2 font-body-sm text-body-sm text-secondary">
          <span className="material-symbols-outlined text-[18px] text-tertiary">info</span>
          <span>Nearby donors with a matching blood group will be notified.</span>
        </div>

        <Buttons onClose={onClose} saveLabel="Post request" saveIcon="send" />
      </form>
    </Modal>
  )
}

/* ---------------- Record a donation ---------------- */
export function RecordDonationModal({ donors, onSave, onClose }) {
  const [query, setQuery] = useState('')
  const [donorId, setDonorId] = useState('')
  const [date, setDate] = useState(localISO(new Date()))
  const [component, setComponent] = useState(COMPONENTS[0])
  const [units, setUnits] = useState('1')
  const [batch, setBatch] = useState('')
  const [errors, setErrors] = useState({})

  const today = localISO(new Date())
  const clear = (key) => setErrors((e) => ({ ...e, [key]: undefined }))

  const q = query.trim().toLowerCase()
  const options = donors.filter(
    (d) => !q || d.name.toLowerCase().includes(q) || d.code.toLowerCase().includes(q)
  )
  const donor = donors.find((d) => d.id === donorId)

  // Soft warning when this donation is sooner than the usual gap
  let warning = ''
  if (donor && date && donor.lastDonation && !donor.neverDonated) {
    const gap = donor.gender === 'Female' ? 120 : 90
    const next = parseLocal(donor.lastDonation)
    next.setDate(next.getDate() + gap)
    if (parseLocal(date) < next) {
      warning = `Their last recorded donation was on ${formatDate(
        parseLocal(donor.lastDonation)
      )}. The usual gap is ${gap} days, so check before saving.`
    }
  }

  const submit = (e) => {
    e.preventDefault()
    const er = {}
    const n = Number(units)
    if (!donorId) er.donor = 'Pick a donor from the list.'
    if (!date) er.date = 'Enter the donation date.'
    else if (date > today) er.date = 'The donation date cannot be in the future.'
    if (!Number.isInteger(n) || n < 1 || n > 5) er.units = 'Enter between 1 and 5 units.'
    setErrors(er)
    if (Object.keys(er).length) return
    onSave({ donorId, date, component, units: n, batch: batch.trim() })
  }

  return (
    <Modal
      title="Record a donation"
      subtitle="Log a donation made at your hospital."
      leading={
        <div className="w-10 h-10 rounded-full bg-tertiary text-on-tertiary flex items-center justify-center shrink-0">
          <span className="material-symbols-outlined text-[20px]">vaccines</span>
        </div>
      }
      onClose={onClose}
    >
      <form onSubmit={submit} noValidate className="space-y-6">
        <div>
          <label
            htmlFor="donor-search"
            className="block font-label-md text-label-md text-on-surface mb-2"
          >
            Search and pick a donor <span className="text-error">*</span>
          </label>
          <div className="relative mb-2">
            <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[18px] text-secondary">
              search
            </span>
            <input
              id="donor-search"
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name or ID"
              className="w-full pl-10 pr-4 py-2.5 bg-surface-container-low rounded-xl font-body-md text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-container"
            />
          </div>
          <select
            aria-label="Donor"
            value={donorId}
            onChange={(e) => {
              setDonorId(e.target.value)
              clear('donor')
            }}
            className={`${selectClass} ${errors.donor ? 'ring-2 ring-error' : ''}`}
          >
            <option value="">
              {options.length ? 'Select a donor' : 'No donors match your search'}
            </option>
            {options.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} ({d.code}) • {d.group}
              </option>
            ))}
          </select>
          <ErrorText>{errors.donor}</ErrorText>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Donation date" htmlFor="don-date" required error={errors.date}>
            <input
              id="don-date"
              type="date"
              max={today}
              value={date}
              onChange={(e) => {
                setDate(e.target.value)
                clear('date')
              }}
              className={inputClass(errors.date)}
            />
          </Field>
          <Field label="Component" htmlFor="don-component" required>
            <select
              id="don-component"
              value={component}
              onChange={(e) => setComponent(e.target.value)}
              className={selectClass}
            >
              {COMPONENTS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Units collected" htmlFor="don-units" required error={errors.units}>
            <input
              id="don-units"
              type="text"
              inputMode="numeric"
              value={units}
              onChange={(e) => {
                setUnits(e.target.value.replace(/\D/g, '').slice(0, 1))
                clear('units')
              }}
              className={inputClass(errors.units)}
            />
          </Field>
          <Field label="Batch ID" htmlFor="don-batch" optional>
            <input
              id="don-batch"
              type="text"
              value={batch}
              onChange={(e) => setBatch(e.target.value)}
              placeholder="e.g. BTC-0001"
              className={inputClass(false)}
            />
          </Field>
        </div>

        {warning && (
          <div className="flex items-start gap-2.5 rounded-xl bg-amber-100 px-4 py-3 text-amber-900">
            <span className="material-symbols-outlined text-[20px] shrink-0">warning</span>
            <p className="font-body-sm text-body-sm">{warning}</p>
          </div>
        )}

        <div className="p-3 bg-surface-container-low rounded-xl flex items-center gap-2 font-body-sm text-body-sm text-secondary">
          <span className="material-symbols-outlined text-[18px] text-tertiary">check_circle</span>
          <span>This updates the donor's next eligible date and your stock.</span>
        </div>

        <Buttons onClose={onClose} saveLabel="Save donation" saveIcon="save" />
      </form>
    </Modal>
  )
}