export const clearCache = async (): Promise<void> => {
  try {
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
    try {
      sessionStorage.clear();
    } catch {}
  } catch (error) {
    throw new Error('캐시 정리 실패');
  }
};
