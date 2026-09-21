import {
	listModelsWithProbe,
	pickLatestFlash,
	probeCandidates,
	toModelResults,
	type ModelsClient,
} from '../modelSearch';

const m = (id: string) => ({ name: `publishers/google/models/${id}` });

describe('probeCandidates', () => {
	it('derives family IDs for every listed Gemini version, skipping listed ones', () => {
		const candidates = probeCandidates([m('gemini-3.5-flash'), m('gemini-3-pro-preview')]);
		expect(candidates).toContain('gemini-3.5-pro');
		expect(candidates).toContain('gemini-3-pro');
		expect(candidates).not.toContain('gemini-3.5-flash');
		expect(candidates).not.toContain('gemini-3-pro-preview');
	});

	it('returns nothing when no versioned Gemini model is listed', () => {
		expect(probeCandidates([m('imagen-3'), m('gemini-embedding-001')])).toEqual([]);
	});
});

describe('listModelsWithProbe', () => {
	const fakeClient = (listed: string[], gettable: string[]): ModelsClient => ({
		list: async () =>
			(async function* () {
				for (const id of listed) yield m(id);
			})(),
		get: async ({ model }) => {
			if (!gettable.includes(model)) throw new Error('404 not found');
			return m(model);
		},
	});

	// Vertex's publisher model list omits models that models.get resolves
	// (observed live: gemini-3.5-pro is GA and gettable but never listed).
	it('adds models that exist but are missing from the list response', async () => {
		const models = await listModelsWithProbe(
			fakeClient(['gemini-3.5-flash'], ['gemini-3.5-flash', 'gemini-3.5-pro']),
		);
		const ids = models.map((model) => model.name?.split('/').pop());
		expect(ids).toEqual(['gemini-3.5-flash', 'gemini-3.5-pro']);
	});

	it('returns the plain list when no probe resolves', async () => {
		const models = await listModelsWithProbe(fakeClient(['gemini-2.5-flash'], []));
		expect(models.map((model) => model.name)).toEqual([m('gemini-2.5-flash').name]);
	});
});

describe('pickLatestFlash', () => {
	it('picks the highest Gemini version flash model', () => {
		const picked = pickLatestFlash([
			m('gemini-2.5-flash'),
			m('gemini-3.1-flash'),
			m('gemini-3-flash'),
		]);
		expect(picked).toBe('gemini-3.1-flash');
	});

	it('excludes flash-lite', () => {
		const picked = pickLatestFlash([m('gemini-3.1-flash-lite'), m('gemini-3-flash')]);
		expect(picked).toBe('gemini-3-flash');
	});

	it('excludes non-chat flash variants (image/audio/tts)', () => {
		const picked = pickLatestFlash([
			m('gemini-3.1-flash-image'),
			m('gemini-3.1-flash-tts'),
			m('gemini-2.5-flash'),
		]);
		expect(picked).toBe('gemini-2.5-flash');
	});

	it('prefers a stable release over preview at the same version', () => {
		const picked = pickLatestFlash([
			m('gemini-3.1-flash-preview-11-2025'),
			m('gemini-3.1-flash'),
		]);
		expect(picked).toBe('gemini-3.1-flash');
	});

	it('still returns a preview flash if that is the newest available', () => {
		const picked = pickLatestFlash([m('gemini-2.5-flash'), m('gemini-3.1-flash-preview')]);
		expect(picked).toBe('gemini-3.1-flash-preview');
	});

	it('ignores pro models and returns undefined when no flash model exists', () => {
		expect(pickLatestFlash([m('gemini-3.1-pro'), m('imagen-3')])).toBeUndefined();
	});
});

const sample = [
	{ name: 'publishers/google/models/gemini-3-pro-preview', displayName: 'Gemini 3 Pro' },
	{ name: 'publishers/google/models/gemini-3-flash', displayName: 'Gemini 3 Flash' },
	{ name: 'publishers/google/models/imagen-3', displayName: 'Imagen 3' },
	{ name: 'publishers/google/models/text-bison' },
];

describe('toModelResults', () => {
	it('keeps only Gemini models', () => {
		const results = toModelResults(sample);
		expect(results.map((r) => r.value)).toEqual(['gemini-3-pro-preview', 'gemini-3-flash']);
	});

	it('maps the value to the short model ID (last path segment)', () => {
		expect(toModelResults(sample)[0].value).toBe('gemini-3-pro-preview');
	});

	it('uses the display name when present, else the ID', () => {
		const results = toModelResults([
			{ name: 'publishers/google/models/gemini-x', displayName: 'Gemini X' },
			{ name: 'publishers/google/models/gemini-y' },
		]);
		expect(results[0].name).toBe('Gemini X');
		expect(results[1].name).toBe('gemini-y');
	});

	it('filters by the search term against ID and display name', () => {
		expect(toModelResults(sample, 'flash').map((r) => r.value)).toEqual(['gemini-3-flash']);
		expect(toModelResults(sample, 'PRO').map((r) => r.value)).toEqual(['gemini-3-pro-preview']);
	});

	it('returns an empty list when nothing matches', () => {
		expect(toModelResults(sample, 'nonexistent')).toEqual([]);
	});
});
