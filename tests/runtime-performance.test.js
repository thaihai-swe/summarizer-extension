const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");

function runScript(relativePath, context) {
    const source = fs.readFileSync(path.join(root, relativePath), "utf8");
    vm.runInNewContext(source, context, { filename: relativePath });
}

test("result projections do not duplicate transcript or raw model output", () => {
    const context = {
        globalThis: null,
        SummarizerProviders: { providers: { gemini: { label: "Gemini" } } }
    };
    context.globalThis = context;
    runScript("lib/background/result-builder.js", context);
    const parsed = {
        summary: "Summary",
        keyTakeaways: ["One"],
        rawText: "large raw response"
    };
    const extracted = {
        title: "Video",
        url: "https://example.com",
        sourceType: "youtube",
        content: "large transcript",
        contentRaw: "large transcript",
        contentForPrompt: "large transcript",
        transcriptSegments: [{ text: "Hello", startSeconds: 0, startLabel: "00:00" }]
    };
    const settings = {
        provider: "gemini",
        promptMode: "summarize",
        summarySize: "Medium",
        summaryLength: "Medium",
        gemini: { model: "test" }
    };
    const result = context.SummarizerResultBuilder.buildFullResult(
        parsed, extracted, settings, "gemini", 7, {}
    );
    assert.equal(result.sourceContentRaw, "");
    assert.equal(result.sourceContentForPrompt, "");
    assert.equal(result.rawText, undefined);
    assert.equal(result.transcriptSegments.length, 1);

    const stream = context.SummarizerResultBuilder.buildStreamResult(
        parsed, extracted, settings, "gemini", 7, {}
    );
    assert.equal(stream.sourceContentRaw, undefined);
    assert.equal(stream.transcriptSegments, undefined);
    assert.equal(stream.rawText, undefined);

    const floating = context.SummarizerResultBuilder.buildFloatingResult(result);
    assert.deepEqual(
        Object.keys(floating).sort(),
        ["keyTakeaways", "promptMode", "sourceType", "summary", "tabId", "title"].sort()
    );
});

test("browser adapter detects Chrome side panels and Firefox sidebars", () => {
    const chromeContext = {
        globalThis: null,
        chrome: {
            sidePanel: { open() {}, setOptions() {} }
        }
    };
    chromeContext.globalThis = chromeContext;
    runScript("lib/browser-api.js", chromeContext);
    assert.equal(chromeContext.SummarizerBrowserApi.hasChromeSidePanel(), true);
    assert.equal(chromeContext.SummarizerBrowserApi.hasFirefoxSidebar(), false);
    assert.equal(chromeContext.SummarizerBrowserApi.hasSupportedSidebar(), true);

    const firefoxContext = {
        globalThis: null,
        browser: {
            runtime: { id: "deepdigest@example.com" },
            sidebarAction: { open() {} }
        }
    };
    firefoxContext.globalThis = firefoxContext;
    runScript("lib/browser-api.js", firefoxContext);
    assert.equal(firefoxContext.SummarizerBrowserApi.hasChromeSidePanel(), false);
    assert.equal(firefoxContext.SummarizerBrowserApi.hasFirefoxSidebar(), true);
    assert.equal(firefoxContext.SummarizerBrowserApi.hasSupportedSidebar(), true);
});

test("section content normalization preserves list-shaped content", () => {
    const context = { globalThis: null };
    context.globalThis = context;
    runScript("lib/sidepanel/render.js", context);
    const normalize = context.SummarizerRender.normalizeSectionContent;
    assert.equal(normalize(["- First point", "- Second point"]), "- First point\n- Second point");
    assert.equal(normalize([]), "");
});

test("side panel result cache restores recent tabs without persistence", () => {
    const context = { globalThis: null };
    context.globalThis = context;
    runScript("lib/sidepanel/result-cache.js", context);
    const cache = context.SummarizerSidepanelResultCache.create(2);
    const first = { tabId: 1, summary: "First" };
    const second = { tabId: 2, summary: "Second" };
    const third = { tabId: 3, summary: "Third" };
    cache.remember(1, first);
    cache.remember(2, second);
    assert.equal(cache.get(1), first);
    cache.remember(3, third);
    assert.equal(cache.get(2), null);
    assert.equal(cache.get(1), first);
    assert.equal(cache.get(3), third);
    cache.remove(1);
    assert.equal(cache.get(1), null);
});

