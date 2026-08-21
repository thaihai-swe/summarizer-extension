(function () {
    function notifyUi(result, tabId) {
        chrome.runtime.sendMessage({ type: SummarizerMessages.types.SUMMARY_UPDATED, result, tabId }, () => {
            void chrome.runtime.lastError;
        });

        chrome.tabs.sendMessage(tabId, { type: SummarizerMessages.types.SUMMARY_UPDATED, result, tabId }, () => {
            void chrome.runtime.lastError;
        });
    }

    function notifyChunk(result, tabId, rawText) {
        const payload = {
            type: SummarizerMessages.types.SUMMARY_CHUNK,
            result,
            rawText,
            tabId
        };

        chrome.runtime.sendMessage(payload, () => {
            void chrome.runtime.lastError;
        });
    }

    function notifyError(error, tabId) {
        const payload = {
            type: SummarizerMessages.types.SUMMARY_ERROR,
            error: error.message || "Unknown error.",
            code: error.code || "PROVIDER_ERROR",
            status: error.status || 0,
            provider: error.provider || "",
            tabId
        };

        chrome.runtime.sendMessage(payload, () => {
            void chrome.runtime.lastError;
        });

        if (tabId) {
            chrome.tabs.sendMessage(tabId, payload, () => {
                void chrome.runtime.lastError;
            });
        }
    }

    function notifySettingsUpdated(settings) {
        const payload = {
            type: SummarizerMessages.types.SETTINGS_UPDATED,
            settings,
            origin: "background-broadcast"
        };

        chrome.runtime.sendMessage(payload, () => {
            void chrome.runtime.lastError;
        });

        chrome.tabs.query({}, (tabs) => {
            void chrome.runtime.lastError;
            (tabs || []).forEach((tab) => {
                if (!tab || !tab.id) {
                    return;
                }
                chrome.tabs.sendMessage(tab.id, payload, () => {
                    void chrome.runtime.lastError;
                });
            });
        });
    }

    globalThis.SummarizerUiNotifier = {
        notifyUi,
        notifyChunk,
        notifyError,
        notifySettingsUpdated
    };
})();
