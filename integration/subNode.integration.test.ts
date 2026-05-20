import { ChatVertexAI } from '@langchain/google-vertexai';

import { buildChatVertexConfig } from '../nodes/GoogleVertexChatModelG3/buildModel';
import { buildSafetySettings } from '../nodes/shared/safetySettings';
import { getIntegrationEnv } from './helpers';

const env = getIntegrationEnv();
const describeLive = env ? describe : describe.skip;

if (!env) {
	// eslint-disable-next-line no-console
	console.warn('[integration] GCP_KEY_FILE not set — sub-node live tests skipped.');
}

interface UsageWithReasoning {
	output_tokens?: number;
	output_token_details?: { reasoning?: number };
}

function makeModel(options: Parameters<typeof buildChatVertexConfig>[0]['options']) {
	return new ChatVertexAI(
		buildChatVertexConfig({
			email: env!.email,
			privateKey: env!.privateKey,
			projectId: env!.projectId,
			region: env!.location,
			modelName: env!.model,
			options,
		}),
	);
}

describeLive('sub-node — live Vertex AI (ChatVertexAI / LangChain)', () => {
	it('builds a working model and returns a completion', async () => {
		const model = makeModel({ maxOutputTokens: 128, temperature: 0.2, thinkingLevel: 'MINIMAL' });
		const result = await model.invoke('Reply with a short greeting.');
		expect(typeof result.content).toBe('string');
		expect((result.content as string).length).toBeGreaterThan(0);
	});

	it('sends thinkingLevel through LangChain — HIGH reasons at least as much as MINIMAL', async () => {
		const prompt =
			'A bat and ball cost $1.10 together. The bat costs $1.00 more than the ball. How much is the ball? Show your reasoning.';

		// maxOutputTokens big enough to leave room for output after thinking — LangChain's
		// ChatVertexAI crashes if the response has no message content (thinking only).
		const run = async (level: string) => {
			const result = await makeModel({ thinkingLevel: level, maxOutputTokens: 2048 }).invoke(
				prompt,
			);
			const usage = result.usage_metadata as UsageWithReasoning | undefined;
			return { reasoning: usage?.output_token_details?.reasoning ?? 0, usage };
		};

		const minimal = await run('MINIMAL');
		const high = await run('HIGH');
		// eslint-disable-next-line no-console
		console.log(`[integration] sub-node reasoning tokens  MINIMAL=${minimal.reasoning}  HIGH=${high.reasoning}`);
		expect(high.reasoning).toBeGreaterThan(0);
		expect(high.reasoning).toBeGreaterThanOrEqual(minimal.reasoning);
	});

	it('accepts per-category safety settings', async () => {
		const safetySettings = buildSafetySettings({
			harassment: 'BLOCK_ONLY_HIGH',
			hateSpeech: 'BLOCK_NONE',
		});
		expect(safetySettings).toHaveLength(2);
		const model = makeModel({ maxOutputTokens: 128, thinkingLevel: 'MINIMAL', safetySettings });
		const result = await model.invoke('Reply with a short greeting.');
		expect((result.content as string).length).toBeGreaterThan(0);
	});

	it('streams chunks when streaming is enabled', async () => {
		const model = makeModel({ streaming: true, maxOutputTokens: 128, thinkingLevel: 'MINIMAL' });
		const chunks: string[] = [];
		for await (const chunk of await model.stream('Count from one to five in words.')) {
			if (typeof chunk.content === 'string') chunks.push(chunk.content);
		}
		expect(chunks.length).toBeGreaterThan(0);
		expect(chunks.join('').length).toBeGreaterThan(0);
	});
});
