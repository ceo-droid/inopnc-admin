export const clearCache = async (): Promise<void> => {
  try {
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
    try {
      localStorage.removeItem('inopnc_app_state_cache_v1');
      localStorage.removeItem('inopnc_app_state_cache_ts_v1');
      localStorage.removeItem('inopnc_app_state_cache_v2');
      localStorage.removeItem('inopnc_app_state_cache_ts_v2');
    } catch {}
    try {
      sessionStorage.clear();
    } catch {}
  } catch (error) {
    throw new Error('캐시 정리 실패');
  }
};
