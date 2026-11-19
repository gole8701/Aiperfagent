export function HeroBanner() {
  return (
    <section className="hero">
      {/* Problem 1: the biggest image on screen is lazy-loaded, so LCP waits for it */}
      <img className="hero-image" src="/hero.png" alt="Summer sale banner" loading="lazy" width={1600} height={900} />
      <div className="hero-copy">
        <h1>Summer sale</h1>
        <p>Up to 40% off selected items this week.</p>
      </div>
    </section>
  )
}
