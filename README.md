# n8n-nodes-gemini3-vertex

n8n community nodes that expose Gemini 3 features for Google Vertex AI.

## Nodes

- **Google Vertex Chat Model (Gemini 3)** — a Chat Model sub-node for Agents
  and Chains. Adds the native Gemini 3 thinking level
  (`MINIMAL`/`LOW`/`MEDIUM`/`HIGH`), a thinking budget, and a streaming toggle.
- **Google Vertex Gemini 3** — an action node with a *Message a Model*
  operation. Adds the native thinking level, thought summaries, Google Search
  grounding, and structured JSON output.

## Installation

In n8n: **Settings → Community Nodes → Install** and enter
`n8n-nodes-gemini3-vertex`.

## Credentials

Both nodes use the built-in **Google API** credential — a GCP service account
with the Vertex AI API enabled (email, private key, region).

## Feature placement

- The sub-node forwards the native thinking level and thinking budget through
  `@langchain/google-vertexai` (pinned to `2.1.24`, matching the version n8n
  itself ships, to avoid duplicate-`@langchain/core` runtime conflicts).
- **Thought summaries** as an independent toggle live on the **action node**.
  The sub-node's LangChain layer couples thought inclusion to the thinking
  budget rather than exposing a separate switch.

## Caveat: grounding & JSON output

Google Search grounding and forced JSON output conflict with how n8n Agents
bind their own tools, so they live on the action node rather than the
sub-node. The two features also cannot be combined with each other (a Gemini
API restriction); the action node validates this and errors clearly.

## Development

```bash
npm install --ignore-scripts   # eslint-plugin-n8n-nodes-base has a pnpm-only preinstall guard
npm run build
npm test                       # unit tests — mocked, no network
```

Requires Node.js 20+.

## Live integration tests

`npm run test:integration` exercises both nodes against the real Vertex AI
API and verifies the parameters the nodes send actually take effect in
Google's response. It needs a GCP service-account key:

```bash
export GCP_KEY_FILE=/absolute/path/to/service-account.json
# optional overrides:
export GCP_PROJECT_ID=my-project     # defaults to project_id in the key file
export GCP_LOCATION=us-central1      # default
export GEMINI_MODEL=gemini-3-pro-preview  # default
npm run test:integration
```

Without `GCP_KEY_FILE` the suites skip themselves, so a normal `npm test`
never makes network calls. These tests make billable API calls.

What is verified against the live response:

| Parameter | Verified via |
| --- | --- |
| `thinkingLevel` (MINIMAL→HIGH) | `usageMetadata.thoughtsTokenCount` scales up (action node); `usage_metadata.output_token_details.reasoning` (sub-node) |
| `includeThoughts` | a response part with `thought: true` |
| Google Search grounding | `candidates[].groundingMetadata` present |
| `responseSchema` | output parses as schema-shaped JSON |
| `maxOutputTokens` | `finishReason === 'MAX_TOKENS'` |
| `systemInstruction` | model obeys the instruction |
| streaming | `generateContentStream` / `.stream()` yields chunks |
| `temperature` / `topP` / `topK` | accepted without error (Google does not echo these back) |
