import { GoogleGenAI } from '@google/genai';

import {
	aggregateStreamChunks,
	buildGenerateConfig,
	shapeOutput,
} from '../nodes/GoogleVertexGemini3/operations';
import { buildSafetySettings } from '../nodes/shared/safetySettings';
import { getIntegrationEnv } from './helpers';

const env = getIntegrationEnv();
const describeLive = env ? describe : describe.skip;

if (!env) {
	// eslint-disable-next-line no-console
	console.warn('[integration] GCP_KEY_FILE not set — action-node live tests skipped.');
}

const userMsg = (text: string) => [{ role: 'user', parts: [{ text }] }];

describeLive('action node — live Vertex AI (@google/genai)', () => {
	let ai: GoogleGenAI;
	let model: string;

	// generateContent / generateContentStream are typed against the SDK's own
	// config interface; our buildGenerateConfig output is structurally compatible
	// but cast here to mirror exactly what the action node passes at runtime.
	const generate = (contents: unknown, config: unknown) =>
		ai.models.generateContent({ model, contents, config } as never);
	const generateStream = (contents: unknown, config: unknown) =>
		ai.models.generateContentStream({ model, contents, config } as never);

	beforeAll(() => {
		ai = new GoogleGenAI({
			vertexai: true,
			project: env!.projectId,
			location: env!.location,
			googleAuthOptions: {
				credentials: { client_email: env!.email, private_key: env!.privateKey },
			},
		});
		model = env!.model;
	});

	it('accepts the sampling params and returns text', async () => {
		const response = await generate(
			userMsg('Reply with a short greeting.'),
			buildGenerateConfig({ temperature: 0.2, topP: 0.8, topK: 20, maxOutputTokens: 128 }),
		);
		const out = shapeOutput(response as never, { responseFormat: 'text' });
		expect(out.text.length).toBeGreaterThan(0);
		expect(out.usageMetadata).toBeDefined();
	});

	it('sends thinkingLevel — HIGH spends at least as many thought tokens as MINIMAL', async () => {
		const prompt =
			'A bat and ball cost $1.10 together. The bat costs $1.00 more than the ball. How much is the ball? Show your reasoning.';

		const run = async (level: string) => {
			const response = await generate(
				userMsg(prompt),
				buildGenerateConfig({ thinkingLevel: level, maxOutputTokens: 512 }),
			);
			return (response.usageMetadata?.thoughtsTokenCount as number | undefined) ?? 0;
		};

		const minimal = await run('MINIMAL');
		const high = await run('HIGH');
		// eslint-disable-next-line no-console
		console.log(`[integration] thoughtsTokenCount  MINIMAL=${minimal}  HIGH=${high}`);
		expect(high).toBeGreaterThan(0);
		expect(high).toBeGreaterThanOrEqual(minimal);
	});

	it('sends includeThoughts — the response contains a thought part', async () => {
		const response = await generate(
			userMsg('What is 17 multiplied by 23? Think it through.'),
			buildGenerateConfig({ thinkingLevel: 'HIGH', includeThoughts: true, maxOutputTokens: 512 }),
		);
		const parts = response.candidates?.[0]?.content?.parts ?? [];
		expect(parts.some((p) => p.thought === true)).toBe(true);
	});

	it('honors a small maxOutputTokens — finishReason is MAX_TOKENS', async () => {
		const response = await generate(
			userMsg('Write a detailed multi-paragraph essay about the ocean.'),
			buildGenerateConfig({ maxOutputTokens: 5 }),
		);
		expect(response.candidates?.[0]?.finishReason).toBe('MAX_TOKENS');
	});

	it('sends Google Search grounding — the response carries groundingMetadata', async () => {
		const response = await generate(
			userMsg('Who won the most recent FIFA World Cup? Use search to be sure.'),
			buildGenerateConfig({ enableGrounding: true, maxOutputTokens: 256 }),
		);
		expect(response.candidates?.[0]?.groundingMetadata).toBeDefined();
	});

	it('sends a responseSchema — the output parses as schema-shaped JSON', async () => {
		const response = await generate(
			userMsg('What is the capital of France?'),
			buildGenerateConfig({
				maxOutputTokens: 128,
				responseSchema: {
					type: 'object',
					properties: { capital: { type: 'string' } },
					required: ['capital'],
				},
			}),
		);
		const out = shapeOutput(response as never, { responseFormat: 'json' });
		expect(typeof (out.parsedJson as { capital?: string })?.capital).toBe('string');
	});

	it('accepts per-category safety settings', async () => {
		// The API does not echo safety settings back, so this verifies they are
		// accepted (no 400) and a normal response is still produced.
		const safetySettings = buildSafetySettings({
			harassment: 'BLOCK_ONLY_HIGH',
			hateSpeech: 'BLOCK_NONE',
			dangerousContent: 'BLOCK_MEDIUM_AND_ABOVE',
		});
		expect(safetySettings).toHaveLength(3);
		const response = await generate(
			userMsg('Reply with a short, friendly greeting.'),
			buildGenerateConfig({ maxOutputTokens: 64, safetySettings }),
		);
		const out = shapeOutput(response as never, { responseFormat: 'text' });
		expect(out.text.length).toBeGreaterThan(0);
	});

	it('applies the systemInstruction', async () => {
		const response = await generate(userMsg('ping'), {
			...buildGenerateConfig({ maxOutputTokens: 32 }),
			systemInstruction: 'Reply with exactly one word in uppercase: PONG',
		});
		const out = shapeOutput(response as never, { responseFormat: 'text' });
		expect(out.text.toUpperCase()).toContain('PONG');
	});

	it('streams via generateContentStream and aggregates to non-empty text', async () => {
		const stream = await generateStream(
			userMsg('Count from one to five in words.'),
			buildGenerateConfig({ maxOutputTokens: 128 }),
		);
		const chunks = [];
		for await (const chunk of stream) {
			chunks.push({
				text: chunk.text,
				candidates: chunk.candidates,
				usageMetadata: chunk.usageMetadata,
			});
		}
		expect(chunks.length).toBeGreaterThan(0);
		const aggregated = aggregateStreamChunks(chunks as never).text ?? '';
		expect(aggregated.length).toBeGreaterThan(0);
	});
});
