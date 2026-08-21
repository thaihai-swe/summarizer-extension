if (typeof importScripts === "function") {
    importScripts(
        "lib/browser-api.js",
        "lib/messages.js",
        "lib/settings-schema.js",
        "lib/storage.js",
        "lib/cleaners.js",
        "lib/semantic-chunker.js",
        "lib/summary-quality.js",
        "lib/debug.js",
        "lib/prompts/common.js",
        "lib/prompts/templates/youtube.js",
        "lib/prompts/templates/webpage.js",
        "lib/prompts/templates/course.js",
        "lib/prompts/templates/selected-text.js",
        "lib/prompts/templates/prompt-enhance.js",
        "lib/prompts/builders.js",
        "lib/prompts.js",
        "lib/providers/shared.js",
        "lib/providers/gemini.js",
        "lib/providers/openai.js",
        "lib/providers/local.js",
        "lib/provider-registry.js",
        "lib/tab-cache-service.js",
        "lib/background/tab-manager.js",
        "lib/background/workflow-store.js",
        "lib/background/ui-notifier.js",
        "lib/background/summary-service.js"
    );
}

const MSG = SummarizerMessages.types;
const openSidePanelsByWindow = new Map();
function openSidePanelForTab(tabId) {
    if (!tabId || !chrome.sidePanel) return Promise.resolve();
    // Must be called synchronously from a user gesture (context menu / command).
    // Do not await anything before this call or Chrome rejects it.
    const openPromise = typeof chrome.sidePanel.open === "function"
        ? chrome.sidePanel.open({ tabId }).catch(() => {})
        : Promise.resolve();
    const enablePromise = SummarizerBrowserApi.setSidePanelEnabledForTab(tabId, true).catch(() => {});
    return Promise.all([openPromise, enablePromise]);
}

async function startSummaryFromTab(tabId, options = {}) {
    if (!tabId) throw new Error("No active tab found.");
    if (options.promptMode) await SummarizerStorage.saveSettings({ promptMode: options.promptMode });
    const result = await SummarizerSummaryService.summarizeForTab(tabId);
    SummarizerTabCacheService.cacheResult(tabId, result);
    return result;
}

function createContextMenus() {
    if (!chrome.contextMenus) return;
    chrome.contextMenus.removeAll(() => {
        chrome.contextMenus.create({ id: "deepdigest-summarize", title: "Summarize with DeepDigest", contexts: ["page", "selection"] });
    });
}


SummarizerBrowserApi.configurePrimarySidebarBehavior().catch(() => { });

async function pruneClosedTabState() {
    const tabs = await chrome.tabs.query({});
    await SummarizerStorage.pruneClosedTabData(tabs.map((tab) => tab.id).filter(Boolean));
}

if (chrome.contextMenus && chrome.contextMenus.onClicked) {
    chrome.contextMenus.onClicked.addListener((info, tab) => {
        if (!tab || !tab.id || info.menuItemId !== "deepdigest-summarize") return;
        // Open panel immediately while still inside the user-gesture stack.
        openSidePanelForTab(tab.id);
        startSummaryFromTab(tab.id).catch((error) => SummarizerUiNotifier.notifyError(error, tab.id));
    });
}

if (chrome.commands && chrome.commands.onCommand) {
    chrome.commands.onCommand.addListener((command, tab) => {
        if (command !== "summarize_page") return;
        const run = async () => {
            const target = tab && tab.id ? tab : await SummarizerTabManager.getActiveTab();
            // Prefer opening with the gesture tab first when available.
            if (tab && tab.id) openSidePanelForTab(tab.id);
            else openSidePanelForTab(target.id);
            await startSummaryFromTab(target.id);
        };
        run().catch(async (error) => {
            try {
                const target = tab && tab.id ? tab : await SummarizerTabManager.getActiveTab();
                SummarizerUiNotifier.notifyError(error, target && target.id);
            } catch (_) {
                SummarizerUiNotifier.notifyError(error);
            }
        });
    });
}

chrome.runtime.onInstalled.addListener(() => {
    createContextMenus();
    SummarizerBrowserApi.configurePrimarySidebarBehavior().catch(() => { });
    pruneClosedTabState().catch(() => { });
});

chrome.runtime.onStartup.addListener(() => {
    createContextMenus();
    SummarizerBrowserApi.configurePrimarySidebarBehavior().catch(() => { });
    pruneClosedTabState().catch(() => { });
});

if (chrome.sidePanel && chrome.sidePanel.onOpened && typeof chrome.sidePanel.onOpened.addListener === "function") {
    chrome.sidePanel.onOpened.addListener((info) => {
        openSidePanelsByWindow.set(info.windowId, info);
    });
}

