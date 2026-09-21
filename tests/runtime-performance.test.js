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

test("section content normalization preserves list-shaped content", () => {
    const context = { globalThis: null };
    context.globalThis = context;
    runScript("lib/sidepanel/render.js", context);
    const normalize = context.SummarizerRender.normalizeSectionContent;
    assert.equal(normalize(["- First point", "- Second point"]), "- First point\n- Second point");
    assert.equal(normalize([]), "");
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
            "prerequisitesMisconceptions", "rawText", "resourcesTools", "reviewKit", "summary"
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

test("content manifests load the shell but defer extractors", () => {
    for (const filename of ["manifest.json", "manifest.firefox.json"]) {
        const manifest = JSON.parse(fs.readFileSync(path.join(root, filename), "utf8"));
        const scripts = manifest.content_scripts[0].js;
        assert.ok(scripts.includes("content.js"));
        assert.equal(scripts.includes("lib/storage.js"), false);
        assert.equal(scripts.includes("lib/settings-schema.js"), false);
        assert.equal(scripts.some((entry) => entry.includes("/extractors/")), false);
        assert.equal(scripts.includes("lib/extractors.js"), false);
    }
});

test("tab manager injects extractors once when the shell requests them", async () => {
    let messageCount = 0;
    const injections = [];
    const context = {
        globalThis: null,
        SummarizerMessages: { types: { EXTRACT_CONTENT: "EXTRACT_CONTENT", FETCH_COURSE_CONTENT: "FETCH_COURSE_CONTENT" } },
        SummarizerDebug: { logExtraction() {} },
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
    assert.ok(injections[0].includes("lib/extractors.js"));
    assert.equal(injections[0].includes("content.js"), false);
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
