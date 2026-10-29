// Sample data for the hospital dashboard. Replace with API calls once the backend exists.
import { ALL_GROUPS } from './donorDemo'

export { ALL_GROUPS }

export const SAMPLE_HOSPITAL = { name: 'City General Hospital', code: 'HSP-0001' }

export const COMPONENTS = ['Whole Blood', 'Packed Red Cells', 'Platelets', 'Plasma']

// Stock levels (in units)
export const LOW_AT = 15
export const CRITICAL_AT = 5
export const BAR_FULL = 40

export function statusOf(units) {
  if (units <= CRITICAL_AT) return 'critical'
  if (units <= LOW_AT) return 'low'
  return 'available'
}

/* ---------- date helpers ---------- */
const pad = (n) => String(n).padStart(2, '0')

export const localISO = (d) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

export const localDateTimeValue = (d) =>
  `${localISO(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`

export function parseLocal(iso) {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function daysUntil(iso) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.round((parseLocal(iso) - today) / 86400000)
}

const addDays = (n) => {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return localISO(d)
}

const minsAgo = (m) => new Date(Date.now() - m * 60000)

export function relTime(date) {
  const mins = Math.max(0, Math.round((Date.now() - date.getTime()) / 60000))
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins} min ago`
  const h = Math.round(mins / 60)
  if (h < 24) return `${h} hour${h === 1 ? '' : 's'} ago`
  const d = Math.round(h / 24)
  return `${d} day${d === 1 ? '' : 's'} ago`
}

export const initials = (name) =>
  name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

export function shortName(name) {
  const parts = name.split(' ')
  if (parts.length < 2) return name
  return `${parts[0]} ${parts[parts.length - 1][0]}.`
}

/* ---------- sample records ---------- */
export function buildStock() {
  return [
    { group: 'A+', units: 42, updatedAt: minsAgo(120), expiry: addDays(14) },
    { group: 'A-', units: 9, updatedAt: minsAgo(240), expiry: addDays(10) },
    { group: 'B+', units: 36, updatedAt: minsAgo(30), expiry: addDays(12) },
    { group: 'B-', units: 14, updatedAt: minsAgo(60), expiry: addDays(9) },
    { group: 'O+', units: 68, updatedAt: minsAgo(15), expiry: addDays(2) },
    { group: 'O-', units: 4, updatedAt: minsAgo(35), expiry: addDays(8) },
    { group: 'AB+', units: 35, updatedAt: minsAgo(120), expiry: addDays(20) },
    { group: 'AB-', units: 6, updatedAt: minsAgo(180), expiry: addDays(3) },
  ]
}

export function buildDonors() {
  return [
    { id: 'd1', code: 'RD-1042', name: 'Aarav Menon', group: 'O+', gender: 'Male', area: 'Indiranagar', lastDonation: addDays(-190), active: true },
    { id: 'd2', code: 'RD-1043', name: 'Ananya Iyer', group: 'A+', gender: 'Female', area: 'Jayanagar', lastDonation: addDays(-102), active: true },
    { id: 'd3', code: 'RD-1044', name: 'Rahul Verma', group: 'B+', gender: 'Male', area: 'Malleshwaram', lastDonation: addDays(-150), active: true },
    { id: 'd4', code: 'RD-1045', name: 'Priya Nair', group: 'O-', gender: 'Female', area: 'Koramangala', lastDonation: addDays(-160), active: false },
    { id: 'd5', code: 'RD-1046', name: 'Vikram Rao', group: 'AB-', gender: 'Male', area: 'Whitefield', lastDonation: addDays(-40), active: true },
    { id: 'd6', code: 'RD-1047', name: 'Meera Sen', group: 'A-', gender: 'Female', area: 'HSR Layout', lastDonation: addDays(-210), active: false },
    { id: 'd7', code: 'RD-1048', name: 'Karthik Shetty', group: 'B-', gender: 'Male', area: 'Banashankari', neverDonated: true, active: false },
    { id: 'd8', code: 'RD-1049', name: 'Divya Hegde', group: 'O+', gender: 'Female', area: 'Rajajinagar', lastDonation: addDays(-70), active: true },
    { id: 'd9', code: 'RD-1050', name: 'Suresh Patil', group: 'A+', gender: 'Male', area: 'Yelahanka', lastDonation: addDays(-95), active: true },
    { id: 'd10', code: 'RD-1051', name: 'Fatima Khan', group: 'B+', gender: 'Female', area: 'Frazer Town', lastDonation: addDays(-130), active: true },
  ]
}

export function buildRequests() {
  return [
    {
      id: 'q1',
      group: 'O-',
      units: 2,
      component: 'Packed Red Cells',
      urgency: 'critical',
      postedAt: minsAgo(25),
      responders: [
        { name: 'Priya Nair', distanceKm: 2.1 },
        { name: 'Aarav Menon', distanceKm: 3.4 },
        { name: 'Rahul Verma', distanceKm: 4.8 },
        { name: 'Meera Sen', distanceKm: 6.0 },
      ],
    },
    {
      id: 'q2',
      group: 'AB-',
      units: 1,
      component: 'Platelets',
      urgency: 'urgent',
      postedAt: minsAgo(120),
      responders: [
        { name: 'Vikram Rao', distanceKm: 5.2 },
        { name: 'Meera Sen', distanceKm: 7.7 },
      ],
    },
    {
      id: 'q3',
      group: 'B+',
      units: 3,
      component: 'Whole Blood',
      urgency: 'normal',
      postedAt: minsAgo(300),
      responders: [{ name: 'Fatima Khan', distanceKm: 3.9 }],
    },
  ]
}

export function buildActivity() {
  return [
    { id: 'a1', icon: 'autorenew', tone: 'neutral', text: 'Stock updated: O- (4 units)', at: minsAgo(35) },
    { id: 'a2', icon: 'check_circle', tone: 'good', text: 'Donation recorded: B+ Whole Blood from Rahul V.', at: minsAgo(120) },
    { id: 'a3', icon: 'campaign', tone: 'alert', text: 'Request posted: AB- 1 unit Platelets', at: minsAgo(180) },
    { id: 'a4', icon: 'verified_user', tone: 'neutral', text: 'Donor marked Active: Aarav M.', at: minsAgo(300) },
    { id: 'a5', icon: 'task_alt', tone: 'good', text: 'Request fulfilled: O+ 1 unit', at: minsAgo(1440) },
  ]
}

export function buildHospitalCamp() {
  const d = new Date()
  d.setDate(d.getDate() + 9)
  return {
    title: 'Community Blood Drive',
    date: d,
    time: '9:00 AM – 3:00 PM',
    venue: 'Community Hall',
    target: 50,
    registered: 38,
  }
}