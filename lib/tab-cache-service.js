(function () {
    const resultCache = new Map();

    function cacheResult(tabId, result) {
        if (!tabId) return;
        if (result) {
            resultCache.set(tabId, result);
        } else {
            resultCache.delete(tabId);
        }
    }

    function getCachedResult(tabId) {
        return resultCache.get(tabId) || null;
    }

    function clearTabCache(tabId) {
        resultCache.delete(tabId);
    }

    globalThis.SummarizerTabCacheService = {
        cacheResult,
        getCachedResult,
        clearTabCache
    };
})();