test("canonical headings are parsed into the active result shape", () => {
    const context = { globalThis: null };
    context.globalThis = context;
    runScript("lib/cleaners.js", context);
    const result = context.SummarizerCleaners.parseStructuredSummary([
        "## Main Summary",
        "A grounded summary.",
        "## Executive Takeaways",
        "- A takeaway",
        "## Complete Guided Walkthrough",
        "The complete walkthrough.",
        "## Caveats, Biases & Open Questions",
        "A caveat."
    ].join("\n"));
    assert.equal(result.summary, "A grounded summary.");
    assert.deepEqual(Array.from(result.keyTakeaways), ["A takeaway"]);
    assert.equal(result.detailedBreakdown, "The complete walkthrough.");
    assert.equal(result.expertCommentary, "A caveat.");
    assert.deepEqual(
        Array.from(Object.keys(result)).sort(),
        [
            "argumentAndInsight", "conceptMap", "conceptMapAndPrerequisites", "coreDefinitions",
            "detailedBreakdown", "detailsOfVideo", "evidenceAndDetails", "expertCommentary",
            "followUpQuestions", "keyTakeaways", "pitfallsWarnings", "practicalSteps",
            "prerequisitesMisconceptions", "rawText", "resourcesTools", "reviewKit", "sections", "summary", "unheadedContent"
        ].sort()
    );

    const conceptsResult = context.SummarizerCleaners.parseStructuredSummary([
        "## Concept Map",
        "- A concept",
        "## Core Definitions",
        "A definition."
    ].join("\n"));
    assert.equal(conceptsResult.summary, "");
    assert.deepEqual(Array.from(conceptsResult.keyTakeaways), []);
});

