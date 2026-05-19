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
npm test
```

Requires Node.js 20+.
