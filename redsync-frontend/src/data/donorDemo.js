// Sample data for the dashboards. Replace with API calls once the backend exists.

export const ALL_GROUPS = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-']

// Which recipient groups a donor's red blood cells can help
export const DONATE_TO = {
  'O-': ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'],
  'O+': ['O+', 'A+', 'B+', 'AB+'],
  'A-': ['A-', 'A+', 'AB-', 'AB+'],
  'A+': ['A+', 'AB+'],
  'B-': ['B-', 'B+', 'AB-', 'AB+'],
  'B+': ['B+', 'AB+'],
  'AB-': ['AB-', 'AB+'],
  'AB+': ['AB+'],
}

// Used when the logged-in donor has no saved profile yet
export const SAMPLE_PROFILE = {
  bloodGroup: 'O+',
  gender: 'Male',
  lastDonation: '2026-04-18',
  neverDonated: false,
  city: 'Bengaluru',
  area: 'Indiranagar',
  radius: 10,
}

export const SAMPLE_HISTORY = [
  { id: 'h1', hospital: 'City General Hospital', date: '2026-04-18', component: 'Whole Blood' },
  { id: 'h2', hospital: 'Metro Care Clinic', date: '2026-01-12', component: 'Platelets' },
  { id: 'h3', hospital: 'Sunrise Blood Center', date: '2025-10-05', component: 'Whole Blood' },
]

// Requests always match the donor's own blood group
export function buildRequests(group) {
  return [
    {
      id: 'r1',
      hospital: 'City General Hospital',
      group,
      component: 'Platelets (SDP)',
      units: 2,
      urgency: 'critical',
      distanceKm: 2.4,
      postedMins: 12,
      address: 'Sample address, Main Road',
      phone: '+91 XXXXX XXXXX',
    },
    {
      id: 'r2',
      hospital: 'Metro Care Clinic',
      group,
      component: 'Whole Blood',
      units: 1,
      urgency: 'urgent',
      distanceKm: 4.1,
      postedMins: 35,
      address: 'Sample address, Station Road',
      phone: '+91 XXXXX XXXXX',
    },
    {
      id: 'r3',
      hospital: 'Apex Community Hospital',
      group,
      component: 'Whole Blood',
      units: 3,
      urgency: 'urgent',
      distanceKm: 6.8,
      postedMins: 60,
      address: 'Sample address, Park Street',
      phone: '+91 XXXXX XXXXX',
    },
  ]
}

export function buildCamps() {
  const inDays = (n) => {
    const d = new Date()
    d.setDate(d.getDate() + n)
    return d
  }
  return [
    {
      id: 'c1',
      title: 'Community Life Drive',
      date: inDays(9),
      time: '9:00 AM – 3:00 PM',
      venue: 'Community Hall',
    },
    {
      id: 'c2',
      title: 'Student Volunteer Blood Camp',
      date: inDays(16),
      time: '10:00 AM – 4:00 PM',
      venue: 'College Auditorium',
    },
  ]
}

export const DONOR_NOTIFICATIONS = [
  {
    id: 'n1',
    title: 'New request near you',
    text: 'City General Hospital needs Platelets.',
    time: '12m ago',
    unread: true,
  },
  {
    id: 'n2',
    title: 'City General Hospital confirmed your donation',
    text: 'Your donation on 18 Apr 2026 was confirmed.',
    time: '2d ago',
    unread: true,
  },
  {
    id: 'n3',
    title: 'You are eligible to donate again',
    text: 'Enough time has passed since your last donation.',
    time: '5d ago',
    unread: true,
  },
]

export const HOSPITAL_NOTIFICATIONS = [
  {
    id: 'h1',
    title: 'O- stock is critical',
    text: 'Only 4 units left in stock.',
    time: '35m ago',
    unread: true,
  },
  {
    id: 'h2',
    title: '4 donors responded to your O- request',
    text: 'Review responses to coordinate arrival.',
    time: '25m ago',
    unread: true,
  },
  {
    id: 'h3',
    title: 'AB- stock is low',
    text: '6 units remaining.',
    time: '3h ago',
    unread: true,
  },
]

export function formatDate(value) {
  const d = value instanceof Date ? value : new Date(value)
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function timeAgo(mins) {
  if (mins < 60) return `${mins} min ago`
  const h = Math.round(mins / 60)
  return `${h} hour${h === 1 ? '' : 's'} ago`
}

// 90 days between whole blood donations (120 for women)
export function getEligibility(profile) {
  const gap = profile.gender === 'Female' ? 120 : 90
  if (profile.neverDonated || !profile.lastDonation) {
    return { eligible: true, daysLeft: 0, percent: 100, gap, nextDate: null }
  }
  const next = new Date(profile.lastDonation)
  next.setDate(next.getDate() + gap)
  const daysLeft = Math.ceil((next - new Date()) / 86400000)
  if (daysLeft <= 0) {
    return { eligible: true, daysLeft: 0, percent: 100, gap, nextDate: next }
  }
  const percent = Math.max(0, Math.min(100, Math.round(((gap - daysLeft) / gap) * 100)))
  return { eligible: false, daysLeft, percent, gap, nextDate: next }
}