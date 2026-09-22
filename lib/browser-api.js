(function () {
    const SIDE_PANEL_PATH = "sidepanel.html";
    let toolbarSidebarHandlerRegistered = false;
    function getApi() { return globalThis.chrome; }

    function hasChromeSidePanel() {
        const api = getApi();
        return Boolean(api && api.sidePanel && typeof api.sidePanel.open === "function");
    }

    async function configurePrimarySidebarBehavior() {
        const api = getApi();
        if (!hasChromeSidePanel()) return;
        if (typeof api.sidePanel.setPanelBehavior === "function") {
            try { await api.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }); } catch (_) {}
        }
        if (!toolbarSidebarHandlerRegistered && api.action && api.action.onClicked) {
            api.action.onClicked.addListener(async () => {
                const tabs = await new Promise((resolve) => api.tabs.query({ active: true, currentWindow: true }, resolve));
                const tab = tabs && tabs[0];
                if (!tab || !tab.id) return;
                try {
                    await setSidePanelEnabledForTab(tab.id, true);
                    await api.sidePanel.open({ tabId: tab.id, windowId: tab.windowId });
                } catch (_) {}
            });
            toolbarSidebarHandlerRegistered = true;
        }
    }

    async function setSidePanelEnabledForTab(tabId, enabled) {
        const api = getApi();
        if (!hasChromeSidePanel() || typeof api.sidePanel.setOptions !== "function" || !tabId) return;
        await api.sidePanel.setOptions(enabled ? { tabId, path: SIDE_PANEL_PATH, enabled: true } : { tabId, enabled: false });
    }

    async function openPrimarySidebar(options) {
        const api = getApi();
        const opts = options || {};
        if (!hasChromeSidePanel()) throw new Error("Sidebar API is unavailable.");
        if (opts.tabId) await setSidePanelEnabledForTab(opts.tabId, true);
        return api.sidePanel.open(opts);
    }

    globalThis.SummarizerBrowserApi = {
        getApi,
        hasChromeSidePanel,
        configurePrimarySidebarBehavior,
        openPrimarySidebar,
        setSidePanelEnabledForTab
    };
})();
