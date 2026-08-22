(function () {
    async function loadSettings(elements) {
        const settings = await SummarizerStorage.getSettings();
        const presets = Array.isArray(settings.customPromptPresets) ? settings.customPromptPresets : [];
        let group = elements.modeSelect.querySelector('optgroup[label="Custom Presets"]');
        if (!group) { group = document.createElement("optgroup"); group.label = "Custom Presets"; elements.modeSelect.appendChild(group); }
        group.innerHTML = "";
        presets.forEach(p => {
            const opt = document.createElement("option"); opt.value = p.id; opt.textContent = p.name; group.appendChild(opt);
        });
        elements.modeSelect.value = settings.promptMode || "summarize";
        if (elements.modeSelect.selectedIndex < 0) elements.modeSelect.value = "summarize";
        if (elements.summaryLanguage) {
            const customList = String(settings.customLanguages || "").split(",").map((l) => String(l || "").trim()).filter(Boolean);
            const langs = Array.from(new Set(["English", "Vietnamese", ...customList]));
            const selected = settings.summaryLanguage || "English";
            elements.summaryLanguage.innerHTML = "";
            langs.forEach((lang) => {
                const opt = document.createElement("option");
                opt.value = lang;
                opt.textContent = lang;
                elements.summaryLanguage.appendChild(opt);
            });
            elements.summaryLanguage.value = langs.includes(selected) ? selected : "English";
        }
    }

    async function loadConversationHistory(tabId, appendChatEntry, chatLog) {
        const conversation = await SummarizerStorage.getConversationForTab(tabId);
        chatLog.innerHTML = "";
        conversation.forEach((msg) => {
            if (msg.type === "user-question") {
                const grounding = msg.grounding === "open" ? "open" : "source";
                appendChatEntry("question", msg.question, grounding);
                appendChatEntry("answer", msg.answer, grounding);
            }
        });
    }

    globalThis.SummarizerSidepanelState = {
        loadSettings,
        loadConversationHistory
    };
})();
