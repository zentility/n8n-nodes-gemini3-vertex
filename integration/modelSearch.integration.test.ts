import { GoogleGenAI } from '@google/genai';

import { toModelResults, type ModelLike } from '../nodes/shared/modelSearch';
import { getIntegrationEnv } from './helpers';

const env = getIntegrationEnv();
const describeLive = env ? describe : describe.skip;

if (!env) {
	// eslint-disable-next-line no-console
	console.warn('[integration] GCP_KEY_FILE not set — model-listing live test skipped.');
}

describeLive('model listing — live Vertex AI', () => {
	it('lists base models and finds at least one Gemini model', async () => {
		const ai = new GoogleGenAI({
			vertexai: true,
			project: env!.projectId,
			location: env!.location,
			googleAuthOptions: {
				credentials: { client_email: env!.email, private_key: env!.privateKey },
			},
		});

		const raw: ModelLike[] = [];
		const pager = await ai.models.list({ config: { queryBase: true } });
		for await (const model of pager) {
			raw.push({
				name: model.name ?? undefined,
				displayName: model.displayName ?? undefined,
			});
		}

		const results = toModelResults(raw);
		// eslint-disable-next-line no-console
		console.log(`[integration] Gemini models found: ${results.map((r) => r.value).join(', ')}`);
		expect(results.length).toBeGreaterThan(0);
		expect(results.every((r) => r.value.includes('gemini'))).toBe(true);
	});
});
