#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const repoRoot = path.resolve(__dirname, "..");

function loadScript(relativePath, context) {
    const absolutePath = path.join(repoRoot, relativePath);
    const code = fs.readFileSync(absolutePath, "utf8");
    vm.runInContext(code, context, { filename: absolutePath });
}

function buildContext() {
    const context = vm.createContext({
        console,
        globalThis: {},
        window: {},
        setTimeout,
        clearTimeout
    });
    context.window = context.globalThis;
    context.global = context.globalThis;
    return context;
}

function printBlock(title, text) {
    console.log(`\n===== ${title} =====\n`);
    console.log(text);
}

const context = buildContext();

[
    "lib/prompts/common.js",
    "lib/prompts/templates/youtube.js",
    "lib/prompts/templates/webpage.js",
    "lib/prompts/templates/course.js",
    "lib/prompts/templates/selected-text.js"
].forEach((file) => loadScript(file, context));

[
    "SummarizerPromptCommon",
    "SummarizerYoutubePromptTemplate",
    "SummarizerWebpagePromptTemplate",
    "SummarizerCoursePromptTemplate",
    "SummarizerSelectedTextPromptTemplate"
].forEach((key) => {
    context[key] = context.globalThis[key];
});

loadScript("lib/prompts/builders.js", context);

const builders = context.globalThis.SummarizerPromptBuilders;

const baseSettings = {
    promptMode: "summarize",
    summarySize: "Medium",
    summaryLanguage: "English",
    summaryTone: "Simple",
    customPromptInstructions: "",
    customSystemInstructions: "",
    youtubePromptHint: "",
    webpagePromptHint: "",
    coursePromptHint: "",
    selectedTextPromptHint: "",
    analyzePromptHint: "",
    explainPromptHint: "",
    debatePromptHint: "",
    studyPromptHint: "",
    outlinePromptHint: "",
    timelinePromptHint: "",
    generateFollowUpQuestions: true
};

const youtubeContext = {
    sourceType: "youtube",
    title: "How Databases Handle Transactions",
    url: "https://www.youtube.com/watch?v=example",
    content: "[00:00] Intro to transactions\n[01:24] ACID properties explained\n[03:10] Isolation levels and anomalies\n[05:55] Real examples from PostgreSQL",
    contentForPrompt: "[00:00] Intro to transactions\n[01:24] ACID properties explained\n[03:10] Isolation levels and anomalies\n[05:55] Real examples from PostgreSQL",
    videoDetails: {
        channelName: "Systems Lab",
        durationText: "12:44",
        publishDate: "April 10, 2026",
        viewCountText: "42,000 views",
        transcriptLanguage: "English",
        captionTrackLabel: "English",
        transcriptFormat: "timestamped",
        hasTimestamps: true,
        chapters: [
            { startLabel: "00:00", title: "Overview" },
            { startLabel: "03:10", title: "Isolation Levels" }
        ]
    },
    summary: "Transactions group operations so the database can keep data consistent even when failures or concurrency happen.",
    keyTakeaways: ["ACID properties define reliability.", "Isolation levels trade safety for performance."],
    mainPoints: "Transactions, ACID, isolation levels, anomalies, practical tradeoffs.",
    detailedBreakdown: "The speaker walks from basic transaction semantics to concrete isolation examples.",
    expertCommentary: "The video is strong on intuition but lighter on implementation tradeoffs.",
    sourceContent: "[00:00] Intro to transactions...",
    sourceContentRaw: "[00:00] Intro to transactions...",
    conversationHistory: [
        { question: "Why does isolation matter?", answer: "It prevents anomalies under concurrent access." }
    ]
};

const webpageContext = {
    sourceType: "webpage",
    title: "Designing Reliable APIs",
    url: "https://example.com/reliable-apis",
    content: "Reliable APIs need idempotency, timeouts, retries, and explicit error contracts. The article also covers observability and rollout strategy."
};

const courseContext = {
    sourceType: "course",
    title: "Coursera: Introduction to Caching",
    url: "https://coursera.org/learn/caching/lesson/1",
    content: "Caching reduces latency and load. This lesson explains cache hits, misses, eviction, invalidation, and consistency tradeoffs."
};

const selectedTextContext = {
    sourceType: "selectedText",
    title: "RFC excerpt",
    url: "https://example.com/rfc",
    content: "A cache MUST invalidate stale representations when the origin indicates the resource changed."
};

printBlock("YouTube Summary Prompt", builders.buildSummaryPrompt(youtubeContext, baseSettings));
printBlock(
    "YouTube Chunk Prompt",
    builders.buildChunkSummaryPrompt(
        youtubeContext,
        "[00:00] Intro to transactions\n[01:24] ACID properties explained",
        0,
        3,
        { ...baseSettings, promptMode: "timeline" }
    )
);
printBlock(
    "YouTube Synthesis Prompt",
    builders.buildSynthesisPrompt(
        youtubeContext,
        [
            "## Chunk Summary\nTransactions define grouped operations.\n\n## Key Evidence\n- ACID properties\n\n## Details of the Video\n### Overview [00:00]\n- Defines transaction boundaries.",
            "## Chunk Summary\nIsolation prevents concurrency anomalies.\n\n## Key Evidence\n- Dirty reads\n- Non-repeatable reads\n\n## Details of the Video\n### Isolation [03:10]\n- Tradeoffs across levels."
        ],
        { ...baseSettings, promptMode: "analyze" }
    )
);
printBlock("Webpage Summary Prompt", builders.buildSummaryPrompt(webpageContext, { ...baseSettings, promptMode: "outline" }));
printBlock("Course Summary Prompt", builders.buildSummaryPrompt(courseContext, { ...baseSettings, promptMode: "study" }));
printBlock("Selected Text Prompt", builders.buildSummaryPrompt(selectedTextContext, { ...baseSettings, promptMode: "explain" }));
printBlock(
    "Deep Dive Prompt",
    builders.buildDeepDivePrompt(
        youtubeContext,
        "What tradeoffs does the speaker highlight between strict isolation and throughput?",
        { ...baseSettings, promptMode: "analyze", customPromptInstructions: "Prefer practical engineering implications." }
    )
);
