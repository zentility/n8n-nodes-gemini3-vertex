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

	it('scales reasoning effort across all four thinking levels via LangChain', async () => {
		const prompt =
			'A farmer needs to take a Fox, a Goose, and a Bag of Beans across a river in a small boat. ' +
			'The boat can only hold the farmer and one item at a time. If left alone, the Fox eats the Goose, ' +
			'and the Goose eats the Beans. How can the farmer get all three across safely?';

		const levels = ['MINIMAL', 'LOW', 'MEDIUM', 'HIGH'] as const;
		const results: Record<string, { reasoning: number; content: string }> = {};

		// maxOutputTokens generous so thinking + answer both fit — LangChain's
		// ChatVertexAI crashes when the response has no message content.
		for (const level of levels) {
			const result = await makeModel({ thinkingLevel: level, maxOutputTokens: 2048 }).invoke(
				prompt,
			);
			const usage = result.usage_metadata as UsageWithReasoning | undefined;
			const reasoning = usage?.output_token_details?.reasoning ?? 0;
			const content = typeof result.content === 'string' ? result.content : '';
			results[level] = { reasoning, content };
			// eslint-disable-next-line no-console
			console.log(
				`[integration] sub-node ${level.padEnd(7)} reasoning=${String(reasoning).padStart(4)}  contentLen=${content.length}`,
			);
		}

		for (const level of levels) {
			expect(results[level].content.length).toBeGreaterThan(0);
			expect(results[level].content.toLowerCase()).toContain('goose');
		}
		expect(results.HIGH.reasoning).toBeGreaterThan(results.MINIMAL.reasoning);
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
