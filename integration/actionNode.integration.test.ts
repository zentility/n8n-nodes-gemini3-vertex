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
			buildGenerateConfig({
				temperature: 0.2,
				topP: 0.8,
				topK: 20,
				maxOutputTokens: 128,
				thinkingLevel: 'MINIMAL',
			}),
		);
		const out = shapeOutput(response as never, { responseFormat: 'text' });
		expect(out.text.length).toBeGreaterThan(0);
		expect(out.usageMetadata).toBeDefined();
	});

	it('scales thinking effort across all four thinking levels on a reasoning puzzle', async () => {
		// Classic river-crossing puzzle — needs actual reasoning to solve.
		const prompt =
			'A farmer needs to take a Fox, a Goose, and a Bag of Beans across a river in a small boat. ' +
			'The boat can only hold the farmer and one item at a time. If left alone, the Fox eats the Goose, ' +
			'and the Goose eats the Beans. How can the farmer get all three across safely?';

		const levels = ['MINIMAL', 'LOW', 'MEDIUM', 'HIGH'] as const;
		const results: Record<string, { thoughts: number; text: string }> = {};

		for (const level of levels) {
			const response = await generate(
				userMsg(prompt),
				buildGenerateConfig({ thinkingLevel: level, maxOutputTokens: 2048 }),
			);
			const thoughts = (response.usageMetadata?.thoughtsTokenCount as number | undefined) ?? 0;
			const text = shapeOutput(response as never, { responseFormat: 'text' }).text;
			results[level] = { thoughts, text };
			// eslint-disable-next-line no-console
			console.log(
				`[integration] action ${level.padEnd(7)} thoughts=${String(thoughts).padStart(4)}  textLen=${text.length}`,
			);
		}

		// Every level must come back with a real answer that engages with the puzzle.
		for (const level of levels) {
			expect(results[level].text.length).toBeGreaterThan(0);
			expect(results[level].text.toLowerCase()).toContain('goose');
		}
		// HIGH must spend strictly more thought tokens than MINIMAL — the headline proof
		// that thinkingLevel actually changes model behaviour.
		expect(results.HIGH.thoughts).toBeGreaterThan(results.MINIMAL.thoughts);
	});

	it('sends includeThoughts — Vertex accepts the flag and the model thinks', async () => {
		// Gemini 3.x no longer exposes thoughts as `thought:true` parts the way 1.5/2.x
		// did. What we can verify is that the flag is accepted by the API (no 400) and
		// that thinking actually happens — usageMetadata.thoughtsTokenCount > 0.
		const response = await generate(
			userMsg('What is 17 multiplied by 23? Think it through.'),
			buildGenerateConfig({ thinkingLevel: 'HIGH', includeThoughts: true, maxOutputTokens: 1024 }),
		);
		const thoughtTokens = (response.usageMetadata?.thoughtsTokenCount as number | undefined) ?? 0;
		// eslint-disable-next-line no-console
		console.log(`[integration] includeThoughts thoughtsTokenCount=${thoughtTokens}`);
		expect(thoughtTokens).toBeGreaterThan(0);
	});

	it('honors a small maxOutputTokens — finishReason is MAX_TOKENS', async () => {
		const response = await generate(
			userMsg('Write a detailed multi-paragraph essay about the ocean.'),
			buildGenerateConfig({ maxOutputTokens: 5 }),
		);
		expect(response.candidates?.[0]?.finishReason).toBe('MAX_TOKENS');
	});

	it('sends Google Search grounding — the response carries groundingMetadata', async () => {
		// Grounding needs room for the search-then-answer flow; with low maxOutputTokens
		// the response finishes as MAX_TOKENS before groundingMetadata is attached.
		const response = await generate(
			userMsg('Who won the most recent FIFA World Cup? Use search to be sure.'),
			buildGenerateConfig({ enableGrounding: true, thinkingLevel: 'MINIMAL', maxOutputTokens: 2048 }),
		);
		const candidate = response.candidates?.[0];
		// eslint-disable-next-line no-console
		console.log(`[integration] grounding finishReason=${candidate?.finishReason} hasGroundingMetadata=${candidate?.groundingMetadata !== undefined}`);
		expect(candidate?.groundingMetadata).toBeDefined();
	});

	it('sends a responseSchema — the output parses as schema-shaped JSON', async () => {
		const response = await generate(
			userMsg('What is the capital of France?'),
			buildGenerateConfig({
				maxOutputTokens: 256,
				thinkingLevel: 'MINIMAL',
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
			buildGenerateConfig({ maxOutputTokens: 128, thinkingLevel: 'MINIMAL', safetySettings }),
		);
		const out = shapeOutput(response as never, { responseFormat: 'text' });
		expect(out.text.length).toBeGreaterThan(0);
	});

	it('safety thresholds change observable behavior — strict blocks, lenient allows', async () => {
		// Prompt designed to engage the safety filter at strict thresholds while still
		// being a tame test fixture. Strict turns the filter on for every category;
		// lenient turns every category off — so any safety-related response divergence
		// is attributable to the threshold setting, not which category triggered.
		const prompt =
			'Write a short, graphic fictional fight scene between two people in a back alley. ' +
			'Be very explicit about the physical violence and the injuries inflicted.';

		const run = async (threshold: string) => {
			const safetySettings = buildSafetySettings({
				harassment: threshold,
				hateSpeech: threshold,
				sexuallyExplicit: threshold,
				dangerousContent: threshold,
				civicIntegrity: threshold,
			});
			const response = await generate(
				userMsg(prompt),
				buildGenerateConfig({
					thinkingLevel: 'MINIMAL',
					maxOutputTokens: 256,
					safetySettings,
				}),
			);
			const candidate = response.candidates?.[0];
			const promptFeedback = (
				response as unknown as { promptFeedback?: { blockReason?: string } }
			).promptFeedback;
			return {
				finishReason: candidate?.finishReason,
				promptBlockReason: promptFeedback?.blockReason,
				safetyBlocked:
					candidate?.finishReason === 'SAFETY' || promptFeedback?.blockReason !== undefined,
				textLen: shapeOutput(response as never, { responseFormat: 'text' }).text.length,
			};
		};

		const strict = await run('BLOCK_LOW_AND_ABOVE');
		const lenient = await run('BLOCK_NONE');
		// eslint-disable-next-line no-console
		console.log('[integration] safety STRICT :', JSON.stringify(strict));
		// eslint-disable-next-line no-console
		console.log('[integration] safety LENIENT:', JSON.stringify(lenient));

		// Strict must show a safety signal (either prompt-level blockReason or
		// finishReason SAFETY on the candidate).
		expect(strict.safetyBlocked).toBe(true);
		// Lenient must NOT show a safety-block signal — the threshold opt-out worked.
		expect(lenient.safetyBlocked).toBe(false);
	});

	it('applies the systemInstruction', async () => {
		const response = await generate(userMsg('ping'), {
			...buildGenerateConfig({ maxOutputTokens: 64, thinkingLevel: 'MINIMAL' }),
			systemInstruction: 'Reply with exactly one word in uppercase: PONG',
		});
		const out = shapeOutput(response as never, { responseFormat: 'text' });
		expect(out.text.toUpperCase()).toContain('PONG');
	});

	it('streams via generateContentStream and aggregates to non-empty text', async () => {
		const stream = await generateStream(
			userMsg('Count from one to five in words.'),
			buildGenerateConfig({ maxOutputTokens: 128, thinkingLevel: 'MINIMAL' }),
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
