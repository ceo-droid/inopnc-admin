import { useEffect, useMemo, useState } from 'react';
import { Download, X } from 'lucide-react';
import { usePwaInstall } from '@/hooks/usePwaInstall';

const DISMISS_KEY = 'pwa_install_prompt_dismissed_at';
const DISMISS_TTL_MS = 24 * 60 * 60 * 1000;

const readDismissed = () => {
  if (typeof window === 'undefined') return false;
  const raw = localStorage.getItem(DISMISS_KEY);
  if (!raw) return false;
  const at = Number(raw);
  if (!Number.isFinite(at)) return false;
  return Date.now() - at < DISMISS_TTL_MS;
};

export default function PwaInstallPrompt() {
  const { isIOS, isStandalone, isInstallable, promptInstall } = usePwaInstall();
  const [dismissed, setDismissed] = useState(readDismissed);

  const showIOSGuide = isIOS && !isStandalone;
  const isVisible = !dismissed && !isStandalone && (isInstallable || showIOSGuide);

  useEffect(() => {
    if (dismissed) return;
    if (isInstallable || showIOSGuide) return;
    setDismissed(true);
  }, [dismissed, isInstallable, showIOSGuide]);

  const description = useMemo(() => {
    if (isInstallable) return '앱으로 설치하면 홈 화면에서 빠르게 실행할 수 있습니다.';
    return 'iPhone은 Safari 공유 버튼에서 홈 화면에 추가를 선택하세요.';
  }, [isInstallable]);

  if (!isVisible) return null;

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setDismissed(true);
  };

  const handleInstall = async () => {
    const installed = await promptInstall();
    if (installed) {
      localStorage.removeItem(DISMISS_KEY);
      setDismissed(true);
    }
  };

  return (
    <div className="fixed right-3 bottom-20 md:bottom-4 z-[70] w-[calc(100vw-24px)] max-w-sm rounded-2xl border border-border bg-card/95 backdrop-blur px-4 py-3 shadow-2xl">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 rounded-full bg-primary/10 p-2 text-primary">
          <Download size={16} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-foreground">앱 설치</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
          <div className="mt-3 flex items-center gap-2">
            {isInstallable ? (
              <button
                onClick={handleInstall}
                className="rounded-xl bg-primary px-3 py-2 text-xs font-bold text-primary-foreground transition hover:brightness-110"
              >
                지금 설치
              </button>
            ) : (
              <button
                onClick={handleDismiss}
                className="rounded-xl bg-muted px-3 py-2 text-xs font-bold text-foreground transition hover:bg-accent"
              >
                확인
              </button>
            )}
          </div>
        </div>
        <button
          onClick={handleDismiss}
          className="rounded-lg p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground"
          aria-label="닫기"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
