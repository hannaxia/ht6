import { Auth0Client } from "@auth0/nextjs-auth0/server";

const requiredEnvironmentVariables = [
  "AUTH0_DOMAIN",
  "AUTH0_CLIENT_ID",
  "AUTH0_CLIENT_SECRET",
  "AUTH0_SECRET",
] as const;

export const isAuth0Configured = requiredEnvironmentVariables.every(
  (name) => Boolean(process.env[name]?.trim()),
);

/**
 * Auth0 is optional during local setup, like the other external services.
 * Constructing the client only when all credentials exist keeps degraded mode
 * usable while still surfacing genuine configuration errors once enabled.
 */
export const auth0 = isAuth0Configured ? new Auth0Client() : null;
