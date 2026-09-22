(function () {
    const SIDE_PANEL_PATH = "sidepanel.html";
    let toolbarSidebarHandlerRegistered = false;
    function getApi() {
        return globalThis.browser && globalThis.browser.runtime
            ? globalThis.browser
            : globalThis.chrome;
    }

    function hasChromeSidePanel() {
        const api = getApi();
        return Boolean(api && api.sidePanel && typeof api.sidePanel.open === "function");
    }

    function hasFirefoxSidebar() {
        const api = getApi();
        return Boolean(api && api.sidebarAction && typeof api.sidebarAction.open === "function");
    }

    function hasSupportedSidebar() {
        return hasChromeSidePanel() || hasFirefoxSidebar();
    }

    async function configurePrimarySidebarBehavior() {
        const api = getApi();
        if (hasChromeSidePanel() && typeof api.sidePanel.setPanelBehavior === "function") {
            try { await api.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }); } catch (_) {}
        }
        if (!toolbarSidebarHandlerRegistered && hasFirefoxSidebar() && api.action && api.action.onClicked) {
            api.action.onClicked.addListener(async () => {
                try {
                    await api.sidebarAction.open();
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

    function openPrimarySidebar(options) {
        const api = getApi();
        const opts = options || {};
        if (hasChromeSidePanel()) {
            // Keep the open call synchronous so Chrome retains the user gesture.
            const openPromise = api.sidePanel.open(opts);
            const enablePromise = opts.tabId
                ? setSidePanelEnabledForTab(opts.tabId, true)
                : Promise.resolve();
            return Promise.all([openPromise, enablePromise]).then(([opened]) => opened);
        }
        if (hasFirefoxSidebar()) return api.sidebarAction.open();
        throw new Error("Sidebar API is unavailable.");
    }

    globalThis.SummarizerBrowserApi = {
        getApi,
        hasChromeSidePanel,
        hasFirefoxSidebar,
        hasSupportedSidebar,
        configurePrimarySidebarBehavior,
        openPrimarySidebar,
        setSidePanelEnabledForTab
    };
})();
