(function () {
    const SETTINGS_KEY = "summarizerSettings";
    const RESULTS_KEY = "summarizerResultsByTab";
    const CONVERSATION_KEY = "summarizerConversationsByTab";
    const WORKFLOW_KEY = "summarizerWorkflowByTab";

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

    async function getResultsByTab() {
        const stored = await storageGet([RESULTS_KEY]);
        return stored[RESULTS_KEY] || {};
    }

    async function saveResultForTab(tabId, result) {
        const results = await getResultsByTab();
        results[String(tabId)] = result;
        await storageSet({ [RESULTS_KEY]: results });
        return result;
    }

    async function getResultForTab(tabId) {
        const results = await getResultsByTab();
        return results[String(tabId)] || null;
    }

    async function removeResultForTab(tabId) {
        const results = await getResultsByTab();
        delete results[String(tabId)];
        await storageSet({ [RESULTS_KEY]: results });
    }

    async function getConversationForTab(tabId) {
        const stored = await storageGet([CONVERSATION_KEY]);
        const conversations = stored[CONVERSATION_KEY] || {};
        return conversations[String(tabId)] || [];
    }

    async function saveConversationForTab(tabId, conversation) {
        const conversations = await storageGet([CONVERSATION_KEY]).then(
            (stored) => stored[CONVERSATION_KEY] || {}
        );
        conversations[String(tabId)] = conversation;
        await storageSet({ [CONVERSATION_KEY]: conversations });
        return conversation;
    }

    async function addMessageToConversation(tabId, message) {
        const conversation = await getConversationForTab(tabId);
        conversation.push({
            ...message,
            timestamp: new Date().toISOString()
        });
        return saveConversationForTab(tabId, conversation);
    }

    async function clearConversationForTab(tabId) {
        const conversations = await storageGet([CONVERSATION_KEY]).then(
            (stored) => stored[CONVERSATION_KEY] || {}
        );
        delete conversations[String(tabId)];
        await storageSet({ [CONVERSATION_KEY]: conversations });
    }

    async function getWorkflowByTab() {
        const stored = await storageGet([WORKFLOW_KEY]);
        return stored[WORKFLOW_KEY] || {};
    }

    async function getWorkflowStateForTab(tabId) {
        const workflows = await getWorkflowByTab();
        return workflows[String(tabId)] || null;
    }

    async function saveWorkflowStateForTab(tabId, workflowState) {
        const workflows = await getWorkflowByTab();
        workflows[String(tabId)] = workflowState;
        await storageSet({ [WORKFLOW_KEY]: workflows });
        return workflowState;
    }

    async function patchWorkflowStateForTab(tabId, partialState) {
        const current = (await getWorkflowStateForTab(tabId)) || {};
        const next = {
            ...current,
            ...partialState,
            updatedAt: new Date().toISOString()
        };
        return saveWorkflowStateForTab(tabId, next);
    }

    async function clearWorkflowStateForTab(tabId) {
        const workflows = await getWorkflowByTab();
        delete workflows[String(tabId)];
        await storageSet({ [WORKFLOW_KEY]: workflows });
    }

    async function clearTabData(tabId) {
        await Promise.all([
            removeResultForTab(tabId),
            clearConversationForTab(tabId),
            clearWorkflowStateForTab(tabId)
        ]);
    }

    async function pruneClosedTabData(openTabIds) {
        const openTabIdSet = new Set((openTabIds || []).map((tabId) => String(tabId)));
        const [results, conversations, workflows] = await Promise.all([
            getResultsByTab(),
            storageGet([CONVERSATION_KEY]).then((stored) => stored[CONVERSATION_KEY] || {}),
            getWorkflowByTab()
        ]);

        let hasChanges = false;

        Object.keys(results).forEach((tabId) => {
            if (!openTabIdSet.has(tabId)) {
                delete results[tabId];
                hasChanges = true;
            }
        });

        Object.keys(conversations).forEach((tabId) => {
            if (!openTabIdSet.has(tabId)) {
                delete conversations[tabId];
                hasChanges = true;
            }
        });

        Object.keys(workflows).forEach((tabId) => {
            if (!openTabIdSet.has(tabId)) {
                delete workflows[tabId];
                hasChanges = true;
            }
        });

        if (!hasChanges) {
            return;
        }

        await storageSet({
            [RESULTS_KEY]: results,
            [CONVERSATION_KEY]: conversations,
            [WORKFLOW_KEY]: workflows
        });
    }

    globalThis.SummarizerStorage = {
        getSettings,
        saveSettings,
        getResultForTab,
        saveResultForTab,
        removeResultForTab,
        getConversationForTab,
        saveConversationForTab,
        addMessageToConversation,
        clearConversationForTab,
        getWorkflowStateForTab,
        saveWorkflowStateForTab,
        patchWorkflowStateForTab,
        clearWorkflowStateForTab,
        clearTabData,
        pruneClosedTabData
    };
})();
