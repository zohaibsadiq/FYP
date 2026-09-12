/**
 * Where we keep the login tokens.
 *
 * We use localStorage. Honest trade-off you should know (and can explain if an
 * examiner asks): localStorage is readable by JavaScript, so it is vulnerable to
 * XSS attacks. The more secure option is an httpOnly cookie, but that requires
 * extra CSRF handling between two different domains. For a project of this size
 * localStorage is the normal, accepted choice.
 *
 * Everything is wrapped in try/catch because localStorage throws in some
 * browsers (private mode, cookies blocked) and during server-side rendering.
 */

const ACCESS_KEY = "sw_access";
const REFRESH_KEY = "sw_refresh";

function safeGet(key: string): string | null {
  if (typeof window === "undefined") return null; // running on the server
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* storage blocked - ignore */
  }
}

function safeRemove(key: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

export const tokens = {
  getAccess: () => safeGet(ACCESS_KEY),
  getRefresh: () => safeGet(REFRESH_KEY),

  save(access: string, refresh: string) {
    safeSet(ACCESS_KEY, access);
    safeSet(REFRESH_KEY, refresh);
  },

  /** Used after a silent refresh, when only the access token changed. */
  saveAccess(access: string) {
    safeSet(ACCESS_KEY, access);
  },

  clear() {
    safeRemove(ACCESS_KEY);
    safeRemove(REFRESH_KEY);
  },

  isLoggedIn: () => Boolean(safeGet(ACCESS_KEY)),
};
