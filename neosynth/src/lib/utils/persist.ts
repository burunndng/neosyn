const STORAGE_PREFIX = "neosynth.";
const DEBOUNCE_MS = 400;

const timers = new Map<string, ReturnType<typeof setTimeout>>();

export function loadPersisted<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(STORAGE_PREFIX + key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed) &&
        fallback && typeof fallback === "object" && !Array.isArray(fallback)) {
      return { ...(fallback as object), ...(parsed as object) } as T;
    }
    return parsed as T;
  } catch {
    return fallback;
  }
}

export function savePersistedDebounced<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  const existing = timers.get(key);
  if (existing) clearTimeout(existing);
  timers.set(
    key,
    setTimeout(() => {
      try {
        window.localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value));
      } catch {
        // storage full / disabled — silently ignore
      }
      timers.delete(key);
    }, DEBOUNCE_MS),
  );
}

export function clearPersisted(key: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_PREFIX + key);
  } catch {
    // ignore
  }
}
