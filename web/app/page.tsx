import { CityScene } from "../components/landing/CityScene";

export default function LandingPage() {
  return (
    <main className="landing-shell">
      <CityScene />
      <div className="landing-atmosphere" aria-hidden="true" />

      <section className="landing-hero">
        <h1>Innsight.<br /><em>Hotel market<br />opportunities.</em></h1>
      </section>
    </main>
  );
}
