export default function Home() {
  return (
    <section className="py-20">
      <h1 className="font-headline-xl text-headline-xl tracking-tight text-on-surface">
        Find blood. <span className="text-primary-container">Save lives.</span> In real time.
      </h1>
      <p className="font-body-lg text-body-lg text-secondary mt-4 max-w-2xl">
        Landing page content comes in the next step.
      </p>
      <button
        type="button"
        className="mt-6 bg-primary-container text-on-primary hover:bg-primary px-7 py-3.5 rounded-xl font-label-md text-label-md shadow-lg"
      >
        Request Blood
      </button>
    </section>
  )
}