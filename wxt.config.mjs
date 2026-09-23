import { defineConfig } from "wxt";

const hostPermissions = [
  "<all_urls>",
  "https://generativelanguage.googleapis.com/*",
  "https://api.openai.com/*",
  "http://127.0.0.1:11434/*",
  "http://localhost:11434/*",
  "http://127.0.0.1:1234/*",
  "http://localhost:1234/*"
];

export default defineConfig({
  outDir: ".output",
  zip: {
    excludeSources: ["_site", ".output", ".wxt", "node_modules"]
  },
  manifestVersion: 3,
  manifest: ({ browser }) => ({
    name: "DeepDigest",
    description: "Deep, structured summaries of YouTube videos, webpages, courses, PDFs, academic papers, and selected text.",
    version: "0.1.0",
    permissions: ["storage", "tabs", "activeTab", "scripting", "contextMenus"],
    host_permissions: hostPermissions,
    action: {
      default_title: "Open DeepDigest",
      default_icon: {
        "16": "/icons/icon-16.png",
        "48": "/icons/icon-48.png",
        "128": "/icons/icon-128.png"
      }
    },
    icons: {
      "16": "/icons/icon-16.png",
      "48": "/icons/icon-48.png",
      "128": "/icons/icon-128.png"
    },
    options_ui: {
      page: "options.html",
      open_in_tab: true
    },
    commands: {
      summarize_page: {
        suggested_key: {
          default: "Ctrl+Shift+S",
          mac: "Command+Shift+S"
        },
        description: "Summarize current page"
      }
    },
    ...(browser === "firefox"
      ? {
          browser_specific_settings: {
            gecko: {
              id: "deepdigest@example.com",
              strict_min_version: "140.0",
              data_collection_permissions: {
                required: ["websiteContent", "authenticationInfo"]
              }
            },
            gecko_android: {
              strict_min_version: "142.0"
            }
          }
        }
      : {})
  })
});
