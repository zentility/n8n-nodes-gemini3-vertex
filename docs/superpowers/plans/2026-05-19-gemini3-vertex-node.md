# Gemini 3 Vertex AI n8n Node Package — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an n8n community node package exposing Gemini 3 features for Vertex AI — a Chat Model sub-node and a "Message a Model" action node.

**Architecture:** A standard n8n community node package. Pure logic (auth mapping, error mapping, request config, output shaping, conflict guard) lives in unit-tested modules under `nodes/shared/` and `nodes/GoogleVertexGemini3/`. The node `.node.ts` files are thin declarative wiring around those modules. Sub-node returns a `ChatVertexAI` LangChain model; action node calls `@google/genai` in Vertex mode.

**Tech Stack:** TypeScript, n8n-workflow, `@langchain/google-vertexai`, `@google/genai`, `@google-cloud/resource-manager`, Jest, gulp, ESLint (`eslint-plugin-n8n-nodes-base`).

---

## File Structure

- `package.json` — package manifest, `n8n` field listing both nodes
- `tsconfig.json` — TypeScript config
- `gulpfile.js` — copies SVG icons into `dist`
- `.eslintrc.js` — n8n lint rules
- `jest.config.js` — Jest config
- `.gitignore`
- `index.js` — empty CommonJS entry
- `nodes/shared/auth.ts` — service-account credential → auth options + project/region
- `nodes/shared/errors.ts` — HTTP status → friendly error
- `nodes/shared/gcpProjects.ts` — `gcpProjectsList` listSearch method
- `nodes/shared/modelFields.ts` — reusable INodeProperties (model name, thinking level, etc.)
- `nodes/GoogleVertexGemini3/operations.ts` — pure logic: build request config, conflict guard, shape output
- `nodes/GoogleVertexGemini3/GoogleVertexGemini3.node.ts` — action node
- `nodes/GoogleVertexGemini3/google.svg` — icon
- `nodes/GoogleVertexChatModelG3/GoogleVertexChatModelG3.node.ts` — sub-node
- `nodes/GoogleVertexChatModelG3/google.svg` — icon
- `nodes/shared/__tests__/*.test.ts` — unit tests
- `nodes/GoogleVertexGemini3/__tests__/operations.test.ts` — unit tests
- `README.md`

---

## Task 1: Scaffold the package

**Files:**
- Create: `package.json`, `tsconfig.json`, `gulpfile.js`, `.eslintrc.js`, `jest.config.js`, `.gitignore`, `index.js`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "n8n-nodes-gemini3-vertex",
  "version": "0.1.0",
  "description": "n8n community nodes exposing Gemini 3 features for Google Vertex AI",
  "keywords": ["n8n-community-node-package", "n8n", "gemini", "vertex-ai"],
  "license": "MIT",
  "main": "index.js",
  "scripts": {
    "build": "tsc && gulp build:icons",
    "dev": "tsc --watch",
    "lint": "eslint nodes package.json",
    "test": "jest"
  },
  "files": ["dist"],
  "n8n": {
    "n8nNodesApiVersion": 1,
    "nodes": [
      "dist/nodes/GoogleVertexChatModelG3/GoogleVertexChatModelG3.node.js",
      "dist/nodes/GoogleVertexGemini3/GoogleVertexGemini3.node.js"
    ]
  },
  "dependencies": {
    "@google-cloud/resource-manager": "^5.3.0",
    "@google/genai": "^1.0.0",
    "@langchain/core": "^0.3.0",
    "@langchain/google-vertexai": "^0.2.0"
  },
  "devDependencies": {
    "@types/jest": "^29.5.12",
    "@types/node": "^20.11.0",
    "@typescript-eslint/parser": "^7.0.0",
    "eslint": "^8.57.0",
    "eslint-plugin-n8n-nodes-base": "^1.16.0",
    "gulp": "^5.0.0",
    "jest": "^29.7.0",
    "ts-jest": "^29.1.2",
    "typescript": "^5.4.0",
    "n8n-workflow": "*"
  },
  "peerDependencies": {
    "n8n-workflow": "*"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "strict": true,
    "module": "commonjs",
    "moduleResolution": "node",
    "target": "es2021",
    "lib": ["es2021"],
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true,
    "outDir": "dist",
    "rootDir": ".",
    "sourceMap": true
  },
  "include": ["nodes/**/*.ts", "index.js"],
  "exclude": ["node_modules", "dist", "**/__tests__/**"]
}
```

- [ ] **Step 3: Create `gulpfile.js`**

```js
const { src, dest } = require('gulp');

