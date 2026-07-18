import { nanoid } from "nanoid";

const STORAGE_KEY = "innsight_session";

/** SSR-safe anonymous session id, persisted in localStorage. */
export function getSessionId(): string {
  if (typeof window === "undefined") return "ssr";
  let id = window.localStorage.getItem(STORAGE_KEY);
  if (!id) {
    id = nanoid();
    window.localStorage.setItem(STORAGE_KEY, id);
  }
  return id;
}
