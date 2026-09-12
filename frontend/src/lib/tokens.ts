const ACCESS_KEY = "sw_access";
const REFRESH_KEY = "sw_refresh";

// The storage event reaches every tab except the one that wrote, so a sign-out
// here has to announce itself for the layout to notice.
const CHANGED = "sw_tokens_changed";

function announce() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(CHANGED));
  }
}

// localStorage does not exist during SSR, and touching it throws outright when
// the browser blocks site data, so every read and write goes through one guard.
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
