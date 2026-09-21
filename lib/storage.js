(function () {
    const SETTINGS_KEY = "summarizerSettings";
    const LEGACY_SESSION_KEYS = [
        "summarizerResultsByTab",
        "summarizerConversationsByTab",
        "summarizerWorkflowByTab"
    ];

    const defaultSettings = SummarizerSettingsSchema.DEFAULTS;

    function storageGet(keys) {
        return new Promise((resolve, reject) => {
            chrome.storage.local.get(keys, (result) => {
                if (chrome.runtime.lastError) {
                    reject(new Error("Storage read failed: " + chrome.runtime.lastError.message));
                    return;
                }
                resolve(result);
            });
        });
    }

    function storageSet(value) {
        return new Promise((resolve, reject) => {
            chrome.storage.local.set(value, () => {
                if (chrome.runtime.lastError) {
                    reject(new Error("Storage write failed: " + chrome.runtime.lastError.message));
                    return;
                }
                resolve();
            });
        });
    }

    function storageRemove(keys) {
        return new Promise((resolve, reject) => {
            chrome.storage.local.remove(keys, () => {
                if (chrome.runtime.lastError) {
                    reject(new Error("Storage cleanup failed: " + chrome.runtime.lastError.message));
                    return;
                }
                resolve();
            });
        });
    }

    function normalizeSettings(raw) {
        if (globalThis.SummarizerSettingsSchema && typeof SummarizerSettingsSchema.normalizeSettings === "function") {
            const normalized = SummarizerSettingsSchema.normalizeSettings(raw || {});
            ["gemini", "openai", "local"].forEach((pid) => {
                if (!normalized[pid]) return;
                if (typeof normalized[pid].apiKey === "string") normalized[pid].apiKey = normalized[pid].apiKey.trim();
                if (typeof normalized[pid].baseUrl === "string") normalized[pid].baseUrl = normalized[pid].baseUrl.trim().replace(/\/$/, "");
            });
            return normalized;
        }
        if (!raw || typeof raw !== "object") return {};
        return { ...raw };
    }

    async function getSettings() {
        const stored = await storageGet([SETTINGS_KEY]);
        const normalized = normalizeSettings(stored[SETTINGS_KEY] || {});
        return SummarizerSettingsSchema.deepMerge(defaultSettings, normalized);
    }

    async function saveSettings(partialSettings) {
        const nextSettings = SummarizerSettingsSchema.deepMerge(await getSettings(), partialSettings || {});
        await storageSet({ [SETTINGS_KEY]: nextSettings });
        return nextSettings;
    }

    // Remove data written by releases that persisted per-tab session state.
    // Settings remain in chrome.storage.local; summaries and conversations do not.
    async function clearLegacySessionData() {
        await storageRemove(LEGACY_SESSION_KEYS);
    }

    globalThis.SummarizerStorage = {
        getSettings,
        saveSettings,
        clearLegacySessionData
    };
})();
