(function () {
    const SETTINGS_KEY = "summarizerSettings";
    const LEGACY_SESSION_KEYS = [
        "summarizerResultsByTab",
        "summarizerConversationsByTab",
        "summarizerWorkflowByTab"
    ];

    const defaultSettings = SummarizerSettingsSchema.DEFAULTS;
    let settingsCache = null;
    let settingsRead = null;
    let settingsWrite = Promise.resolve();

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

    function cloneSettings(settings) {
        if (Array.isArray(settings)) return settings.map((item) => cloneSettings(item));
        if (!settings || typeof settings !== "object") return settings;
        const clone = {};
        Object.keys(settings).forEach((key) => {
            clone[key] = cloneSettings(settings[key]);
        });
        return clone;
    }

    async function getSettings() {
        if (!settingsCache) {
            if (!settingsRead) {
                settingsRead = storageGet([SETTINGS_KEY]).then((stored) => {
                    const normalized = normalizeSettings(stored[SETTINGS_KEY] || {});
                    settingsCache = SummarizerSettingsSchema.deepMerge(defaultSettings, normalized);
                    return settingsCache;
                }).finally(() => {
                    settingsRead = null;
                });
            }
            await settingsRead;
        }
        return cloneSettings(settingsCache);
    }

    function saveSettings(partialSettings) {
        const pending = settingsWrite.then(async () => {
            const current = await getSettings();
            const nextSettings = SummarizerSettingsSchema.deepMerge(current, partialSettings || {});
            await storageSet({ [SETTINGS_KEY]: nextSettings });
            settingsCache = nextSettings;
            return cloneSettings(nextSettings);
        });
        settingsWrite = pending.catch(() => {});
        return pending;
    }

    // Remove data written by releases that persisted per-tab session state.
    // Settings remain in chrome.storage.local; summaries and conversations do not.
    async function clearLegacySessionData() {
        await storageRemove(LEGACY_SESSION_KEYS);
    }

    if (chrome.storage && chrome.storage.onChanged) {
        chrome.storage.onChanged.addListener((changes, areaName) => {
            if (areaName !== "local" || !changes[SETTINGS_KEY]) return;
            const normalized = normalizeSettings(changes[SETTINGS_KEY].newValue || {});
            settingsCache = SummarizerSettingsSchema.deepMerge(defaultSettings, normalized);
        });
    }

    globalThis.SummarizerStorage = {
        getSettings,
        saveSettings,
        clearLegacySessionData
    };
})();
