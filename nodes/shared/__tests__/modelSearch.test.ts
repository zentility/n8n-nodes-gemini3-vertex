import { pickLatestFlash, toModelResults } from '../modelSearch';

const m = (id: string) => ({ name: `publishers/google/models/${id}` });

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
