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
        "lib/prompts/templates/pdf.js",
        "lib/prompts/templates/prompt-enhance.js",
        "lib/prompts/builders.js",
        "lib/prompts.js",
        "lib/providers/shared.js",
        "lib/providers/gemini.js",
        "lib/providers/openai.js",
        "lib/providers/local.js",
        "lib/provider-registry.js",
        "lib/background/result-builder.js",
        "lib/background/tab-manager.js",
        "lib/background/ui-notifier.js",
        "lib/background/generation-service.js",
        "lib/background/summary-service.js"
    );
}

const MSG = SummarizerMessages.types;
const openSidePanelsByWindow = new Map();

function openSidePanelForTab(tabId) {
    if (!tabId) return Promise.resolve();
    if (!SummarizerBrowserApi.hasChromeSidePanel()) return Promise.resolve();
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
    return result;
}

function createContextMenus() {
    if (!chrome.contextMenus) return;
    chrome.contextMenus.removeAll(() => {
        chrome.contextMenus.create({ id: "deepdigest-summarize", title: "Summarize with DeepDigest", contexts: ["page", "selection"] });
    });
}


SummarizerBrowserApi.configurePrimarySidebarBehavior().catch(() => { });

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
    // Remove data written by releases that persisted per-tab session state.
    // This runs only during install/update, not on every service-worker wake.
    SummarizerStorage.clearLegacySessionData().catch(() => { });
});

chrome.runtime.onStartup.addListener(() => {
    createContextMenus();
    SummarizerBrowserApi.configurePrimarySidebarBehavior().catch(() => { });
});

if (SummarizerBrowserApi.hasChromeSidePanel() && chrome.sidePanel.onOpened && typeof chrome.sidePanel.onOpened.addListener === "function") {
    chrome.sidePanel.onOpened.addListener((info) => {
        openSidePanelsByWindow.set(info.windowId, info);
    });
}

if (SummarizerBrowserApi.hasChromeSidePanel() && chrome.sidePanel.onClosed && typeof chrome.sidePanel.onClosed.addListener === "function") {
    chrome.sidePanel.onClosed.addListener((info) => {
        openSidePanelsByWindow.delete(info.windowId);
    });
}

chrome.tabs.onActivated.addListener(({ tabId, windowId }) => {
    const openPanel = openSidePanelsByWindow.get(windowId);
    if (!openPanel || openPanel.tabId === tabId || !SummarizerBrowserApi.hasChromeSidePanel() || typeof chrome.sidePanel.close !== "function") {
        return;
    }

    const options = openPanel.tabId ? { tabId: openPanel.tabId } : { windowId };
    chrome.sidePanel.close(options).catch(() => { });
    if (openPanel.tabId) {
        SummarizerBrowserApi.setSidePanelEnabledForTab(openPanel.tabId, false).catch(() => { });
    }
});

chrome.tabs.onRemoved.addListener((tabId) => {
    SummarizerSummaryService.releaseTab(tabId);
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    (async () => {
        switch (message.type) {
            case MSG.SUMMARIZE_ACTIVE_TAB: {
                const tabId =
                    message.tabId || (sender.tab && sender.tab.id) || (await SummarizerTabManager.getActiveTab()).id;
                await SummarizerBrowserApi.setSidePanelEnabledForTab(tabId, true);
                const promptMode = message.promptMode || message.mode;
                if (promptMode) {
                    await SummarizerStorage.saveSettings({ promptMode });
                }
                const result = await SummarizerSummaryService.summarizeForTab(tabId);
                sendResponse(sender.tab
                    ? { ok: true, result: SummarizerResultBuilder.buildFloatingResult(result) }
                    : { ok: true, tabId });
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

            case MSG.GET_PUBLIC_SETTINGS: {
                const settings = await SummarizerStorage.getSettings();
                sendResponse({
                    ok: true,
                    settings: {
                        theme: settings.theme || "system",
                        showFloatingUi: Boolean(settings.showFloatingUi)
                    }
                });
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
                const grounding = message.grounding === "open" ? "open" : "source";
                const result = await SummarizerSummaryService.answerFollowUp(tabId, message.question || "", {
                    grounding,
                    result: message.result,
                    conversationHistory: message.conversationHistory
                });
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
        if (!tabWasClosed) {
            SummarizerUiNotifier.notifyError(error, tabId);
        }
        sendResponse({ ok: false, error: errorMessage });
    });

    return true;
});
