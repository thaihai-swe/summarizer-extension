(function () {
    const SIDE_PANEL_PATH = "sidepanel.html";
    let toolbarSidebarHandlerRegistered = false;
    let firefoxLastError = null;

    function createFirefoxCallbackCompat(namespace, path) {
        if (!namespace || typeof namespace !== "object") return namespace;
        return new Proxy(namespace, {
            get(target, property) {
                if (path === "runtime" && property === "lastError") return firefoxLastError;
                const value = target[property];
                if (typeof value === "function") {
                    return function (...args) {
                        const callback = typeof args[args.length - 1] === "function" ? args.pop() : null;
                        let returned;
                        try {
                            returned = value.apply(target, args);
                        } catch (error) {
                            if (!callback) throw error;
                            firefoxLastError = { message: error.message || String(error) };
                            try { callback(); } finally { firefoxLastError = null; }
                            return undefined;
                        }
                        if (!callback) return returned;
                        Promise.resolve(returned).then((response) => {
                            firefoxLastError = null;
                            callback(response);
                        }).catch((error) => {
                            firefoxLastError = { message: error && error.message || String(error) };
                            try { callback(); } finally { firefoxLastError = null; }
                        });
                        return undefined;
                    };
                }
                if (value && typeof value === "object" && typeof value.addListener === "function") return value;
                if (value && typeof value === "object") return createFirefoxCallbackCompat(value, path ? path + "." + String(property) : String(property));
                return value;
            }
        });
    }

    function installFirefoxChromeCompat() {
        const firefoxApi = globalThis.browser;
        if (!firefoxApi) return;
        if (!globalThis.chrome || globalThis.chrome === firefoxApi) globalThis.chrome = createFirefoxCallbackCompat(firefoxApi, "");
    }
    installFirefoxChromeCompat();

    function getApi() { return globalThis.chrome || globalThis.browser; }
    function hasChromeSidePanel() {
        const api = getApi();
        return Boolean(api && api.sidePanel && typeof api.sidePanel.open === "function");
    }
    function hasFirefoxSidebar() {
        const api = globalThis.browser || globalThis.chrome;
        return Boolean(api && api.sidebarAction && typeof api.sidebarAction.open === "function");
    }

    async function configurePrimarySidebarBehavior() {
        const api = getApi();
        if (!api) return;
        if (hasFirefoxSidebar()) {
            const firefoxApi = globalThis.browser || api;
            if (!toolbarSidebarHandlerRegistered && firefoxApi.action && firefoxApi.action.onClicked) {
                firefoxApi.action.onClicked.addListener(() => {
                    try { return Promise.resolve(firefoxApi.sidebarAction.open()).catch(() => {}); } catch (_) { return undefined; }
                });
                toolbarSidebarHandlerRegistered = true;
            }
            return;
        }
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
        if (hasFirefoxSidebar() || !hasChromeSidePanel() || typeof api.sidePanel.setOptions !== "function" || !tabId) return;
        await api.sidePanel.setOptions(enabled ? { tabId, path: SIDE_PANEL_PATH, enabled: true } : { tabId, enabled: false });
    }

    async function openPrimarySidebar(options) {
        const api = getApi();
        const opts = options || {};
        if (hasFirefoxSidebar()) {
            const firefoxApi = globalThis.browser || api;
            const opened = firefoxApi.sidebarAction.open();
            return opened && typeof opened.then === "function" ? opened : Promise.resolve(opened);
        }
        if (!hasChromeSidePanel()) throw new Error("Sidebar API is unavailable.");
        if (opts.tabId) await setSidePanelEnabledForTab(opts.tabId, true);
        return api.sidePanel.open(opts);
    }

    globalThis.SummarizerBrowserApi = {
        getApi,
        hasChromeSidePanel,
        hasFirefoxSidebar,
        configurePrimarySidebarBehavior,
        openPrimarySidebar,
        setSidePanelEnabledForTab
    };
})();
