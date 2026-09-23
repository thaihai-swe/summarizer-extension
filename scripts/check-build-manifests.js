#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");

function readManifest(target) {
    const file = path.join(root, ".output", target, "manifest.json");
    if (!fs.existsSync(file)) {
        throw new Error(`Missing generated manifest: ${file}. Run the matching WXT build first.`);
    }
    return JSON.parse(fs.readFileSync(file, "utf8"));
}

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

function listJavaScriptFiles(directory) {
    return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const file = path.join(directory, entry.name);
        if (entry.isDirectory()) return listJavaScriptFiles(file);
        return entry.isFile() && file.endsWith(".js") ? [file] : [];
    });
}

const chrome = readManifest("chrome-mv3");
assert(chrome.manifest_version === 3, "Chrome target must be Manifest V3.");
assert(chrome.background?.service_worker === "background.js", "Chrome must use the generated background service worker.");
assert(chrome.side_panel?.default_path === "sidepanel.html", "Chrome must expose the side panel entrypoint.");
assert(chrome.permissions?.includes("sidePanel"), "Chrome must request the sidePanel permission.");
assert(!chrome.browser_specific_settings, "Chrome must not contain Firefox-only manifest settings.");
assert(chrome.content_scripts?.[0]?.js?.includes("content-scripts/content.js"), "Chrome must register the bundled content shell.");

const firefox = readManifest("firefox-mv3");
assert(firefox.manifest_version === 3, "Firefox target must be Manifest V3.");
assert(
    firefox.background?.service_worker === "background.js" || firefox.background?.scripts?.includes("background.js"),
    "Firefox must use the generated background entrypoint."
);
assert(firefox.sidebar_action?.default_panel === "sidepanel.html", "Firefox must expose the sidebar entrypoint.");
assert(!firefox.permissions?.includes("sidePanel"), "Firefox must not request Chrome's sidePanel permission.");
assert(firefox.browser_specific_settings?.gecko?.id, "Firefox must define a stable Gecko extension ID.");
assert(firefox.browser_specific_settings?.gecko?.data_collection_permissions, "Firefox must declare data collection permissions.");
assert(firefox.browser_specific_settings?.gecko?.strict_min_version === "140.0", "Desktop Firefox minimum version must be 140.");
assert(firefox.browser_specific_settings?.gecko_android?.strict_min_version === "142.0", "Firefox for Android minimum version must be 142.");
assert(firefox.content_scripts?.[0]?.js?.includes("content-scripts/content.js"), "Firefox must register the bundled content shell.");

const firefoxBundle = listJavaScriptFiles(path.join(root, ".output", "firefox-mv3"))
    .map((file) => fs.readFileSync(file, "utf8"))
    .join("\n");
assert(!firefoxBundle.includes("innerHTML"), "Firefox bundle must not use innerHTML.");
assert(!firefoxBundle.includes("sidePanel.onOpened"), "Firefox bundle must not reference Chrome sidePanel.onOpened.");
assert(!firefoxBundle.includes("sidePanel.onClosed"), "Firefox bundle must not reference Chrome sidePanel.onClosed.");
assert(!firefoxBundle.includes("sidePanel.close"), "Firefox bundle must not reference Chrome sidePanel.close.");

console.log("Generated Chrome and Firefox manifests passed parity checks.");
