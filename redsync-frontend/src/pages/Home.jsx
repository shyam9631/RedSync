import Hero from '../components/home/Hero'
import Stats from '../components/home/Stats'
import HowItWorks from '../components/home/HowItWorks'
import BloodAvailability from '../components/home/BloodAvailability'
import CompatibilityChart from '../components/home/CompatibilityChart'
import EligibilityCheck from '../components/home/EligibilityCheck'
import DonationCamps from '../components/home/DonationCamps'
import EmergencyBanner from '../components/home/EmergencyBanner'
import HospitalCTA from '../components/home/HospitalCTA'
import Testimonials from '../components/home/Testimonials'
import FAQ from '../components/home/FAQ'

export default function Home() {
  return (
    <>
      <Hero />
      <Stats />
      <HowItWorks />
      <BloodAvailability />
      <CompatibilityChart />
      <EligibilityCheck />
      <DonationCamps />
      <EmergencyBanner />
      <HospitalCTA />
      <Testimonials />
      <FAQ />
    </>
  )
}