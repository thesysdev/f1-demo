// An anonymous visitor id, as in the OpenUI docs chat. There's no sign-in: the browser makes up
// an id once per tab session and sends it when asking for a frontend token, and Gateway scopes
// that token to the id, so each visitor lists and opens only their own threads. It separates
// visitors; it doesn't prove who anyone is.

export const USER_ID_HEADER = "x-f1-demo-user-id";

const STORAGE_KEY = "f1-demo-user-id";
const PATTERN = /^f1_demo_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const isUserId = (value: string | null): value is string => value !== null && PATTERN.test(value);

/** Server: the visitor id from the request, or null when it's missing or malformed. */
export function readUserId(request: Request): string | null {
  const id = request.headers.get(USER_ID_HEADER);
  return isUserId(id) ? id : null;
}

/** Browser: this tab session's visitor id, made on first use. */
export function getOrCreateUserId(): string {
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (isUserId(stored)) return stored;
  } catch {
    // Storage unavailable: use a fresh id for this page load.
  }
  const id = `f1_demo_${crypto.randomUUID()}`;
  try {
    sessionStorage.setItem(STORAGE_KEY, id);
  } catch {}
  return id;
}
