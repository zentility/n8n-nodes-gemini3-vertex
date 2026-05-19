# Changelog

All notable changes to this project are documented here. The format is based
on [Keep a Changelog](https://keepachangelog.com/), and this project follows
[Semantic Versioning](https://semver.org/).

## [0.2.4] - 2026-05-19

### Fixed

- The **Google Vertex Chat Model (Gemini 3)** sub-node now reports each LLM
  call's input and output in the n8n execution log. It attaches a tracing
  callback — `N8nTracing`, a dependency-free port of n8n's own
  `N8nNonEstimatingTracing`. Previously the sub-node returned a bare model
  with no callback, so n8n had nothing to display for it during a run.

## [0.2.3] - 2026-05-19

First published release.

### Added

- **Google Vertex Gemini 3** action node — a *Message a Model* operation that
  calls Vertex AI directly via `@google/genai`: multi-turn messages, system
  instruction, native thinking level, thought summaries, Google Search
  grounding, structured JSON output (response schema), per-category safety
  settings, and a streaming toggle. Supports Continue On Fail.
- **Google Vertex Chat Model (Gemini 3)** sub-node — a Chat Model for Agents
  and Chains via `@langchain/google-vertexai`: native thinking level, thinking
  budget, per-category safety settings, and a streaming flag.
- **Model** resource locator — searches the live Vertex catalogue
  (`ai.models.list`); leave it empty to auto-resolve the latest flash model
  (`pickLatestFlash`, excluding flash-lite and non-chat flash variants).
- **Thinking Level** resource locator — pick `MINIMAL`/`LOW`/`MEDIUM`/`HIGH`
  from a list, or switch to Expression mode for a dynamic value.
- **Safety Settings** — one threshold dropdown per harm category, all shown at
  once, with no per-row "add item" clicking.
- **Project ID** resource locator backed by the live GCP project list.
- Friendly error mapping for Vertex HTTP statuses (401/403/404/429/400).
- 45 unit tests and a live integration suite (`npm run test:integration`,
  15 tests) that verifies sent parameters take effect in Google's response.

### Changed

- Pinned `@langchain/google-vertexai` to `2.1.24` to match n8n's own runtime
  and avoid duplicate-`@langchain/core` conflicts.
- Upgraded `@google/genai` to `2.4.0`.
- Pinned `@google-cloud/resource-manager` to `5.3.1`. Its 6.x line ships a
  nested `gaxios` subtree that n8n's community-node loader fails to resolve
  (`ENOENT ... gaxios/build/src/index.js`); 5.3.1 loads reliably, at the cost
  of five low-severity transitive advisories.

### Notes

- `0.1.0`–`0.2.2` were earlier development versions; `0.2.3` supersedes them.
