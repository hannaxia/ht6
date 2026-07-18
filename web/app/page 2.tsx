import { redirect } from "next/navigation";

// The app opens directly on the fullscreen Market Discovery map.
export default function LandingPage() {
  redirect("/discover");
}
