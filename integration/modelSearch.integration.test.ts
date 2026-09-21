import { resolveLatestFlash, toModelResults } from '../nodes/shared/modelSearch';
import { getIntegrationEnv, hasServiceAccount, listBaseModels, makeGenAi } from './helpers';

const env = getIntegrationEnv();
const describeLive = env ? describe : describe.skip;
// resolveLatestFlash takes a service-account email + private key, like the nodes do.
const itServiceAccount = hasServiceAccount(env) ? it : it.skip;

if (!env) {
	// eslint-disable-next-line no-console
	console.warn('[integration] GCP_KEY_FILE / GCP_USE_ADC not set — model-listing live test skipped.');
}

describeLive('model listing — live Vertex AI', () => {
	it('lists base models and finds at least one Gemini model', async () => {
		const results = toModelResults(await listBaseModels(makeGenAi(env!)));
		// eslint-disable-next-line no-console
		console.log(`[integration] Gemini models found: ${results.map((r) => r.value).join(', ')}`);
		expect(results.length).toBeGreaterThan(0);
		expect(results.every((r) => r.value.includes('gemini'))).toBe(true);
	});

	itServiceAccount('resolveLatestFlash returns a flash chat model (not flash-lite)', async () => {
		if (!hasServiceAccount(env)) return;
		const model = await resolveLatestFlash({
			email: env.email,
			privateKey: env.privateKey,
			projectId: env.projectId,
			region: env.location,
		});
		// eslint-disable-next-line no-console
		console.log(`[integration] resolved latest flash model: ${model}`);
		expect(model).toBeDefined();
		expect(model!.toLowerCase()).toContain('flash');
		expect(model!.toLowerCase()).not.toContain('flash-lite');
	});
});
