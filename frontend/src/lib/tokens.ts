const ACCESS_KEY = "sw_access";
const REFRESH_KEY = "sw_refresh";

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
  },

  saveAccess(access: string) {
    writeKey(ACCESS_KEY, access);
  },

  clear() {
    removeKey(ACCESS_KEY);
    removeKey(REFRESH_KEY);
  },

  isLoggedIn: () => Boolean(readKey(ACCESS_KEY)),
};
