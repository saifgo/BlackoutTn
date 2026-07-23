import { useEffect, useRef, useState } from 'react';
import { usePwaInstall } from '../hooks/usePwaInstall';
import { trackEvent } from '../firebase/analytics';

/**
 * "Install" button shown in the top bar. On supported browsers it triggers the
 * native install prompt; on iOS (which has no such API) it opens a small
 * popover explaining how to add the app to the home screen.
 */
export function InstallButton() {
  const { canInstall, needsManualInstructions, promptInstall } = usePwaInstall();
  const [showIosHelp, setShowIosHelp] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showIosHelp) return;
    function onDocClick(e: MouseEvent) {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) setShowIosHelp(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setShowIosHelp(false);
    }
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [showIosHelp]);

  if (!canInstall) return null;

  async function handleClick() {
    if (needsManualInstructions) {
      trackEvent('pwa_install_instructions_opened');
      setShowIosHelp((v) => !v);
      return;
    }
    trackEvent('pwa_install_clicked');
    const outcome = await promptInstall();
    trackEvent('pwa_install_choice', { outcome });
  }

  return (
    <div ref={containerRef} className="relative shrink-0">
      <button
        type="button"
        onClick={handleClick}
        aria-label="نصّب الأبليكاسيون"
        aria-expanded={needsManualInstructions ? showIosHelp : undefined}
        className="btn-secondary shrink-0 !min-h-[40px] !px-3 !py-2 text-xs sm:text-sm"
      >
        <DownloadIcon className="h-4 w-4" aria-hidden />
        <span className="hidden sm:inline">نصّب</span>
      </button>

      {needsManualInstructions && showIosHelp && (
        <div
          role="dialog"
          aria-label="نصّب الأبليكاسيون على الأيفون"
          className="absolute left-0 top-full z-[1100] mt-2 w-64 rounded-lg bg-slate-900/95 p-3 text-sm text-slate-100 shadow-xl ring-1 ring-white/10 backdrop-blur"
        >
          <p className="mb-2 font-semibold">زيد للشاشة الرئيسية</p>
          <ol className="list-decimal space-y-1 pr-4 text-slate-300">
            <li>
              اضغط على زر <span className="font-semibold text-slate-100">المشاركة</span>{' '}
              في سفاري.
            </li>
            <li>
              اختار{' '}
              <span className="font-semibold text-slate-100">إضافة للشاشة الرئيسية</span>.
            </li>
            <li>
              اضغط على <span className="font-semibold text-slate-100">زيد</span>.
            </li>
          </ol>
        </div>
      )}
    </div>
  );
}

function DownloadIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path
        d="M12 3v12m0 0 4-4m-4 4-4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
