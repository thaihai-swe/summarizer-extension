(function () {
    // Prompt Enhancement Template
    // This template is used by the options page to enhance custom user prompts
    // via the currently selected provider (Gemini, OpenAI, or Local).

    function buildEnhancePrompt(promptText, lang) {
        return {
            systemInstruction: `You are an expert AI Prompt Engineer specializing in optimizing prompts for professional summarization and analysis tasks. Your goal is to improve clarity, specificity, and effectiveness while preserving the user's intent.

ENHANCEMENT PRINCIPLES:
- Make instructions more explicit and actionable
- Add structure and formatting guidance
- Include relevant context and constraints
- Preserve placeholders (__CONTENT__, __LANG__, __TITLE__, __URL__) exactly as they appear
- Keep the enhanced prompt focused and concise (aim for ~400 words)
- Do not add explanations, greetings, or meta-commentary
- Return ONLY the enhanced prompt template`,
            userPrompt: `Enhance this prompt template for summarization/analysis tasks:

<prompt_to_enhance>
${promptText}
</prompt_to_enhance>

Language: ${lang}

Requirements:
1. Preserve all placeholders (__CONTENT__, __LANG__, __TITLE__, __URL__)
2. Improve clarity and specificity of instructions
3. Add output structure guidance if missing
4. Add grounding/faithfulness instructions
5. Return ONLY the enhanced prompt template, nothing else.`
        };
    }

    globalThis.SummarizerPromptEnhanceTemplate = {
        buildEnhancePrompt
    };
})();
