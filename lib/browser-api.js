(function () {
    let toolbarSidebarHandlerRegistered = false;
    const SIDE_PANEL_PATH = "sidepanel.html";

    function hasChromeSidePanel() {
        return Boolean(globalThis.chrome && chrome.sidePanel && typeof chrome.sidePanel.open === "function");
    }

    async function configurePrimarySidebarBehavior() {
        if (!hasChromeSidePanel()) {
            return;
        }

        if (typeof chrome.sidePanel.setPanelBehavior === "function") {
            try {
                await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
            } catch (_) {
            }
        }

        if (!toolbarSidebarHandlerRegistered && chrome.action && typeof chrome.action.onClicked.addListener === "function") {
            chrome.action.onClicked.addListener(async () => {
                const tabs = await new Promise((resolve) => {
                    chrome.tabs.query({ active: true, currentWindow: true }, resolve);
                });
                const tab = tabs && tabs[0];
                if (!tab || !tab.id) {
                    return;
                }

                try {
                    await setSidePanelEnabledForTab(tab.id, true);
                    await chrome.sidePanel.open({ tabId: tab.id, windowId: tab.windowId });
                } catch (_) {
                }
            });
            toolbarSidebarHandlerRegistered = true;
        }
    }

    async function setSidePanelEnabledForTab(tabId, enabled) {
        if (!hasChromeSidePanel() || typeof chrome.sidePanel.setOptions !== "function" || !tabId) {
            return;
        }

        const options = enabled
            ? { tabId, path: SIDE_PANEL_PATH, enabled: true }
            : { tabId, enabled: false };

        await chrome.sidePanel.setOptions(options);
    }

    async function openPrimarySidebar(options) {
        const opts = options || {};
        if (!hasChromeSidePanel()) {
            throw new Error("Chrome Side Panel API is unavailable.");
        }

        if (opts.tabId) {
            await setSidePanelEnabledForTab(opts.tabId, true);
        }

        return chrome.sidePanel.open(opts);
    }

    globalThis.SummarizerBrowserApi = {
        configurePrimarySidebarBehavior,
        openPrimarySidebar,
        setSidePanelEnabledForTab
    };
})();
