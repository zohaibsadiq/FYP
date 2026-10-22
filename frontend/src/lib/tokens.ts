const ACCESS_KEY = "sw_access";
const REFRESH_KEY = "sw_refresh";

// The browser only tells other tabs when storage changes, never the tab that
// made the change. So a sign-out announces itself here, and the layout in this
// tab hears it too.
const CHANGED = "sw_tokens_changed";

function announce() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(CHANGED));
  }
}

// localStorage does not exist while the page is built on the server, and the
// browser throws an error when site data is blocked. Every read and write goes
// through this one guard so neither case crashes the app.
function withStorage<T>(fallback: T, op: (storage: Storage) => T): T {
  if (typeof window === "undefined") return fallback;
  try {
    return op(window.localStorage);
  } catch {
    return fallback;
  }
}

const readKey = (key: string) =>
  withStorage<string | null>(null, (storage) => storage.getItem(key));

const writeKey = (key: string, value: string) =>
  withStorage<void>(undefined, (storage) => storage.setItem(key, value));

const removeKey = (key: string) =>
  withStorage<void>(undefined, (storage) => storage.removeItem(key));

export const tokens = {
  getAccess: () => readKey(ACCESS_KEY),
  getRefresh: () => readKey(REFRESH_KEY),

  save(access: string, refresh: string) {
    writeKey(ACCESS_KEY, access);
    writeKey(REFRESH_KEY, refresh);
    announce();
  },

  saveAccess(access: string) {
    writeKey(ACCESS_KEY, access);
    announce();
  },

  clear() {
    removeKey(ACCESS_KEY);
    removeKey(REFRESH_KEY);
    announce();
  },

  isLoggedIn: () => Boolean(readKey(ACCESS_KEY)),

  subscribe(onChange: () => void) {
    if (typeof window === "undefined") return () => {};
    window.addEventListener("storage", onChange);
    window.addEventListener(CHANGED, onChange);
    return () => {
      window.removeEventListener("storage", onChange);
      window.removeEventListener(CHANGED, onChange);
    };
  },
};
