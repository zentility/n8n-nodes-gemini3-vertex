# n8n-nodes-gemini3-vertex

n8n community nodes that expose Gemini 3 features for Google Vertex AI.

## Nodes

- **Google Vertex Chat Model (Gemini 3)** — a Chat Model sub-node for Agents
  and Chains. Adds reasoning effort, a thinking budget, and a streaming toggle.
- **Google Vertex Gemini 3** — an action node with a *Message a Model*
  operation. Adds the native Gemini 3 thinking level, thought summaries,
  Google Search grounding, and structured JSON output.

## Installation

In n8n: **Settings → Community Nodes → Install** and enter
`n8n-nodes-gemini3-vertex`.

## Credentials

Both nodes use the built-in **Google API** credential — a GCP service account
with the Vertex AI API enabled (email, private key, region).

## Feature placement

Some Gemini 3 features are not reachable through the LangChain layer the
Chat Model sub-node is built on (`@langchain/google-vertexai`):

- **Native thinking level** (`MINIMAL` / `LOW` / `MEDIUM` / `HIGH`) and
  **thought summaries** — available on the **action node** only. The sub-node
  offers `reasoningEffort` (low/medium/high) and a numeric thinking budget,
  which is what LangChain forwards to the API.

## Caveat: grounding & JSON output

Google Search grounding and forced JSON output conflict with how n8n Agents
bind their own tools, so they live on the action node rather than the
sub-node. The two features also cannot be combined with each other (a Gemini
API restriction); the action node validates this and errors clearly.

## Development

```bash
npm install --ignore-scripts   # eslint-plugin-n8n-nodes-base has a pnpm-only preinstall guard
npm run build
npm test
```

Requires Node.js 20+.
