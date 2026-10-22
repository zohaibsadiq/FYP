import { api } from "./api";

/**
 * Waking the server before anybody needs it.
 *
 * The backend is hosted on a free plan that puts the service to sleep after a
 * quiet spell, and starting it again takes the better part of a minute. The
 * first person through the door would otherwise watch an ordinary request sit
 * there and then fail, which reads as a broken app rather than a sleeping one.
 *
 * So the app knocks on the door the moment it loads. The health check needs no
 * sign-in and touches no data, and it runs while somebody is still reading the
 * page or typing their password. By the time they press anything, the server is
 * usually up.
 */

/** Long enough to cover a cold start, which the host says can pass fifty seconds. */
const WAKE_TIMEOUT_MS = 90_000;

/** A warm server answers in well under this, so the notice never flashes up. */
export const NOTICE_AFTER_MS = 4_000;

export async function wakeBackend(signal?: AbortSignal): Promise<boolean> {
  try {
    await api.get("/health/", { timeout: WAKE_TIMEOUT_MS, signal });
    return true;
  } catch {
    // Nothing is reported here. Whatever the person does next has its own
    // error handling, and two messages about one outage is one too many.
    return false;
  }
}
