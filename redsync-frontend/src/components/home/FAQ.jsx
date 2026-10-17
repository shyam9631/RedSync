const faqs = [
  {
    q: 'Who can donate blood?',
    a: 'Healthy individuals aged 18 to 65 years, weighing at least 50 kg, with a normal haemoglobin count and no active infections can donate blood. You should be well-rested and hydrated.',
  },
  {
    q: 'How does an emergency blood request work?',
    a: 'Submit an urgent request with the hospital and blood group details. RedSync then notifies registered donors with a matching blood group near the hospital and alerts partner blood banks.',
  },
  {
    q: 'Is my phone number and personal data safe?',
    a: 'Your phone number is not shown publicly. It is shared with a requester only after you choose to accept their request.',
  },
  {
    q: 'How often can I donate blood?',
    a: 'Men can donate whole blood every 3 months (90 days) and women every 4 months (120 days). Platelet donations can be done more often, subject to medical evaluation.',
  },
  {
    q: 'How are partner hospitals verified?',
    a: 'New hospitals and blood banks are reviewed and approved by a RedSync admin before they can manage blood stock or view donors.',
  },
]

export default function FAQ() {
  return (
    <section className="w-full py-16">
      <div className="text-center max-w-2xl mx-auto mb-14">
        <span className="text-primary font-label-sm text-label-sm tracking-widest uppercase font-bold">
          Help & Answers
        </span>
        <h2 className="font-headline-lg text-headline-lg-mobile sm:text-headline-lg text-on-surface mt-2 tracking-tight">
          Frequently Asked Questions
        </h2>
        <p className="font-body-md text-body-md text-secondary mt-2">
          Everything you need to know about requesting, donating, and hospital coordination.
        </p>
      </div>

      <div className="max-w-3xl mx-auto space-y-4">
        {faqs.map((f, i) => (
          <details
            key={f.q}
            className="group bg-surface-container-lowest p-6 rounded-2xl shadow-sm border border-surface-container open:shadow-md transition-all"
          >
            <summary className="flex items-center justify-between font-headline-sm text-base text-on-surface cursor-pointer list-none">
              <span>
                {i + 1}. {f.q}
              </span>
              <span className="material-symbols-outlined text-secondary transition-transform group-open:rotate-180">
                expand_more
              </span>
            </summary>
            <p className="mt-3 font-body-md text-body-md text-secondary">{f.a}</p>
          </details>
        ))}
      </div>
    </section>
  )
}