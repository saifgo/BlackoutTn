import { useCallback, useEffect, useState } from 'react';

/**
 * The `beforeinstallprompt` event isn't in the standard lib DOM types, so we
 * describe the shape we rely on here.
 */
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
  prompt(): Promise<void>;
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    // iOS Safari exposes standalone on the navigator.
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIos(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const iOsDevice = /iPad|iPhone|iPod/.test(ua);
  // iPadOS 13+ reports as a Mac; detect touch to disambiguate.
  const iPadOs = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  return iOsDevice || iPadOs;
}

export interface PwaInstall {
  /** True when the app can be installed (native prompt available or iOS). */
  canInstall: boolean;
  /** True once the app is running in installed/standalone mode. */
  installed: boolean;
  /** iOS has no programmatic prompt, so we show manual instructions instead. */
  needsManualInstructions: boolean;
  /** Triggers the native install prompt. Returns the user's choice outcome. */
  promptInstall: () => Promise<'accepted' | 'dismissed' | 'unavailable'>;
}

/**
 * Tracks PWA installability and exposes a way to trigger the browser's install
 * prompt. Falls back to signalling that manual (iOS) instructions are needed.
 */
export function usePwaInstall(): PwaInstall {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState<boolean>(isStandalone);
  const ios = isIos();

  useEffect(() => {
    function onBeforeInstallPrompt(e: Event) {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    }
    function onInstalled() {
      setInstalled(true);
      setDeferredPrompt(null);
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onInstalled);

    const mql = window.matchMedia?.('(display-mode: standalone)');
    const onDisplayChange = () => setInstalled(isStandalone());
    mql?.addEventListener?.('change', onDisplayChange);

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onInstalled);
      mql?.removeEventListener?.('change', onDisplayChange);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (!deferredPrompt) return 'unavailable' as const;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') setDeferredPrompt(null);
    return outcome;
  }, [deferredPrompt]);

  const needsManualInstructions = ios && !installed && !deferredPrompt;
  const canInstall = !installed && (deferredPrompt !== null || needsManualInstructions);

  return { canInstall, installed, needsManualInstructions, promptInstall };
}
