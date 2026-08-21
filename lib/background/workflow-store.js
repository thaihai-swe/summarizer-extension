(function () {
    async function markExtracting(tabId, payload) {
        return SummarizerStorage.patchWorkflowStateForTab(tabId, {
            phase: "extracting",
            stage: "extracting",
            lastError: "",
            ...payload
        });
    }

    async function markSummarizing(tabId, payload) {
        return SummarizerStorage.patchWorkflowStateForTab(tabId, {
            phase: "summarizing",
            stage: payload && payload.stage ? payload.stage : "summarizing",
            lastError: "",
            ...payload
        });
    }

    async function markCompleted(tabId, payload) {
        return SummarizerStorage.patchWorkflowStateForTab(tabId, {
            phase: "completed",
            stage: "completed",
            lastError: "",
            ...payload
        });
    }

    async function markFailed(tabId, errorMessage, payload) {
        return SummarizerStorage.patchWorkflowStateForTab(tabId, {
            phase: "failed",
            stage: "failed",
            lastError: errorMessage || "Unexpected error.",
            ...payload
        });
    }

    async function getState(tabId) {
        return SummarizerStorage.getWorkflowStateForTab(tabId);
    }

    globalThis.SummarizerWorkflowStore = {
        markExtracting,
        markSummarizing,
        markCompleted,
        markFailed,
        getState
    };
})();
