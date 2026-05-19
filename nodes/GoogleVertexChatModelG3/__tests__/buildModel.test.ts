import { buildChatVertexConfig } from '../buildModel';

const base = {
	email: 'svc@project.iam.gserviceaccount.com',
	privateKey: '-----BEGIN PRIVATE KEY-----\nABC\n-----END PRIVATE KEY-----',
	projectId: 'my-project',
	region: 'us-central1',
	modelName: 'gemini-3-pro-preview',
};

describe('buildChatVertexConfig', () => {
	it('maps auth, location, and model', () => {
		const cfg = buildChatVertexConfig({ ...base, options: {} });
		expect(cfg.model).toBe('gemini-3-pro-preview');
		expect(cfg.location).toBe('us-central1');
		expect(cfg.authOptions?.projectId).toBe('my-project');
		const creds = cfg.authOptions?.credentials as { client_email?: string };
		expect(creds?.client_email).toBe(base.email);
	});

	it('passes the native thinking level through', () => {
		const cfg = buildChatVertexConfig({ ...base, options: { thinkingLevel: 'HIGH' } });
		expect(cfg.thinkingLevel).toBe('HIGH');
		expect(cfg.thinkingBudget).toBeUndefined();
	});

	it('uses the thinking budget when no thinking level is set', () => {
		const cfg = buildChatVertexConfig({ ...base, options: { thinkingBudget: 1024 } });
		expect(cfg.thinkingBudget).toBe(1024);
		expect(cfg.thinkingLevel).toBeUndefined();
	});

	it('lets thinking level win when both are supplied', () => {
		const cfg = buildChatVertexConfig({
			...base,
			options: { thinkingLevel: 'LOW', thinkingBudget: 1024 },
		});
		expect(cfg.thinkingLevel).toBe('LOW');
		expect(cfg.thinkingBudget).toBeUndefined();
	});

	it('defaults streaming to false', () => {
		expect(buildChatVertexConfig({ ...base, options: {} }).streaming).toBe(false);
		expect(
			buildChatVertexConfig({ ...base, options: { streaming: true } }).streaming,
		).toBe(true);
	});

	it('passes safety settings through when provided', () => {
		const safetySettings = [
			{ category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
		];
		const cfg = buildChatVertexConfig({ ...base, options: { safetySettings } });
		expect(cfg.safetySettings).toEqual(safetySettings);
	});

	it('omits safety settings when none are provided', () => {
		expect(buildChatVertexConfig({ ...base, options: {} }).safetySettings).toBeUndefined();
		expect(
			buildChatVertexConfig({ ...base, options: { safetySettings: [] } }).safetySettings,
		).toBeUndefined();
	});
});
