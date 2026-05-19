import { ChatVertexAI } from '@langchain/google-vertexai';

import { buildChatVertexConfig } from '../nodes/GoogleVertexChatModelG3/buildModel';
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
		const model = makeModel({ maxOutputTokens: 64, temperature: 0.2 });
		const result = await model.invoke('Reply with a short greeting.');
		expect(typeof result.content).toBe('string');
		expect((result.content as string).length).toBeGreaterThan(0);
	});

	it('sends thinkingLevel through LangChain — HIGH reasons at least as much as MINIMAL', async () => {
		const prompt =
			'A bat and ball cost $1.10 together. The bat costs $1.00 more than the ball. How much is the ball? Show your reasoning.';

		const run = async (level: string) => {
			const result = await makeModel({ thinkingLevel: level, maxOutputTokens: 512 }).invoke(
				prompt,
			);
			const usage = result.usage_metadata as UsageWithReasoning | undefined;
			return usage?.output_token_details?.reasoning ?? 0;
		};

		const minimal = await run('MINIMAL');
		const high = await run('HIGH');
		// eslint-disable-next-line no-console
		console.log(`[integration] sub-node reasoning tokens  MINIMAL=${minimal}  HIGH=${high}`);
		expect(high).toBeGreaterThan(0);
		expect(high).toBeGreaterThanOrEqual(minimal);
	});

	it('streams chunks when streaming is enabled', async () => {
		const model = makeModel({ streaming: true, maxOutputTokens: 128 });
		const chunks: string[] = [];
		for await (const chunk of await model.stream('Count from one to five in words.')) {
			if (typeof chunk.content === 'string') chunks.push(chunk.content);
		}
		expect(chunks.length).toBeGreaterThan(0);
		expect(chunks.join('').length).toBeGreaterThan(0);
	});
});
