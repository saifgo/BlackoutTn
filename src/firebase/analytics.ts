import {
  getAnalytics,
  isSupported,
  logEvent,
  setUserId,
  setUserProperties,
  type Analytics,
} from 'firebase/analytics';
import { firebaseApp, firebaseConfigValues } from './config';

/**
 * Lightweight, safe wrapper around Firebase Analytics.
 *
 * Analytics is optional: it only initializes when a measurementId is configured
 * and the current environment supports it (e.g. not SSR, not an unsupported
 * browser). Every helper is a no-op when analytics is unavailable, so callers
 * never have to null-check.
 */

let analyticsPromise: Promise<Analytics | null> | null = null;

function initAnalytics(): Promise<Analytics | null> {
  if (analyticsPromise) return analyticsPromise;

  analyticsPromise = (async () => {
    if (!firebaseConfigValues.measurementId) {
      return null;
    }
    try {
      const supported = await isSupported();
      if (!supported) return null;
      return getAnalytics(firebaseApp);
    } catch {
      return null;
    }
  })();

  return analyticsPromise;
}

/** Firebase custom event names allow letters, numbers and underscores only. */
type AnalyticsParams = Record<string, string | number | boolean | undefined>;

/**
 * Log a custom analytics event. Safe to call anywhere: it resolves silently and
 * does nothing when analytics is not configured or supported.
 */
export function trackEvent(name: string, params?: AnalyticsParams): void {
  void initAnalytics().then((analytics) => {
    if (!analytics) return;
    logEvent(analytics, name, params);
  });
}

/** Associate subsequent events with a user id (or clear it when null). */
export function setAnalyticsUser(userId: string | null): void {
  void initAnalytics().then((analytics) => {
    if (!analytics) return;
    setUserId(analytics, userId);
  });
}

/** Set long-lived user properties for segmentation in the Firebase console. */
export function setAnalyticsUserProperties(props: Record<string, string>): void {
  void initAnalytics().then((analytics) => {
    if (!analytics) return;
    setUserProperties(analytics, props);
  });
}

/** Kick off analytics initialization eagerly (call once at app startup). */
export function warmAnalytics(): void {
  void initAnalytics();
}
