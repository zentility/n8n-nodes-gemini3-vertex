import { toModelResults } from '../modelSearch';

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
