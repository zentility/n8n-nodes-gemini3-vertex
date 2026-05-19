# Gemini 3 Vertex AI — n8n Community Node Package

**Date:** 2026-05-19
**Status:** Approved

## Goal

Ship an n8n community node package that exposes Gemini 3 capabilities for
Google Vertex AI which the built-in `LmChatGoogleVertex` node does not surface:
thinking level, thought summaries, streaming, Google Search grounding, and
structured JSON output.

## Decisions

- **Distribution:** standalone npm community node package, installable via
  n8n's Community Nodes UI.
- **Backend:** Vertex AI only (GCP service-account auth).
- **Form factor:** two nodes in one package — a Chat Model sub-node (drop-in
  replacement for `LmChatGoogleVertex`) and a regular action node.
- **Libraries:** sub-node uses `@langchain/google-vertexai` (`ChatVertexAI`,
  required because it returns a LangChain model); action node uses
  `@google/genai` in Vertex mode for direct, current Gemini 3 feature access.
- **Auth:** reuse n8n's built-in `googleApi` credential — no custom credential.

## Package layout

```
n8n-nodes-gemini3-vertex/
  package.json            # declares both nodes in the "n8n" field
  tsconfig.json
  gulpfile.js             # copies icons into dist
  .eslintrc.js            # eslint-plugin-n8n-nodes-base
  index.js
  nodes/
    shared/
      auth.ts             # service-account -> auth options, project/region extraction
      modelFields.ts      # model name + thinking-level field definitions
      errors.ts           # HTTP status -> friendly NodeOperationError messages
      gcpProjects.ts      # gcpProjectsList listSearch method
    GoogleVertexChatModelG3/
      GoogleVertexChatModelG3.node.ts
      google.svg
    GoogleVertexGemini3/
      GoogleVertexGemini3.node.ts
      google.svg
  docs/superpowers/specs/  # this spec
```

## Node 1 — Chat Model sub-node (`GoogleVertexChatModelG3`)

Display name: **Google Vertex Chat Model (Gemini 3)**. Output:
`AiLanguageModel`. Drop-in replacement for `LmChatGoogleVertex`.

Carried over unchanged from the original node:

- `googleApi` credential, `projectId` resourceLocator with `gcpProjectsList`
  search, free-text model name field (default a Gemini 3 model).
- Options: temperature, topP, topK, maxOutputTokens, safety settings,
  legacy `thinkingBudget`.
- `onFailedAttempt` handler and the "Unsupported model" / "Invalid options"
  catch behaviour.

New Gemini 3 options added to the Options collection:

- **Thinking Level** — dropdown using Google's documented `thinking_level`
  enum for Gemini 3 (`low`/`high`, or `minimal`/`low`/`medium`/`high` if
  Google has expanded it; exact enum pinned during implementation against
  the live API docs). When set, it takes precedence over `thinkingBudget`;
  if both are supplied the node surfaces a notice and uses `thinkingLevel`.
- **Include Thought Summaries** — boolean, requests `includeThoughts`.
- **Streaming** — boolean, sets the `ChatVertexAI` `streaming` constructor flag.

Grounding and JSON-schema output are intentionally **not** on this node — they
conflict with how n8n Agents bind their own tools. They live on the action node.

### Implementation caveat

`@langchain/google-vertexai` exposes `thinkingBudget` today; `thinkingLevel`
and `includeThoughts` support depends on the installed version. The
implementation must verify the installed version forwards these to the API
(`generationConfig`). If a feature genuinely cannot reach the API through
LangChain, document it as action-node-only rather than silently dropping it.

## Node 2 — Action node (`GoogleVertexGemini3`)

Display name: **Google Vertex Gemini 3**. Regular node, one operation:
**Message a Model**. Calls Vertex directly via
`new GoogleGenAI({ vertexai: true, project, location })`, authenticated from
the `googleApi` service-account credential.

### Inputs

- **Project ID** — resourceLocator with the `gcpProjectsList` search.
- **Model** — string, default a Gemini 3 model.
- **Messages** — fixedCollection of `role` (User / Model) + `text`; handles
  single-turn and multi-turn.
- **System Instruction** — optional text field.

### Options collection

- temperature, topP, topK, maxOutputTokens, safety settings.
- **Thinking Level** + **Include Thought Summaries** (as in the sub-node).
- **Enable Google Search Grounding** — boolean; adds `tools: [{ googleSearch: {} }]`.
- **Response Format** — *Text* (default) or *JSON*. When JSON, the user
  supplies a **Response Schema** (pasted JSON Schema); node sets
  `responseMimeType: 'application/json'` + `responseSchema`.

### Streaming toggle

Top-level boolean **Stream Response**: off → `generateContent`,
on → `generateContentStream`. n8n passes whole items downstream, so even in
streaming mode the node aggregates chunks into one final result.

### Conflict guard

Gemini does not allow Search grounding and a forced response schema together.
If both are enabled the node throws a clear error before calling the API.

### Output (one JSON item)

```
{ text, thoughtSummary?, parsedJson?, groundingMetadata?, usageMetadata, raw }
```

- `thoughtSummary` only when Include Thought Summaries is on.
- `parsedJson` only when Response Format = JSON.
- `groundingMetadata` (sources/citations) only when grounding is on.
- `usageMetadata` = token counts; `raw` = full candidate.

The action node supports **Continue On Fail** (errors become an output item).

## Error handling

Shared `errors.ts` maps Vertex HTTP statuses to clear `NodeOperationError`s:

- `401/403` → auth/permission (check service account + Vertex API enabled).
- `404` → model not found / not available in region.
- `429` → quota exceeded.
- `400` → invalid request (echo Google's detail).

The sub-node keeps the original's `onFailedAttempt` handler. The action node
validates the grounding + JSON-schema conflict before the API call and
respects Continue On Fail.

## Testing

Jest, mocked — no live API calls in CI.

- Mock `@google/genai`'s `GoogleGenAI` client and the `ChatVertexAI` constructor.
- Coverage: option→API-config mapping (thinking level, safety, sampling);
  thinking-level-wins-over-budget precedence; grounding+schema conflict throws;
  HTTP-status→message mapping; output shaping (`parsedJson` only in JSON mode,
  `groundingMetadata` only when grounding on); Continue-On-Fail error item.

## Build & tooling

- TypeScript; `gulpfile.js` copies `google.svg` into `dist`.
- `eslint-plugin-n8n-nodes-base` for n8n lint rules.
- `index.js` entry; `package.json` with the `n8n` field listing both nodes.
- README: installation, `googleApi` credential setup, and the
  Agent-tool-binding caveat for grounding/JSON.

### Manual verification (outside CI)

Load the package into a local n8n instance: confirm both nodes appear, the GCP
project search works, and a real Gemini 3 call succeeds.

## Out of scope

- Gemini API / AI Studio backend (Vertex only).
- Media resolution control.
- Context caching, URL context, code execution tools.
- Additional action-node operations beyond "Message a Model".
