import Link from "next/link";
import { Lexend_Deca } from "next/font/google";
import { CityScene } from "../components/landing/CityScene";

// Landing-only typeface. Scoped to this page's <main> so the rest of the app
// keeps its default fonts. font-optical-sizing: auto comes for free via
// next/font's variable-font handling.
const lexendDeca = Lexend_Deca({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

export default function LandingPage() {
  return (
    <main className={`landing-shell ${lexendDeca.className}`}>
      <CityScene />
      <div className="landing-atmosphere" aria-hidden="true" />

      <section className="landing-hero">
        <h1>
          Inns<span className="landing-i">i</span>ght
        </h1>
        <p className="landing-tagline">Hotel market opportunities</p>
        <Link href="/discover" className="landing-cta">
          Get Started
          <span className="landing-cta-arrow" aria-hidden="true">&rarr;</span>
        </Link>
      </section>
    </main>
  );
}
