import { config as dotenv } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Single source of env truth: the repo-root .env (no per-package .env files).
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv({ path: path.join(repoRoot, ".env") });

// Treats "" the same as unset — a blank line in .env must still fall through.
function firstNonEmpty(...values) {
  return values.find((v) => v !== undefined && v !== "") ?? "";
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_BACKEND_URL: firstNonEmpty(
      process.env.NEXT_PUBLIC_BACKEND_URL,
      "http://localhost:4000",
    ),
    NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN: firstNonEmpty(
      process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN,
      process.env.MAPBOX_ACCESS_TOKEN,
    ),
    NEXT_PUBLIC_DEBUG: firstNonEmpty(process.env.NEXT_PUBLIC_DEBUG, "false"),
  },
};

export default nextConfig;