function buildIcons() {
  return src('nodes/**/*.{svg,png}').pipe(dest('dist/nodes'));
}

exports['build:icons'] = buildIcons;
```

- [ ] **Step 4: Create `jest.config.js`**

```js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.ts'],
};
```

- [ ] **Step 5: Create `.eslintrc.js`**

```js
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: { ecmaVersion: 2021, sourceType: 'module' },
  plugins: ['eslint-plugin-n8n-nodes-base'],
  extends: ['plugin:n8n-nodes-base/nodes'],
  ignorePatterns: ['dist/**', 'node_modules/**', '**/__tests__/**'],
};
```

- [ ] **Step 6: Create `.gitignore`**

```
node_modules/
dist/
*.log
```

- [ ] **Step 7: Create `index.js`**

```js
module.exports = {};
```

- [ ] **Step 8: Install dependencies and verify**

Run: `npm install`
Expected: completes without error; `node_modules` populated.

- [ ] **Step 9: Commit**

```bash
git add package.json tsconfig.json gulpfile.js jest.config.js .eslintrc.js .gitignore index.js
git commit -m "chore: scaffold n8n-nodes-gemini3-vertex package"
```

---

## Task 2: Shared auth helper

Converts an n8n `googleApi` credential object into the pieces both nodes need.

**Files:**
- Create: `nodes/shared/auth.ts`
- Test: `nodes/shared/__tests__/auth.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { buildAuth } from '../auth';