if (chrome.sidePanel && chrome.sidePanel.onClosed && typeof chrome.sidePanel.onClosed.addListener === "function") {
    chrome.sidePanel.onClosed.addListener((info) => {
        openSidePanelsByWindow.delete(info.windowId);
    });
}

chrome.tabs.onActivated.addListener(({ tabId, windowId }) => {
    const openPanel = openSidePanelsByWindow.get(windowId);
    if (!openPanel || openPanel.tabId === tabId || !chrome.sidePanel || typeof chrome.sidePanel.close !== "function") {
        return;
    }

    const options = openPanel.tabId ? { tabId: openPanel.tabId } : { windowId };
    chrome.sidePanel.close(options).catch(() => { });
    if (openPanel.tabId) {
        SummarizerBrowserApi.setSidePanelEnabledForTab(openPanel.tabId, false).catch(() => { });
    }
});

// Clear cache when tabs are closed
chrome.tabs.onRemoved.addListener((tabId) => {
    SummarizerSummaryService.releaseTab(tabId);
    SummarizerTabCacheService.clearTabCache(tabId);
    SummarizerStorage.clearTabData(tabId).catch(() => { });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    (async () => {
        switch (message.type) {
            case MSG.SUMMARIZE_ACTIVE_TAB: {
                const tabId =
                    message.tabId || (sender.tab && sender.tab.id) || (await SummarizerTabManager.getActiveTab()).id;
                await SummarizerBrowserApi.setSidePanelEnabledForTab(tabId, true);
                if (message.mode) {
                    await SummarizerStorage.saveSettings({ promptMode: message.mode });
                }
                const result = await SummarizerSummaryService.summarizeForTab(tabId);
                // Cache result for tab
                SummarizerTabCacheService.cacheResult(tabId, result);
                sendResponse({ ok: true, result });
                return;
            }

            case MSG.GET_ACTIVE_TAB_RESULT: {
                const tab = await SummarizerTabManager.getActiveTab();
                // Try cache first for better performance
                let result = SummarizerTabCacheService.getCachedResult(tab.id);
                if (!result) {
                    result = await SummarizerStorage.getResultForTab(tab.id);
                    if (result) {
                        // Repopulate cache from storage
                        SummarizerTabCacheService.cacheResult(tab.id, result);
                    }
                }
                sendResponse({ ok: true, result, tabId: tab.id });
                return;
            }

            case MSG.GET_ACTIVE_TAB_WORKFLOW: {
                const tab = await SummarizerTabManager.getActiveTab();
                const workflow = await SummarizerWorkflowStore.getState(tab.id);
                sendResponse({ ok: true, workflow, tabId: tab.id });
                return;
            }

            case MSG.CLEAR_TAB_DATA: {
                const tabId =
                    message.tabId || (sender.tab && sender.tab.id) || (await SummarizerTabManager.getActiveTab()).id;
                SummarizerTabCacheService.clearTabCache(tabId);
                await SummarizerStorage.clearTabData(tabId);
                sendResponse({ ok: true, tabId });
                return;
            }

            case MSG.CANCEL_SUMMARIZE: {
                const tabId =
                    message.tabId || (sender.tab && sender.tab.id) || (await SummarizerTabManager.getActiveTab()).id;
                SummarizerSummaryService.cancelSummaryForTab(tabId);
                sendResponse({ ok: true, tabId });
                return;
            }

            case MSG.OPEN_SIDE_PANEL: {
                sendResponse(await SummarizerTabManager.openSidePanel());
                return;
            }

            case MSG.SETTINGS_UPDATED: {
                if (message.origin === "background-broadcast") {
                    sendResponse({ ok: true });
                    return;
                }
                const settings = message.settings || await SummarizerStorage.getSettings();
                SummarizerUiNotifier.notifySettingsUpdated(settings);
                sendResponse({ ok: true, settings });
                return;
            }

            case MSG.DEEP_DIVE_ACTIVE_TAB: {
                const tabId =
                    message.tabId || (sender.tab && sender.tab.id) || (await SummarizerTabManager.getActiveTab()).id;
                const result = await SummarizerSummaryService.answerFollowUp(tabId, message.question || "");
                sendResponse({ ok: true, result });
                return;
            }

            default:
                sendResponse({ ok: false, error: "Unknown message type." });
        }
    })().catch((error) => {
        const tabId = (message && message.tabId) || (sender.tab && sender.tab.id);
        const errorMessage = error && error.message ? error.message : "Unexpected error.";
        const tabWasClosed = /tab was closed before summarization completed/i.test(errorMessage);
        if (tabId && !tabWasClosed) {
            SummarizerWorkflowStore.markFailed(tabId, error.message || "Unexpected error.").catch(() => { });
        }
        if (!tabWasClosed) {
            SummarizerUiNotifier.notifyError(error, tabId);
        }
        sendResponse({ ok: false, error: errorMessage });
    });

    return true;
});
