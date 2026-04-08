import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { ScreenOrientation } from '@capacitor/screen-orientation';

const unlockNativeOrientation = async () => {
  try {
    await ScreenOrientation.unlock();
  } catch (error) {
    console.warn('[native-orientation] Failed to unlock screen orientation.', error);
  }
};

export const useNativeOrientation = () => {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const syncOrientation = () => {
      void unlockNativeOrientation();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        syncOrientation();
      }
    };

    syncOrientation();
    window.addEventListener('focus', syncOrientation);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('focus', syncOrientation);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);
};
