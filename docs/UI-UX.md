# UI/UX system

DeepDigest uses one shared Cobalt design system across the side panel, Options page, and selected-text floating UI. The system is documented in the root `design.md` and portable tokens live in `tokens.css`.

## Interaction model

- The side panel is the primary workbench. `Generate` is the dominant action, while mode and output controls remain close to it.
- Results follow progressive disclosure: main summary, takeaways, deep sections, transcript, then follow-up questions.
- Export and copy actions are reversible or silent; they do not interrupt reading with confirmation dialogs.
- Loading, cancellation, error, and success states remain visible through the existing status and live-region elements.
- The Options page separates general preferences, providers, prompts, and display settings through tabs. Advanced prompt configuration stays available without competing with everyday controls.
- Selected text uses a contextual floating action. The floating UI can launch a summary or show the latest result without replacing the side panel workflow.

## Visual behavior

- Light and dark modes use the same semantic roles and Cobalt accent.
- Compact density is intended for narrow side-panel work; comfortable density is the default for reading and settings.
- Focus rings are always visible and are not animated.
- Motion is limited to short transform/opacity transitions and collapses under `prefers-reduced-motion`.
- Layouts are designed for 320px, 375px, 414px, and 768px widths without horizontal scrolling.

## Compatibility contract

The redesign preserves existing DOM IDs, storage keys, message shapes, extraction priority, provider integrations, and side-panel state behavior. It is a visual and interaction-layer redesign, not a workflow rewrite.
