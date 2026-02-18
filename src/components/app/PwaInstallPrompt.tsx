import { useMemo, useState } from 'react';
import { Download, X } from 'lucide-react';
import { usePwaInstall } from '@/hooks/usePwaInstall';

type NavigatorWithShare = Navigator & {
  share?: (data: ShareData) => Promise<void>;
};

const LABELS = {
  close: '\uB2EB\uAE30',
  title: '\uC571 \uC124\uCE58',
  installNow: '\uC9C0\uAE08 \uC124\uCE58',
  later: '\uB098\uC911\uC5D0',
  confirm: '\uD655\uC778',
};

export default function PwaInstallPrompt() {
  const { isIOS, isMobile, isStandalone, isInstallable, promptInstall } = usePwaInstall();
  const [dismissed, setDismissed] = useState(false);
  const [manualHint, setManualHint] = useState(false);

  const isVisible = isMobile && !dismissed && !isStandalone;

  const description = useMemo(() => {
    if (isInstallable) {
      return 'Install the app for faster access from your home screen.';
    }

    if (manualHint) {
      return isIOS
        ? 'Use Safari share and choose "Add to Home Screen".'
        : 'Use browser menu and choose "Add to Home screen" or "Install app".';
    }

    return isIOS
      ? 'Tap confirm to open share sheet, then choose "Add to Home Screen".'
      : 'Tap confirm and choose "Add to Home screen" or "Install app" from browser menu.';
  }, [isInstallable, isIOS, manualHint]);

  if (!isVisible) return null;

  const handleDismiss = () => {
    setDismissed(true);
  };

  const handleInstall = async () => {
    const installed = await promptInstall();
    if (installed) {
      setDismissed(true);
      return true;
    }
    return false;
  };

  const handleConfirm = async () => {
    const installed = await handleInstall();
    if (installed) return;

    if (isIOS && typeof navigator !== 'undefined') {
      const nav = navigator as NavigatorWithShare;
      if (typeof nav.share === 'function') {
        try {
          await nav.share({ title: document.title, url: window.location.href });
        } catch {
          // User may close the share sheet.
        }
      }
    }

    setManualHint(true);
  };

  return (
    <div className="fixed inset-0 z-[120] bg-background/80 backdrop-blur-sm p-4 flex items-center justify-center">
      <div className="relative w-full max-w-sm rounded-3xl border border-border bg-card shadow-2xl px-5 py-6">
        <button
          onClick={handleDismiss}
          className="absolute right-3 top-3 rounded-lg p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground"
          aria-label={LABELS.close}
        >
          <X size={16} />
        </button>

        <div className="flex flex-col items-center text-center">
          <div className="rounded-full bg-primary/10 p-2 text-primary">
            <Download size={16} />
          </div>

          <p className="mt-3 text-lg font-extrabold text-foreground">{LABELS.title}</p>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>

          <div className="mt-4 flex w-full items-center gap-2">
            {isInstallable && (
              <button
                onClick={handleInstall}
                className="flex-1 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground transition hover:brightness-110"
              >
                {LABELS.installNow}
              </button>
            )}
            <button
              onClick={isInstallable ? handleDismiss : handleConfirm}
              className={`rounded-xl bg-muted px-4 py-2.5 text-sm font-bold text-foreground transition hover:bg-accent ${isInstallable ? 'flex-1' : 'w-full'}`}
            >
              {isInstallable ? LABELS.later : LABELS.confirm}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
