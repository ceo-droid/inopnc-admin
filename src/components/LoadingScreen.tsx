import { Loader2 } from 'lucide-react';

export const LoadingScreen = () => (
  <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50">
    <div className="flex flex-col items-center gap-4">
      <Loader2 className="w-12 h-12 animate-spin text-primary" />
      <p className="text-foreground">데이터를 불러오는 중입니다...</p>
    </div>
  </div>
);
