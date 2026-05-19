import { buildSafetySettings } from '../safetySettings';

describe('buildSafetySettings', () => {
	it('returns an empty array when the group is undefined or empty', () => {
		expect(buildSafetySettings(undefined)).toEqual([]);
		expect(buildSafetySettings({})).toEqual([]);
	});

	it('skips categories left on "Use Default" (empty string)', () => {
		expect(buildSafetySettings({ harassment: '', hateSpeech: '' })).toEqual([]);
	});

	it('maps a set category to its HarmCategory and threshold', () => {
		expect(buildSafetySettings({ harassment: 'BLOCK_NONE' })).toEqual([
			{ category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
		]);
	});

	it('maps every category field to the correct HarmCategory', () => {
		const result = buildSafetySettings({
			civicIntegrity: 'OFF',
			dangerousContent: 'BLOCK_ONLY_HIGH',
			harassment: 'BLOCK_LOW_AND_ABOVE',
			hateSpeech: 'BLOCK_MEDIUM_AND_ABOVE',
			sexuallyExplicit: 'BLOCK_NONE',
		});
		expect(result).toEqual([
			{ category: 'HARM_CATEGORY_CIVIC_INTEGRITY', threshold: 'OFF' },
			{ category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' },
			{ category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_LOW_AND_ABOVE' },
			{ category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
			{ category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
		]);
	});

	it('includes only the categories that were set', () => {
		const result = buildSafetySettings({
			harassment: 'BLOCK_NONE',
			hateSpeech: '',
			dangerousContent: 'BLOCK_ONLY_HIGH',
		});
		expect(result).toHaveLength(2);
		expect(result.map((s) => s.category)).toEqual([
			'HARM_CATEGORY_DANGEROUS_CONTENT',
			'HARM_CATEGORY_HARASSMENT',
		]);
	});
});
