(function () {
    /**
     * Centralised settings schema.
     * Single source of truth for default values, valid values, and normalisation.
     * All storage consumers should reference this module, not inline defaults.
     */

    const SECTIONS = {
        summary: {
            promptMode: {
                type: "select", default: "summarize", valid: new Set(["summarize", "analyze", "explain", "debate", "study", "outline", "timeline", "concepts"]), normalize: (v) => {
                    const value = String(v || "summarize").trim() || "summarize";
                    if (value.startsWith("preset-")) return value;
                    return new Set(["summarize", "analyze", "explain", "debate", "study", "outline", "timeline", "concepts"]).has(value) ? value : "summarize";
                }
            },
            summarySize: { type: "select", default: "Medium", valid: new Set(["Brief", "Medium", "Deep"]) },
            summaryLength: { type: "select", default: "Medium", valid: new Set(["Short", "Medium", "Long"]) },
            summaryLanguage: {
                type: "text", default: "English", valid: null,
                normalize: (v) => String(v || "English").trim() || "English"
            },
            summaryTone: { type: "select", default: "Simple", valid: new Set(["Simple", "Professional", "Academic", "Expert", "Friendly"]) }
        },
        display: {
            theme: { type: "select", default: "system", valid: new Set(["system", "light", "dark"]) },
            density: { type: "select", default: "comfortable", valid: new Set(["comfortable", "compact"]) },
            fontScale: { type: "select", default: "md", valid: new Set(["sm", "md", "lg", "xl"]) }
        },
        behavior: {
            showFloatingUi: { type: "boolean", default: false },
            generateFollowUpQuestions: { type: "boolean", default: true },
            customLanguages: { type: "text", default: "" }
        },
        prompts: {
            customPromptInstructions: { type: "text", default: "" },
            customSystemInstructions: { type: "text", default: "" },
            youtubePromptHint: { type: "text", default: "" },
            webpagePromptHint: { type: "text", default: "" },
            coursePromptHint: { type: "text", default: "" },
            selectedTextPromptHint: { type: "text", default: "" },
            analyzePromptHint: { type: "text", default: "" },
            explainPromptHint: { type: "text", default: "" },
            debatePromptHint: { type: "text", default: "" },
            studyPromptHint: { type: "text", default: "" },
            outlinePromptHint: { type: "text", default: "" },
            timelinePromptHint: { type: "text", default: "" },
            conceptsPromptHint: { type: "text", default: "" },
            customPromptPresets: {
                type: "array", default: [], normalize: (v) => {
                    if (!Array.isArray(v)) return [];
                    return v.map((item, index) => {
                        if (!item || typeof item !== "object") return null;
                        const name = String(item.name || "").trim();
                        const systemPrompt = String(item.systemPrompt || "").trim();
                        const userPrompt = String(item.userPrompt || "").trim();
                        if (!name || (!systemPrompt && !userPrompt)) return null;
                        return {
                            id: String(item.id || ("preset-" + Date.now().toString(36) + "-" + index)),
                            name: name.slice(0, 80),
                            systemPrompt: systemPrompt.slice(0, 4000),
                            userPrompt: userPrompt.slice(0, 8000),
                            createdAt: item.createdAt || new Date().toISOString(),
                            updatedAt: item.updatedAt || new Date().toISOString()
                        };
                    }).filter(Boolean).slice(0, 50);
                }
            }
        },
        advancedPrompts: {
            promptAdvancedMode: { type: "object", default: { youtube: false, webpage: false, course: false, selectedText: false, chapter: false } },
            customSystemPrompt: { type: "object", default: { youtube: "", webpage: "", course: "", selectedText: "", chapter: "" } },
            customUserPrompt: { type: "object", default: { youtube: "", webpage: "", course: "", selectedText: "", chapter: "" } }
        },
        providers: {
            provider: { type: "select", default: "gemini", valid: new Set(["gemini", "openai", "local"]) },
            gemini: { type: "object", default: { apiKey: "", model: "gemini-3.5-flash-lite", useGeminiDirectVideo: false } },
            openai: { type: "object", default: { apiKey: "", model: "gpt-4o-mini", baseUrl: "https://api.openai.com/v1" } },
            local: { type: "object", default: { baseUrl: "http://127.0.0.1:11434", model: "llama3.1", endpointType: "ollama" } }
        }
    };

    function buildDefaults() {
        const out = {};
        Object.values(SECTIONS).forEach((section) => {
            Object.keys(section).forEach((key) => {
                out[key] = section[key].default;
            });
        });
        return out;
    }

    const DEFAULTS = buildDefaults();

    function getValidValues(key) {
        for (const section of Object.values(SECTIONS)) {
            if (key in section && section[key].valid) return section[key].valid;
        }
        return null;
    }

    function normalizeSettings(raw) {
        if (!raw || typeof raw !== "object") return {};
        const out = {};
        Object.values(SECTIONS).forEach((section) => {
            Object.keys(section).forEach((key) => {
                const rule = section[key];
                const rawVal = raw[key];
                if (rawVal === undefined || rawVal === null) return;
                if (rule.normalize) {
                    out[key] = rule.normalize(rawVal);
                } else if (rule.valid && rule.valid instanceof Set) {
                    out[key] = rule.valid.has(rawVal) ? rawVal : rule.default;
                } else if (rule.type === "boolean") {
                    out[key] = Boolean(rawVal);
                } else if (rule.type === "object") {
                    if (rawVal && typeof rawVal === "object" && !Array.isArray(rawVal)) {
                        out[key] = Object.assign({}, rule.default, rawVal);
                    } else {
                        out[key] = rule.default;
                    }
                } else {
                    out[key] = rawVal;
                }
            });
        });
        // Also propagate any extra keys (for forward compatibility)
        Object.keys(raw).forEach((key) => {
            if (!(key in out)) out[key] = raw[key];
        });
        return out;
    }

    function deepMerge(target, source) {
        const output = Array.isArray(target) ? target.slice() : { ...target };
        Object.keys(source || {}).forEach((key) => {
            const sv = source[key];
            if (sv && typeof sv === "object" && !Array.isArray(sv)) {
                output[key] = deepMerge(target[key], sv);
            } else {
                output[key] = sv;
            }
        });
        return output;
    }

    globalThis.SummarizerSettingsSchema = {
        SECTIONS,
        DEFAULTS,
        normalizeSettings,
        deepMerge,
        getValidValues,
        buildDefaults
    };
})();
