# Changelog

## Unreleased

### Added
- Context-menu item **Summarize with DeepDigest** for page and selection.
- Keyboard command `summarize_page` (`Ctrl+Shift+S` / `Cmd+Shift+S`).
- Custom Prompt Presets in Options, selectable from the side-panel mode dropdown.
- Result execution metadata badge with available token usage and generation duration.
- Synchronous side-panel open path that preserves the Chrome user-gesture token for context-menu and command launches.
- Streaming summary responses for Gemini, OpenAI, and local providers.
- Side panel progressive rendering via `SUMMARY_CHUNK` messages while generation is in progress.

### Changed
- Provider interface now accepts optional `onChunk(accumulatedText)` for final generation passes.
- Intermediate chunking requests remain non-streaming; only the final/synthesis pass streams.


All notable changes to the Summarizer Chrome extension are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Actionable provider error handling with request timeouts and one retry for transient failures
- Explicit YouTube chapter-aware summary guidance
- Compact side panel UI with optimized spacing
- Styled tooltips on icon buttons (Copy, Export, Settings, Clear)
- Comprehensive developer documentation suite:
  - MAINTENANCE.md - Common maintenance tasks
  - DEBUGGING.md - Debugging techniques and tools
  - TESTING.md - Testing procedures and checklist
  - TROUBLESHOOTING.md - Solutions to common issues
- Enhanced README with clearer navigation for developers
- Developer Quick Start section in README

### Changed
- Hero card reduced from 20px to 10px padding
- Status badge styling for more compact display
- Button sizing optimized for space efficiency
- Content card padding reduced from 14px to 10px
- Overall layout gap reduced from 16px to 12px
- Chat entry padding reduced for better space usage

### Fixed
- Icon button tooltips now display on hover with smooth animations
- UI spacing inconsistencies across components

## [1.0.0] - 2026-04-12

### Added
- Initial stable release of Summarizer extension
- Support for multiple content sources:
  - YouTube videos (transcript extraction)
  - Web articles and blog posts (semantic extraction)
  - Selected/highlighted text
  - Course lessons (Udemy and Coursera)
- Multiple summarization modes:
  - Summarize (default concise summary)
  - Analyze (detailed analysis)
  - Explain (clear explanation)
  - Debate (pro/con arguments)
  - Study (structured for learning)
  - Outline (bullet-point format)
  - Timeline (chronological format)
- LLM provider support:
  - Google Gemini API
  - OpenAI ChatGPT API
  - Local endpoints (Ollama, OpenAI-compatible)
- Side panel UI for viewing and managing summaries
- Summary export (Markdown and plain text)
- Follow-up Q&A functionality
- Per-tab summary storage with isolation
- Custom instructions for fine-tuning summaries
- Settings page for configuration
- Console logging for debugging

### Architecture
- Content extraction layer (7 extractor modules)
- Prompt building system with dynamic templates
- Background orchestration worker
- Side panel rendering engine
- Message-based communication system
- Chrome extension message passing
- Storage abstraction layer
- Provider registry pattern

### Documentation
- User Guide (docs/USER_GUIDE.md)
- Setup Guide (docs/SETUP.md)
- Architecture Documentation (docs/ARCHITECTURE.md)
- Workflow Guide (docs/WORKFLOW.md)
- API Reference (docs/API.md)
- Prompt System Documentation (docs/PROMPTS.md)
- Content Pipeline Documentation (docs/CONTENT_PIPELINE.md)
- Provider Documentation (docs/PROVIDERS.md)
- Storage Documentation (docs/STORAGE.md)
- UI Documentation (docs/UI.md)
- Contributing Guide (docs/CONTRIBUTING.md)

## Release Notes by Version

### Version 1.0.0 Release Notes

**Release Date:** April 12, 2026

**Key Features:**
- Multi-source content summarization
- Flexible summarization modes
- Multiple LLM provider support
- Per-tab result isolation
- Export functionality
- Follow-up Q&A

**Known Limitations:**
- Streaming summary mode not implemented (uses blocking generation)
- Floating mini UI not yet implemented (side panel is primary UI)
- No automated testing suite (manual testing only)
- Zero npm dependencies (pure vanilla JavaScript)

**Browser Support:**
- Chrome 90+
- Chromium-based browsers (Edge, Brave, etc.)

**Performance Baseline:**
- YouTube extraction: typically < 500ms
- Webpage extraction: typically < 1000ms
- API response time: 2-10 seconds (depends on provider and content length)
- Extension memory: 5-15 MB

## Version History Summary

| Version    | Release Date | Status         | Notes                                   |
| ---------- | ------------ | -------------- | --------------------------------------- |
| 1.0.0      | 2026-04-12   | Stable         | Initial release with core functionality |
| Unreleased | -            | In Development | UI improvements and documentation       |

## Migration Guides

### Updating to 1.0.0 from Beta

If you were using a beta version:

1. Back up your settings by exporting them
2. Unload the old extension from `chrome://extensions/`
3. Load the new version
4. Settings should auto-migrate or you can restore from backup

## Contributing to Changelog

To add entries to this changelog:

1. Update unreleased section with your changes
2. Follow the format:
   - **Added** for new features
   - **Changed** for changes in existing functionality
   - **Deprecated** for soon-to-be removed features
   - **Fixed** for bug fixes
   - **Security** for security fixes
   - **Removed** for removed features

3. Use clear, descriptive language
4. Reference files where applicable
5. When releasing, move Unreleased to new version with date

## Future Roadmap

Planned features for future releases:

### Next Minor Release (1.1.0)
- [ ] Streaming summary mode
- [ ] Floating mini UI
- [ ] Summary history/archive
- [ ] Keyboard shortcuts
- [ ] Dark mode refinements

### Next Major Release (2.0.0)
- [ ] Automated test suite (Jest/Mocha)
- [ ] Multi-language support
- [ ] Cloud sync for settings
- [ ] Advanced caching strategy
- [ ] Performance optimizations

## Maintenance Notes

### Deprecation Policy

Features deprecated in a release will be removed 2 minor versions later:
- Deprecated in 1.1.0 → Removed in 1.3.0

### Security Updates

Security updates are released as patch versions (1.0.1, 1.0.2, etc.) immediately when discovered.

### Long-term Support

- Last major version (1.x) will receive updates for at least 12 months
- Minimum of 3 patch releases per major version
- Critical security fixes backported to earlier versions if needed

## Questions?

- **Debugging issues?** See [DEBUGGING.md](docs/DEBUGGING.md)
- **Troubleshooting?** See [TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md)
- **Maintenance?** See [MAINTENANCE.md](docs/MAINTENANCE.md)
- **Testing?** See [TESTING.md](docs/TESTING.md)
