(function () {
    const DEFAULT_MAX_ENTRIES = 4;

    function create(maxEntries) {
        const limit = Math.max(1, Number(maxEntries) || DEFAULT_MAX_ENTRIES);
        const entries = new Map();

        function remember(tabId, result) {
            if (tabId === null || tabId === undefined || !result) return;
            entries.delete(tabId);
            entries.set(tabId, result);
            while (entries.size > limit) {
                const oldestTabId = entries.keys().next().value;
                entries.delete(oldestTabId);
            }
        }

        function get(tabId) {
            if (tabId === null || tabId === undefined || !entries.has(tabId)) return null;
            const result = entries.get(tabId);
            // Touch the entry so frequently revisited tabs remain cached.
            entries.delete(tabId);
            entries.set(tabId, result);
            return result;
        }

        function remove(tabId) {
            entries.delete(tabId);
        }

        function clear() {
            entries.clear();
        }

        return { remember, get, remove, clear, get size() { return entries.size; } };
    }

    globalThis.SummarizerSidepanelResultCache = { create };
})();