test("parser preserves requested custom top-level sections without flattening nested headings", () => {
    const context = { globalThis: null };
    context.globalThis = context;
    runScript("lib/cleaners.js", context);
    const result = context.SummarizerCleaners.parseStructuredSummary([
        "## Main Summary",
        "A grounded summary.",
        "## Reading Notes",
        "Keep this custom section.",
        "### Nested note",
        "The nested heading remains content.",
        "```markdown",
        "## Code example heading",
        "```",
        "## Another Custom Section",
        "A second custom section."
    ].join("\n"));
    assert.equal(result.summary, "A grounded summary.");
    assert.deepEqual(Array.from(result.sections, (section) => [section.heading, section.canonicalKey || null]), [
        ["Main Summary", "summary"],
        ["Reading Notes", null],
        ["Another Custom Section", null]
    ]);
    assert.match(result.sections[1].content, /### Nested note/);
    assert.match(result.sections[1].content, /## Code example heading/);
    assert.match(result.sections[1].content, /The nested heading remains content/);
    assert.notEqual(result.sections[1].id, result.sections[2].id);
});

test("duplicate canonical sections merge into typed content while custom sections remain distinct", () => {
    const context = { globalThis: null };
    context.globalThis = context;
    runScript("lib/cleaners.js", context);
    const result = context.SummarizerCleaners.parseStructuredSummary([
        "## Main Summary",
        "First summary.",
        "## Main Summary",
        "Second summary.",
        "## Notes",
        "Custom notes."
    ].join("\n"));
    assert.equal(result.summary, "First summary.\n\nSecond summary.");
    assert.equal(result.sections.filter((section) => section.canonicalKey === "summary").length, 2);
    assert.equal(result.sections.filter((section) => !section.canonicalKey).length, 1);
});

test("UI section map matches canonical prompt conditions", () => {
    const context = { globalThis: null };
    context.globalThis = context;
    runScript("lib/sidepanel/render.js", context);
    const keys = (result) => Array.from(context.SummarizerRender.getRequestedSectionMap(result), (item) => item.key);
    assert.deepEqual(keys({ promptMode: "summarize", sourceType: "webpage", summarySize: "Medium" }), [
        "detailedBreakdown", "evidenceAndDetails", "argumentAndInsight", "expertCommentary"
    ]);
    assert.deepEqual(keys({ promptMode: "summarize", sourceType: "youtube", summarySize: "Brief" }), [
        "detailedBreakdown", "expertCommentary"
    ]);
    assert.deepEqual(keys({ promptMode: "summarize", sourceType: "youtube", summarySize: "Deep" }), [
        "detailsOfVideo", "detailedBreakdown", "conceptMapAndPrerequisites", "evidenceAndDetails",
        "argumentAndInsight", "expertCommentary", "reviewKit"
    ]);
    assert.deepEqual(keys({ promptMode: "concepts", sourceType: "course", summarySize: "Deep" }), [
        "conceptMap", "coreDefinitions", "prerequisitesMisconceptions", "practicalSteps",
        "pitfallsWarnings", "resourcesTools"
    ]);
    assert.deepEqual(keys({ promptMode: "analyze", sourceType: "webpage", summarySize: "Medium" }), [
        "detailedBreakdown", "conceptMapAndPrerequisites", "evidenceAndDetails", "argumentAndInsight",
        "practicalSteps", "expertCommentary", "reviewKit"
    ]);
    const custom = context.SummarizerRender.getCustomSectionMap({
        sections: [
            { id: "canonical", heading: "Main Summary", content: "ignored", canonicalKey: "summary" },
            { id: "custom-notes", heading: "Reading Notes", content: "custom content" }
        ]
    });
    assert.deepEqual(JSON.parse(JSON.stringify(custom)), [{
        key: "custom-notes", label: "Reading Notes", content: "custom content", custom: true
    }]);
});

test("result builder keeps custom sections in full and stream results but not floating projections", () => {
    const context = {
        globalThis: null,
        SummarizerProviders: { providers: { gemini: { label: "Gemini" } } }
    };
    context.globalThis = context;
    runScript("lib/background/result-builder.js", context);
    const parsed = {
        summary: "Summary",
        sections: [
            { id: "canonical-summary", heading: "Main Summary", content: "Duplicate", canonicalKey: "summary" },
            { id: "result-section-notes", heading: "Reading Notes", content: "Custom notes." },
            { id: "empty", heading: "Empty", content: "" }
        ]
    };
    const extracted = { title: "Page", url: "https://example.com", sourceType: "webpage", content: "source" };
    const settings = { promptMode: "summarize", summarySize: "Medium", summaryLength: "Medium", gemini: { model: "test" } };
    const full = context.SummarizerResultBuilder.buildFullResult(parsed, extracted, settings, "gemini", 1, {});
    const stream = context.SummarizerResultBuilder.buildStreamResult(parsed, extracted, settings, "gemini", 1, {});
    assert.deepEqual(JSON.parse(JSON.stringify(full.sections)), [{ id: "result-section-notes", heading: "Reading Notes", content: "Custom notes." }]);
    assert.deepEqual(JSON.parse(JSON.stringify(stream.sections)), JSON.parse(JSON.stringify(full.sections)));
    assert.equal(Object.prototype.hasOwnProperty.call(context.SummarizerResultBuilder.buildFloatingResult(full), "sections"), false);
});

test("exports append custom sections after canonical sections", () => {
    const context = { globalThis: null };
    context.globalThis = context;
    runScript("lib/sidepanel/actions.js", context);
    const markdown = context.SummarizerSidepanelActions.buildExportBody({
        promptMode: "summarize",
        summary: "Summary",
        keyTakeaways: ["Takeaway"],
        sections: [{ heading: "Reading Notes", content: "Custom notes." }]
    });
    assert.ok(markdown.indexOf("## Main Summary") < markdown.indexOf("## Reading Notes"));
    assert.match(markdown, /## Reading Notes\n\nCustom notes\./);
});

test("quality contract uses the same active section families", () => {
    const context = { globalThis: null };
    context.globalThis = context;
    runScript("lib/summary-quality.js", context);
    const concepts = context.SummarizerQuality.buildQualityContract({
        sourceType: "course", promptMode: "concepts", summarySize: "Deep", summaryLength: "Medium"
    });
    assert.deepEqual(Array.from(concepts.required), ["conceptMap", "coreDefinitions", "prerequisitesMisconceptions"]);
    assert.deepEqual(Array.from(concepts.recommended), ["practicalSteps", "pitfallsWarnings", "resourcesTools"]);

    const analyze = context.SummarizerQuality.buildQualityContract({
        sourceType: "webpage", promptMode: "analyze", summarySize: "Medium", summaryLength: "Medium"
    });
    assert.equal(analyze.isDeep, true);
    assert.ok(analyze.recommended.includes("conceptMapAndPrerequisites"));
    assert.ok(analyze.recommended.includes("reviewKit"));
    assert.ok(analyze.recommended.includes("practicalSteps"));
});

test("quality coverage counts custom content without creating custom repair targets", () => {
    const context = { globalThis: null };
    context.globalThis = context;
    runScript("lib/summary-quality.js", context);
    const result = context.SummarizerQuality.evaluateSummary({
        summary: "A sufficiently useful summary with grounded context.",
        keyTakeaways: ["One", "Two", "Three"],
        sections: [{ heading: "Notes", content: "Additional source details and examples are preserved here." }]
    }, {
        sourceType: "webpage",
        promptMode: "summarize",
        summarySize: "Medium",
        summaryLength: "Medium",
        generateFollowUpQuestions: false,
        sourceLength: 100,
        sourceContent: "Additional source details and examples are preserved here."
    });
    assert.ok(result.coverage.outputLength > 0);
    assert.equal(result.sectionScores.Notes, undefined);
    assert.equal(result.missingSections.includes("Notes"), false);
});

test("section contract protects canonical headings while allowing requested custom additions", () => {
    const context = { globalThis: null };
    context.globalThis = context;
    runScript("lib/prompts/common.js", context);
    const contract = context.SummarizerPromptCommon.buildSectionContract([
        { heading: "Main Summary" },
        { heading: "Executive Takeaways" }
    ], "webpage").join("\n");
    assert.match(contract, /Do not rename, omit, or reorder any canonical section/);
    assert.match(contract, /append additional top-level `##` sections/);
});

test("content manifests load the shell but defer extractors", () => {
    const source = fs.readFileSync(path.join(root, "entrypoints/content.content.js"), "utf8");
    assert.match(source, /lib\/browser-api\.js/);
    assert.match(source, /lib\/messages\.js/);
    assert.doesNotMatch(source, /lib\/extractors\.js/);
    assert.doesNotMatch(source, /lib\/storage\.js/);
    assert.doesNotMatch(source, /lib\/settings-schema\.js/);
});

test("tab manager injects extractors once when the shell requests them", async () => {
    let messageCount = 0;
    const injections = [];
    const context = {
        globalThis: null,
        SummarizerMessages: { types: { EXTRACT_CONTENT: "EXTRACT_CONTENT", FETCH_COURSE_CONTENT: "FETCH_COURSE_CONTENT" } },
        SummarizerDebug: { logExtraction() { } },
        SummarizerBrowserApi: {},
        chrome: {
            runtime: { lastError: null },
            tabs: {
                get(tabId, callback) { callback({ id: tabId, url: "https://example.com/article" }); },
                query(options, callback) { callback([{ id: 9 }]); },
                sendMessage(tabId, payload, callback) {
                    messageCount += 1;
                    callback(messageCount === 1
                        ? { ok: false, code: "EXTRACTORS_NOT_READY" }
                        : { ok: true, data: { sourceType: "webpage", content: "ready" } });
                }
            },
            scripting: {
                executeScript(options, callback) {
                    injections.push(options.files);
                    callback();
                }
            }
        }
    };
    context.globalThis = context;
    runScript("lib/background/tab-manager.js", context);
    const result = await context.SummarizerTabManager.requestExtraction(9);
    assert.equal(result.content, "ready");
    assert.equal(messageCount, 2);
    assert.equal(injections.length, 1);
    assert.equal(injections[0].length, 1);
    assert.equal(injections[0][0], "extractors.js");
});

test("settings reads are cached and rapid writes are serialized", async () => {
    let stored = { summarizerSettings: { theme: "light" } };
    let reads = 0;
    let writes = 0;
    const listeners = [];
    const context = {
        globalThis: null,
        SummarizerSettingsSchema: {
            DEFAULTS: { theme: "system", fontScale: "md" },
            normalizeSettings: (value) => Object.assign({}, value),
            deepMerge(target, source) {
                const output = Object.assign({}, target || {});
                Object.keys(source || {}).forEach((key) => {
                    const value = source[key];
                    output[key] = value && typeof value === "object" && !Array.isArray(value)
                        ? this.deepMerge(output[key], value)
                        : value;
                });
                return output;
            }
        },
        chrome: {
            runtime: { lastError: null },
            storage: {
                local: {
                    get(keys, callback) { reads += 1; callback(stored); },
                    set(value, callback) {
                        writes += 1;
                        stored = Object.assign({}, stored, value);
                        callback();
                    },
                    remove(keys, callback) { callback(); }
                },
                onChanged: { addListener(listener) { listeners.push(listener); } }
            }
        }
    };
    context.globalThis = context;
    runScript("lib/storage.js", context);
    const first = await context.SummarizerStorage.getSettings();
    first.theme = "mutated";
    const second = await context.SummarizerStorage.getSettings();
    assert.equal(reads, 1);
    assert.equal(second.theme, "light");

    await Promise.all([
        context.SummarizerStorage.saveSettings({ theme: "dark" }),
        context.SummarizerStorage.saveSettings({ fontScale: "lg" })
    ]);
    const finalSettings = await context.SummarizerStorage.getSettings();
    assert.equal(writes, 2);
    assert.equal(finalSettings.theme, "dark");
    assert.equal(finalSettings.fontScale, "lg");
    assert.equal(listeners.length, 1);
});

test("provider stream timeout controllers stay active until response bodies are consumed", async () => {
    const providers = [
        ["lib/providers/gemini.js", "SummarizerProviderGemini", { apiKey: "test", model: "test" }],
        ["lib/providers/openai.js", "SummarizerProviderOpenAI", { apiKey: "test", model: "test" }],
        ["lib/providers/local.js", "SummarizerProviderLocal", { model: "test" }]
    ];

    for (const [script, providerName, providerSettings] of providers) {
        let streamStarted = false;
        let cleared = false;
        const context = {
            globalThis: null,
            SummarizerProviderShared: {
                getTimeoutMs: () => 10,
                createAbortController: () => ({
                    signal: {},
                    clear() {
                        assert.equal(streamStarted, true, `${providerName} cleared before stream consumption`);
                        cleared = true;
                    }
                }),
                executeFetch: async () => ({ ok: true, body: {} }),
                handleResponseError: async () => { throw new Error("unexpected response error"); },
                readStream: async (_response, onChunk) => {
                    streamStarted = true;
                    assert.equal(cleared, false, `${providerName} cleared before readStream`);
                    if (onChunk) onChunk("partial");
                    return "streamed response";
                },
                parseGeminiSseLine: () => "",
                parseOpenAiSseLine: () => "",
                parseOllamaJsonlLine: () => "",
                validateNonEmptyResponse: (text) => text,
                recordUsage() { }
            }
        };
        context.globalThis = context;
        runScript(script, context);
        const result = await context[providerName].generateText(
            "prompt",
            Object.assign({ summaryLength: "Medium", summarySize: "Medium" }, providerSettings),
            () => { },
            { usage: {} }
        );
        assert.equal(result, "streamed response");
        assert.equal(cleared, true);
    }
});

test("provider generation timeout is five minutes for every summary size and length", () => {
    const context = { globalThis: null };
    context.globalThis = context;
    runScript("lib/providers/shared.js", context);
    const getTimeoutMs = context.SummarizerProviderShared.getTimeoutMs;
    assert.equal(getTimeoutMs("Short", "Brief"), 300000);
    assert.equal(getTimeoutMs("Medium", "Medium"), 300000);
    assert.equal(getTimeoutMs("Long", "Deep"), 300000);
});

test("stream failures are not retried as hidden duplicate requests after output was emitted", async () => {
    let calls = 0;
    const context = {
        globalThis: null,
        SummarizerProviders: {
            generateText: async () => {
                calls += 1;
                const error = new Error("temporary stream failure");
                error.code = "NETWORK_TIMEOUT";
                throw error;
            },
            isTransientProviderError: () => true
        },
        SummarizerDebug: { logExtraction() { } }
    };
    context.globalThis = context;
    runScript("lib/background/generation-service.js", context);
    const requestContext = { streamedOutput: true };
    await assert.rejects(
        context.SummarizerGenerationService.generateTextWithRetry(
            "gemini", "prompt", {}, undefined, { requestContext }
        ),
        /temporary stream failure/
    );
    assert.equal(calls, 1);

    calls = 0;
    await assert.rejects(
        context.SummarizerGenerationService.generateTextWithRetry(
            "gemini", "prompt", {}, undefined, { requestContext: {} }
        ),
        /temporary stream failure/
    );
    assert.equal(calls, 1);
});
