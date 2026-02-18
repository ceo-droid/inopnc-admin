import { useMemo, useState } from 'react';
import { Download, X } from 'lucide-react';
import { usePwaInstall } from '@/hooks/usePwaInstall';

export default function PwaInstallPrompt() {
  const { isIOS, isMobile, isStandalone, isInstallable, promptInstall } = usePwaInstall();
  const [dismissed, setDismissed] = useState(false);

  const isVisible = isMobile && !dismissed && !isStandalone;

  const description = useMemo(() => {
    if (isInstallable) return '앱으로 설치하면 홈 화면에서 바로 실행할 수 있습니다.';
    if (isIOS) return 'Safari 공유 버튼에서 "홈 화면에 추가"를 선택해 주세요.';
    return '브라우저 메뉴에서 "홈 화면에 추가"를 선택해 설치할 수 있습니다.';
  }, [isInstallable, isIOS]);

  if (!isVisible) return null;

  const handleDismiss = () => {
    setDismissed(true);
  };

  const handleInstall = async () => {
    const installed = await promptInstall();
    if (installed) setDismissed(true);
  };

  return (
    <div className="fixed inset-0 z-[120] bg-background/80 backdrop-blur-sm p-4 flex items-center justify-center">
      <div className="relative w-full max-w-sm rounded-3xl border border-border bg-card shadow-2xl px-5 py-6">
        <button
          onClick={handleDismiss}
          className="absolute right-3 top-3 rounded-lg p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground"
          aria-label="닫기"
        >
          <X size={16} />
        </button>

        <div className="flex flex-col items-center text-center">
          <img
            src="/icons/icon-192x192.png"
            alt="INOPNC 앱 아이콘"
            className="h-16 w-16 rounded-2xl border border-border/70 shadow-sm"
          />
          <div className="mt-3 rounded-full bg-primary/10 p-2 text-primary">
            <Download size={16} />
          </div>

          <p className="mt-3 text-lg font-extrabold text-foreground">앱 설치</p>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>

          <div className="mt-4 flex w-full items-center gap-2">
            {isInstallable && (
              <button
                onClick={handleInstall}
                className="flex-1 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground transition hover:brightness-110"
              >
                지금 설치
              </button>
            )}
            <button
              onClick={handleDismiss}
              className={`rounded-xl bg-muted px-4 py-2.5 text-sm font-bold text-foreground transition hover:bg-accent ${isInstallable ? 'flex-1' : 'w-full'}`}
            >
              {isInstallable ? '나중에' : '확인'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