describe('buildAuth', () => {
  const creds = {
    email: '  svc@project.iam.gserviceaccount.com  ',
    privateKey: '-----BEGIN PRIVATE KEY-----\\nABC\\n-----END PRIVATE KEY-----',
    region: 'us-central1',
  };

  it('trims the email', () => {
    expect(buildAuth(creds).email).toBe('svc@project.iam.gserviceaccount.com');
  });

  it('converts escaped newlines in the private key to real newlines', () => {
    expect(buildAuth(creds).privateKey).toContain('\n');
    expect(buildAuth(creds).privateKey).not.toContain('\\n');
  });

  it('passes region through', () => {
    expect(buildAuth(creds).region).toBe('us-central1');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest auth.test.ts`
Expected: FAIL — cannot find module `../auth`.

- [ ] **Step 3: Write `nodes/shared/auth.ts`**

```ts
export interface GoogleApiCredential {
  email: string;
  privateKey: string;
  region: string;
}

export interface VertexAuth {
  email: string;
  privateKey: string;
  region: string;
}

export function buildAuth(credentials: GoogleApiCredential): VertexAuth {
  return {
    email: credentials.email.trim(),
    privateKey: credentials.privateKey.replace(/\\n/g, '\n'),
    region: credentials.region,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest auth.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add nodes/shared/auth.ts nodes/shared/__tests__/auth.test.ts
git commit -m "feat: add shared Vertex auth helper"
```

---

## Task 3: Shared error mapping

Maps Vertex HTTP status codes to clear messages.

**Files:**
- Create: `nodes/shared/errors.ts`
- Test: `nodes/shared/__tests__/errors.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describeVertexError } from '../errors';

describe('describeVertexError', () => {
  it('maps 401 to an auth message', () => {
    expect(describeVertexError(401)?.message).toMatch(/authentication/i);
  });
  it('maps 403 to a permission message', () => {
    expect(describeVertexError(403)?.message).toMatch(/permission/i);
  });
  it('maps 404 to a model-not-found message', () => {
    expect(describeVertexError(404)?.message).toMatch(/not found/i);
  });
  it('maps 429 to a quota message', () => {
    expect(describeVertexError(429)?.message).toMatch(/quota/i);
  });
  it('returns null for unmapped statuses', () => {
    expect(describeVertexError(200)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest errors.test.ts`
Expected: FAIL — cannot find module `../errors`.

- [ ] **Step 3: Write `nodes/shared/errors.ts`**

```ts
export interface VertexErrorInfo {
  message: string;
  description: string;
}

export function describeVertexError(status: number): VertexErrorInfo | null {
  switch (status) {
    case 401:
      return {
        message: 'Authentication failed',
        description:
          'Check the service account email and private key in the credential.',
      };
    case 403:
      return {
        message: 'Permission denied',
        description:
          'The service account lacks permission, or the Vertex AI API is not enabled for this project.',
      };
    case 404:
      return {
        message: 'Model not found',
        description:
          'The model name may be wrong or unavailable in the selected region.',
      };
    case 429:
      return {
        message: 'Quota exceeded',
        description: 'Vertex AI rate limit or quota was hit. Retry later or request more quota.',
      };
    case 400:
      return {
        message: 'Invalid request',
        description: 'Vertex AI rejected the request parameters.',
      };
    default:
      return null;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest errors.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add nodes/shared/errors.ts nodes/shared/__tests__/errors.test.ts
git commit -m "feat: add shared Vertex error mapping"
```

---

## Task 4: Shared GCP project list-search method

Provides the `gcpProjectsList` search used by the `projectId` resourceLocator.

**Files:**
- Create: `nodes/shared/gcpProjects.ts`

- [ ] **Step 1: Write `nodes/shared/gcpProjects.ts`**

```ts
import { ProjectsClient } from '@google-cloud/resource-manager';
import type { ILoadOptionsFunctions } from 'n8n-workflow';

import { buildAuth, type GoogleApiCredential } from './auth';

export async function gcpProjectsList(this: ILoadOptionsFunctions) {
  const credentials = (await this.getCredentials('googleApi')) as unknown as GoogleApiCredential;
  const { email, privateKey } = buildAuth(credentials);

  const client = new ProjectsClient({
    credentials: { client_email: email, private_key: privateKey },
  });

  const [projects] = await client.searchProjects();
  const results: Array<{ name: string; value: string }> = [];
  for (const project of projects) {
    if (project.projectId) {
      results.push({
        name: project.displayName ?? project.projectId,
        value: project.projectId,
      });
    }
  }
  return { results };
}
```

- [ ] **Step 2: Verify it type-checks**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add nodes/shared/gcpProjects.ts
git commit -m "feat: add shared GCP project list-search method"
```

---

## Task 5: Shared field definitions

Reusable `INodeProperties` for model name, project ID, and Gemini 3 options.

**Files:**
- Create: `nodes/shared/modelFields.ts`

- [ ] **Step 1: Write `nodes/shared/modelFields.ts`**

```ts
import type { INodeProperties } from 'n8n-workflow';

export const DEFAULT_MODEL = 'gemini-3-pro-preview';

// thinking_level enum values are pinned during implementation against the
// current Google Vertex AI docs. Start with low/high; add minimal/medium only
// if the live API documents them for Gemini 3.
export const thinkingLevelOptions = [
  { name: 'Low', value: 'low' },
  { name: 'High', value: 'high' },
];

export const projectIdField: INodeProperties = {
  displayName: 'Project ID',
  name: 'projectId',
  type: 'resourceLocator',
  default: { mode: 'list', value: '' },
  required: true,
  description: 'Select or enter your Google Cloud project ID',
  modes: [
    {
      displayName: 'From List',
      name: 'list',
      type: 'list',
      typeOptions: { searchListMethod: 'gcpProjectsList' },
    },
    { displayName: 'ID', name: 'id', type: 'string' },
  ],
};

export const modelNameField: INodeProperties = {
  displayName: 'Model Name',
  name: 'modelName',
  type: 'string',
  default: DEFAULT_MODEL,
  description: 'The Gemini model to use, e.g. gemini-3-pro-preview',
};

export const thinkingLevelField: INodeProperties = {
  displayName: 'Thinking Level',
  name: 'thinkingLevel',
  type: 'options',
  default: '',
  description: 'Controls how much the model reasons before answering. Takes precedence over Thinking Budget.',
  options: [{ name: 'Default (Unset)', value: '' }, ...thinkingLevelOptions],
};

export const includeThoughtsField: INodeProperties = {
  displayName: 'Include Thought Summaries',
  name: 'includeThoughts',
  type: 'boolean',
  default: false,
  description: 'Whether to request a summary of the model reasoning',
};
```

- [ ] **Step 2: Verify it type-checks**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add nodes/shared/modelFields.ts
git commit -m "feat: add shared node field definitions"
```

---

## Task 6: Action node operations logic

Pure, testable functions: build the `@google/genai` request config, the grounding+schema conflict guard, and output shaping.

**Files:**
- Create: `nodes/GoogleVertexGemini3/operations.ts`
- Test: `nodes/GoogleVertexGemini3/__tests__/operations.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { assertNoFeatureConflict, buildGenerateConfig, shapeOutput } from '../operations';

describe('assertNoFeatureConflict', () => {
  it('throws when grounding and JSON schema are both enabled', () => {
    expect(() => assertNoFeatureConflict(true, true)).toThrow(/grounding/i);
  });
  it('does not throw when only one is enabled', () => {
    expect(() => assertNoFeatureConflict(true, false)).not.toThrow();
    expect(() => assertNoFeatureConflict(false, true)).not.toThrow();
  });
});

describe('buildGenerateConfig', () => {
  it('maps sampling options', () => {
    const cfg = buildGenerateConfig({ temperature: 0.5, topP: 0.9, topK: 20, maxOutputTokens: 100 });
    expect(cfg.temperature).toBe(0.5);
    expect(cfg.maxOutputTokens).toBe(100);
  });
  it('adds thinkingConfig when thinkingLevel is set', () => {
    const cfg = buildGenerateConfig({ thinkingLevel: 'high', includeThoughts: true });
    expect(cfg.thinkingConfig).toEqual({ thinkingLevel: 'high', includeThoughts: true });
  });
  it('omits thinkingConfig when nothing thinking-related is set', () => {
    const cfg = buildGenerateConfig({ temperature: 0.5 });
    expect(cfg.thinkingConfig).toBeUndefined();
  });
  it('adds the googleSearch tool when grounding is enabled', () => {
    const cfg = buildGenerateConfig({ enableGrounding: true });
    expect(cfg.tools).toEqual([{ googleSearch: {} }]);
  });
  it('sets JSON response config when a schema is provided', () => {
    const cfg = buildGenerateConfig({ responseSchema: { type: 'object' } });
    expect(cfg.responseMimeType).toBe('application/json');
    expect(cfg.responseSchema).toEqual({ type: 'object' });
  });
});

describe('shapeOutput', () => {
  const baseResponse = {
    text: 'hello',
    candidates: [{ content: { parts: [{ text: 'hello' }] } }],
    usageMetadata: { totalTokenCount: 12 },
  };

  it('returns text and usage metadata', () => {
    const out = shapeOutput(baseResponse as any, { responseFormat: 'text' });
    expect(out.text).toBe('hello');
    expect(out.usageMetadata).toEqual({ totalTokenCount: 12 });
  });
  it('parses JSON when responseFormat is json', () => {
    const resp = { ...baseResponse, text: '{"a":1}' };
    const out = shapeOutput(resp as any, { responseFormat: 'json' });
    expect(out.parsedJson).toEqual({ a: 1 });
  });
  it('omits parsedJson in text mode', () => {
    const out = shapeOutput(baseResponse as any, { responseFormat: 'text' });
    expect(out.parsedJson).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest operations.test.ts`
Expected: FAIL — cannot find module `../operations`.

- [ ] **Step 3: Write `nodes/GoogleVertexGemini3/operations.ts`**

```ts
export interface GenerateOptions {
  temperature?: number;
  topP?: number;
  topK?: number;
  maxOutputTokens?: number;
  thinkingLevel?: string;
  includeThoughts?: boolean;
  enableGrounding?: boolean;
  responseSchema?: unknown;
  safetySettings?: unknown[];
}

export interface GenerateConfig {
  temperature?: number;
  topP?: number;
  topK?: number;
  maxOutputTokens?: number;
  thinkingConfig?: { thinkingLevel?: string; includeThoughts?: boolean };
  tools?: Array<{ googleSearch: Record<string, never> }>;
  responseMimeType?: string;
  responseSchema?: unknown;
  safetySettings?: unknown[];
}

export function assertNoFeatureConflict(
  enableGrounding: boolean,
  hasResponseSchema: boolean,
): void {
  if (enableGrounding && hasResponseSchema) {
    throw new Error(
      'Google Search grounding cannot be combined with a forced JSON response schema. Disable one of them.',
    );
  }
}

export function buildGenerateConfig(options: GenerateOptions): GenerateConfig {
  const config: GenerateConfig = {};

  if (options.temperature !== undefined) config.temperature = options.temperature;
  if (options.topP !== undefined) config.topP = options.topP;
  if (options.topK !== undefined) config.topK = options.topK;
  if (options.maxOutputTokens !== undefined) config.maxOutputTokens = options.maxOutputTokens;
  if (options.safetySettings && options.safetySettings.length > 0) {
    config.safetySettings = options.safetySettings;
  }

  if (options.thinkingLevel || options.includeThoughts) {
    config.thinkingConfig = {};
    if (options.thinkingLevel) config.thinkingConfig.thinkingLevel = options.thinkingLevel;
    if (options.includeThoughts) config.thinkingConfig.includeThoughts = true;
  }

  if (options.enableGrounding) {
    config.tools = [{ googleSearch: {} }];
  }

  if (options.responseSchema !== undefined) {
    config.responseMimeType = 'application/json';
    config.responseSchema = options.responseSchema;
  }

  return config;
}

interface GenAiResponse {
  text?: string;
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string; thought?: boolean }> };
    groundingMetadata?: unknown;
  }>;
  usageMetadata?: unknown;
}

export interface ShapedOutput {
  text: string;
  thoughtSummary?: string;
  parsedJson?: unknown;
  groundingMetadata?: unknown;
  usageMetadata?: unknown;
  raw: unknown;
}

export function shapeOutput(
  response: GenAiResponse,
  opts: { responseFormat: 'text' | 'json' },
): ShapedOutput {
  const text = response.text ?? '';
  const candidate = response.candidates?.[0];

  const out: ShapedOutput = {
    text,
    usageMetadata: response.usageMetadata,
    raw: candidate ?? response,
  };

  const thoughtPart = candidate?.content?.parts?.find((p) => p.thought && p.text);
  if (thoughtPart?.text) out.thoughtSummary = thoughtPart.text;

  if (candidate?.groundingMetadata) out.groundingMetadata = candidate.groundingMetadata;

  if (opts.responseFormat === 'json' && text) {
    out.parsedJson = JSON.parse(text);
  }

  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest operations.test.ts`
Expected: PASS (all describe blocks green).

- [ ] **Step 5: Commit**

```bash
git add nodes/GoogleVertexGemini3/operations.ts nodes/GoogleVertexGemini3/__tests__/operations.test.ts
git commit -m "feat: add Gemini 3 action node operations logic"
```

---

## Task 7: Action node

The `GoogleVertexGemini3` node — declarative wiring plus `execute`.

**Files:**
- Create: `nodes/GoogleVertexGemini3/GoogleVertexGemini3.node.ts`
- Create: `nodes/GoogleVertexGemini3/google.svg` (copy from Task 9)

- [ ] **Step 1: Write `nodes/GoogleVertexGemini3/GoogleVertexGemini3.node.ts`**

```ts
import { GoogleGenAI } from '@google/genai';
import {
  NodeConnectionTypes,
  NodeOperationError,
  type IExecuteFunctions,
  type INodeExecutionData,
  type INodeType,
  type INodeTypeDescription,
} from 'n8n-workflow';

import { buildAuth, type GoogleApiCredential } from '../shared/auth';
import { describeVertexError } from '../shared/errors';
import { gcpProjectsList } from '../shared/gcpProjects';
import {
  includeThoughtsField,
  modelNameField,
  projectIdField,
  thinkingLevelField,
} from '../shared/modelFields';
import {
  assertNoFeatureConflict,
  buildGenerateConfig,
  shapeOutput,
} from './operations';

export class GoogleVertexGemini3 implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Google Vertex Gemini 3',
    name: 'googleVertexGemini3',
    icon: 'file:google.svg',
    group: ['transform'],
    version: 1,
    description: 'Send messages to Gemini 3 on Google Vertex AI',
    defaults: { name: 'Google Vertex Gemini 3' },
    inputs: [NodeConnectionTypes.Main],
    outputs: [NodeConnectionTypes.Main],
    credentials: [{ name: 'googleApi', required: true }],
    properties: [
      projectIdField,
      modelNameField,
      {
        displayName: 'Messages',
        name: 'messages',
        type: 'fixedCollection',
        typeOptions: { multipleValues: true },
        default: {},
        options: [
          {
            name: 'values',
            displayName: 'Message',
            values: [
              {
                displayName: 'Role',
                name: 'role',
                type: 'options',
                default: 'user',
                options: [
                  { name: 'User', value: 'user' },
                  { name: 'Model', value: 'model' },
                ],
              },
              { displayName: 'Text', name: 'text', type: 'string', default: '' },
            ],
          },
        ],
      },
      {
        displayName: 'System Instruction',
        name: 'systemInstruction',
        type: 'string',
        typeOptions: { rows: 2 },
        default: '',
      },
      {
        displayName: 'Stream Response',
        name: 'stream',
        type: 'boolean',
        default: false,
        description:
          'Whether to use the streaming endpoint. n8n still passes the complete aggregated result downstream.',
      },
      {
        displayName: 'Response Format',
        name: 'responseFormat',
        type: 'options',
        default: 'text',
        options: [
          { name: 'Text', value: 'text' },
          { name: 'JSON', value: 'json' },
        ],
      },
      {
        displayName: 'Response Schema',
        name: 'responseSchema',
        type: 'json',
        default: '{}',
        displayOptions: { show: { responseFormat: ['json'] } },
        description: 'JSON Schema the model output must conform to',
      },
      {
        displayName: 'Options',
        name: 'options',
        type: 'collection',
        placeholder: 'Add Option',
        default: {},
        options: [
          { displayName: 'Maximum Number of Tokens', name: 'maxOutputTokens', type: 'number', default: 2048 },
          { displayName: 'Sampling Temperature', name: 'temperature', type: 'number', default: 1 },
          { displayName: 'Top P', name: 'topP', type: 'number', default: 0.95 },
          { displayName: 'Top K', name: 'topK', type: 'number', default: 40 },
          thinkingLevelField,
          includeThoughtsField,
          {
            displayName: 'Enable Google Search Grounding',
            name: 'enableGrounding',
            type: 'boolean',
            default: false,
            description: 'Whether to let the model ground answers in live Google Search results',
          },
        ],
      },
    ],
  };

  methods = {
    listSearch: { gcpProjectsList },
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const returnData: INodeExecutionData[] = [];

    const credentials = (await this.getCredentials('googleApi')) as unknown as GoogleApiCredential;
    const { email, privateKey, region } = buildAuth(credentials);

    for (let i = 0; i < items.length; i++) {
      try {
        const projectId = this.getNodeParameter('projectId', i, '', {
          extractValue: true,
        }) as string;
        const modelName = this.getNodeParameter('modelName', i) as string;
        const systemInstruction = this.getNodeParameter('systemInstruction', i, '') as string;
        const stream = this.getNodeParameter('stream', i, false) as boolean;
        const responseFormat = this.getNodeParameter('responseFormat', i, 'text') as
          | 'text'
          | 'json';
        const options = this.getNodeParameter('options', i, {}) as Record<string, unknown>;

        const messageValues = this.getNodeParameter('messages.values', i, []) as Array<{
          role: 'user' | 'model';
          text: string;
        }>;

        let responseSchema: unknown;
        if (responseFormat === 'json') {
          const raw = this.getNodeParameter('responseSchema', i, '{}') as string;
          responseSchema = typeof raw === 'string' ? JSON.parse(raw) : raw;
        }

        assertNoFeatureConflict(
          Boolean(options.enableGrounding),
          responseSchema !== undefined,
        );

        const config = buildGenerateConfig({
          temperature: options.temperature as number | undefined,
          topP: options.topP as number | undefined,
          topK: options.topK as number | undefined,
          maxOutputTokens: options.maxOutputTokens as number | undefined,
          thinkingLevel: options.thinkingLevel as string | undefined,
          includeThoughts: options.includeThoughts as boolean | undefined,
          enableGrounding: options.enableGrounding as boolean | undefined,
          responseSchema,
        });

        const ai = new GoogleGenAI({
          vertexai: true,
          project: projectId,
          location: region,
          googleAuthOptions: {
            credentials: { client_email: email, private_key: privateKey },
          },
        });

        const contents = messageValues.map((m) => ({
          role: m.role,
          parts: [{ text: m.text }],
        }));

        const request = {
          model: modelName,
          contents,
          config: {
            ...config,
            ...(systemInstruction ? { systemInstruction } : {}),
          },
        };

        let response;
        if (stream) {
          const streamIterator = await ai.models.generateContentStream(request);
          let last;
          for await (const chunk of streamIterator) last = chunk;
          response = last;
        } else {
          response = await ai.models.generateContent(request);
        }

        const shaped = shapeOutput(response as never, { responseFormat });
        returnData.push({ json: shaped as never, pairedItem: { item: i } });
      } catch (error) {
        const status = Number(
          (error as { status?: number; response?: { status?: number } })?.status ??
            (error as { response?: { status?: number } })?.response?.status,
        );
        const friendly = describeVertexError(status);
        if (this.continueOnFail()) {
          returnData.push({
            json: { error: friendly?.message ?? (error as Error).message },
            pairedItem: { item: i },
          });
          continue;
        }
        if (friendly) {
          throw new NodeOperationError(this.getNode(), error as Error, {
            message: friendly.message,
            description: friendly.description,
          });
        }
        throw new NodeOperationError(this.getNode(), error as Error);
      }
    }

    return [returnData];
  }
}
```

- [ ] **Step 2: Verify it type-checks**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors. If `@google/genai` request/response types differ from the shapes above, adjust the field access in `operations.ts`/the node to match the installed SDK version, keeping the unit tests green.

- [ ] **Step 3: Commit**

```bash
git add nodes/GoogleVertexGemini3/GoogleVertexGemini3.node.ts
git commit -m "feat: add Google Vertex Gemini 3 action node"
```

---

## Task 8: Chat Model sub-node

Drop-in replacement for `LmChatGoogleVertex` with Gemini 3 options.

**Files:**
- Create: `nodes/GoogleVertexChatModelG3/GoogleVertexChatModelG3.node.ts`
- Create: `nodes/GoogleVertexChatModelG3/google.svg` (copy from Task 9)

- [ ] **Step 1: Write `nodes/GoogleVertexChatModelG3/GoogleVertexChatModelG3.node.ts`**

```ts
import { ChatVertexAI } from '@langchain/google-vertexai';
import {
  NodeConnectionTypes,
  NodeOperationError,
  type INodeType,
  type INodeTypeDescription,
  type ISupplyDataFunctions,
  type SupplyData,
} from 'n8n-workflow';

import { buildAuth, type GoogleApiCredential } from '../shared/auth';
import { gcpProjectsList } from '../shared/gcpProjects';
import {
  includeThoughtsField,
  modelNameField,
  projectIdField,
  thinkingLevelField,
} from '../shared/modelFields';

export class GoogleVertexChatModelG3 implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Google Vertex Chat Model (Gemini 3)',
    name: 'googleVertexChatModelG3',
    icon: 'file:google.svg',
    group: ['transform'],
    version: 1,
    description: 'Gemini 3 chat model on Google Vertex AI',
    defaults: { name: 'Google Vertex Chat Model (Gemini 3)' },
    codex: {
      categories: ['AI'],
      subcategories: {
        AI: ['Language Models', 'Root Nodes'],
        'Language Models': ['Chat Models (Recommended)'],
      },
    },
    inputs: [],
    outputs: [NodeConnectionTypes.AiLanguageModel],
    outputNames: ['Model'],
    credentials: [{ name: 'googleApi', required: true }],
    properties: [
      projectIdField,
      modelNameField,
      {
        displayName: 'Options',
        name: 'options',
        type: 'collection',
        placeholder: 'Add Option',
        default: {},
        options: [
          { displayName: 'Maximum Number of Tokens', name: 'maxOutputTokens', type: 'number', default: 2048 },
          { displayName: 'Sampling Temperature', name: 'temperature', type: 'number', default: 1 },
          { displayName: 'Top P', name: 'topP', type: 'number', default: 0.95 },
          { displayName: 'Top K', name: 'topK', type: 'number', default: 40 },
          {
            displayName: 'Thinking Budget',
            name: 'thinkingBudget',
            type: 'number',
            default: -1,
            description:
              'Legacy reasoning-token control. Set to -1 for dynamic. Ignored when Thinking Level is set.',
          },
          thinkingLevelField,
          includeThoughtsField,
          {
            displayName: 'Streaming',
            name: 'streaming',
            type: 'boolean',
            default: false,
            description: 'Whether to enable streaming on the underlying model',
          },
        ],
      },
    ],
  };

  methods = {
    listSearch: { gcpProjectsList },
  };

  async supplyData(this: ISupplyDataFunctions, itemIndex: number): Promise<SupplyData> {
    const credentials = (await this.getCredentials('googleApi')) as unknown as GoogleApiCredential;
    const { email, privateKey, region } = buildAuth(credentials);

    const modelName = this.getNodeParameter('modelName', itemIndex) as string;
    const projectId = this.getNodeParameter('projectId', itemIndex, '', {
      extractValue: true,
    }) as string;
    const options = this.getNodeParameter('options', itemIndex, {}) as Record<string, unknown>;

    try {
      const modelConfig: Record<string, unknown> = {
        authOptions: {
          projectId,
          credentials: { client_email: email, private_key: privateKey },
        },
        location: region,
        model: modelName,
        temperature: options.temperature,
        topP: options.topP,
        topK: options.topK,
        maxOutputTokens: options.maxOutputTokens,
        streaming: Boolean(options.streaming),
      };

      // Thinking Level takes precedence over the legacy Thinking Budget.
      if (options.thinkingLevel) {
        modelConfig.thinkingLevel = options.thinkingLevel;
      } else if (options.thinkingBudget !== undefined) {
        modelConfig.thinkingBudget = options.thinkingBudget;
      }
      if (options.includeThoughts) {
        modelConfig.includeThoughts = true;
      }

      const model = new ChatVertexAI(modelConfig as never);
      return { response: model };
    } catch (e) {
      throw new NodeOperationError(this.getNode(), e as Error, {
        message: 'Invalid options',
        description: (e as Error).message,
      });
    }
  }
}
```

- [ ] **Step 2: Verify it type-checks**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors. During implementation, confirm against the installed `@langchain/google-vertexai` version whether `thinkingLevel`/`includeThoughts` are forwarded to the API. If the installed version drops unknown keys, document in the README that thinking level on the sub-node requires a newer `@langchain/google-vertexai`, and that the action node is the reliable path.

- [ ] **Step 3: Commit**

```bash
git add nodes/GoogleVertexChatModelG3/GoogleVertexChatModelG3.node.ts
git commit -m "feat: add Gemini 3 Vertex chat model sub-node"
```

---

## Task 9: Icons, README, final build & lint

**Files:**
- Create: `nodes/GoogleVertexGemini3/google.svg`
- Create: `nodes/GoogleVertexChatModelG3/google.svg`
- Create: `README.md`

- [ ] **Step 1: Add the Google icon**

Download the Google "G" SVG and save it to both node folders:

```bash
curl -sL https://raw.githubusercontent.com/n8n-io/n8n/master/packages/@n8n/nodes-langchain/nodes/llms/LmChatGoogleVertex/google.svg \
  -o nodes/GoogleVertexGemini3/google.svg
cp nodes/GoogleVertexGemini3/google.svg nodes/GoogleVertexChatModelG3/google.svg
```

Expected: both files exist and contain `<svg`.

- [ ] **Step 2: Write `README.md`**

````markdown
# n8n-nodes-gemini3-vertex

n8n community nodes that expose Gemini 3 features for Google Vertex AI.

## Nodes

- **Google Vertex Chat Model (Gemini 3)** — a Chat Model sub-node for Agents
  and Chains. Adds thinking level, thought summaries, and a streaming toggle.
- **Google Vertex Gemini 3** — an action node with a *Message a Model*
  operation. Adds Google Search grounding and structured JSON output on top of
  the above.

## Installation

In n8n: **Settings → Community Nodes → Install** and enter
`n8n-nodes-gemini3-vertex`.

## Credentials

Both nodes use the built-in **Google API** credential — a GCP service account
with the Vertex AI API enabled (email, private key, region).

## Caveat: grounding & JSON output

Google Search grounding and forced JSON output conflict with how n8n Agents
bind their own tools. On the sub-node they are reliable only inside a Basic LLM
Chain. Use the action node when you need them with full control. The two
features also cannot be combined with each other (a Gemini API restriction);
the action node validates this and errors clearly.
````

- [ ] **Step 3: Run the full build**

Run: `npm run build`
Expected: `tsc` succeeds; `dist/` contains both `.node.js` files and `google.svg` icons.

- [ ] **Step 4: Run lint**

Run: `npm run lint`
Expected: no errors. Fix any `eslint-plugin-n8n-nodes-base` violations reported.

- [ ] **Step 5: Run all tests**

Run: `npm test`
Expected: all suites pass.

- [ ] **Step 6: Commit**

```bash
git add nodes/GoogleVertexGemini3/google.svg nodes/GoogleVertexChatModelG3/google.svg README.md
git commit -m "docs: add icons and README, finalize build"
```

---

## Task 10: Manual verification (outside CI)

- [ ] **Step 1:** Link the package into a local n8n install:
  `npm run build && npm link`, then in the n8n custom dir `npm link n8n-nodes-gemini3-vertex`, restart n8n.
- [ ] **Step 2:** Confirm both nodes appear in the node panel.
- [ ] **Step 3:** Configure a Google API credential; confirm the Project ID dropdown lists GCP projects.
- [ ] **Step 4:** Run the action node against a real Gemini 3 model — verify text output, then JSON output with a schema, then Search grounding (separately), and Continue-On-Fail with a bad model name.
- [ ] **Step 5:** Wire the sub-node into a Basic LLM Chain and confirm a completion returns.

This task has no automated check; record results in the commit message or PR description.
