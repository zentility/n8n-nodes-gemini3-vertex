import {
	aggregateStreamChunks,
	assertNoFeatureConflict,
	buildGenerateConfig,
	shapeOutput,
} from '../operations';

describe('aggregateStreamChunks', () => {
	it('concatenates chunk text and keeps the last chunk metadata', () => {
		const result = aggregateStreamChunks([
			{ text: 'Hel' },
			{ text: 'lo' },
			{ text: '!', candidates: [{ content: { parts: [] } }], usageMetadata: { totalTokenCount: 5 } },
		]);
		expect(result.text).toBe('Hello!');
		expect(result.usageMetadata).toEqual({ totalTokenCount: 5 });
		expect(result.candidates).toEqual([{ content: { parts: [] } }]);
	});
	it('handles an empty stream', () => {
		expect(aggregateStreamChunks([]).text).toBe('');
	});
});

describe('assertNoFeatureConflict', () => {
	it('throws when grounding and JSON schema are both enabled', () => {
		expect(() => assertNoFeatureConflict(true, true)).toThrow(/grounding/i);
	});
	it('does not throw when only one is enabled', () => {
		expect(() => assertNoFeatureConflict(true, false)).not.toThrow();
		expect(() => assertNoFeatureConflict(false, true)).not.toThrow();
	});
});

describe('buildGenerateConfig', () => {
	it('maps sampling options', () => {
		const cfg = buildGenerateConfig({
			temperature: 0.5,
			topP: 0.9,
			topK: 20,
			maxOutputTokens: 100,
		});
		expect(cfg.temperature).toBe(0.5);
		expect(cfg.maxOutputTokens).toBe(100);
	});
	it('adds thinkingConfig when thinkingLevel is set', () => {
		const cfg = buildGenerateConfig({ thinkingLevel: 'HIGH', includeThoughts: true });
		expect(cfg.thinkingConfig).toEqual({ thinkingLevel: 'HIGH', includeThoughts: true });
	});
	it('omits thinkingConfig when nothing thinking-related is set', () => {
		const cfg = buildGenerateConfig({ temperature: 0.5 });
		expect(cfg.thinkingConfig).toBeUndefined();
	});
	it('adds the googleSearch tool when grounding is enabled', () => {
		const cfg = buildGenerateConfig({ enableGrounding: true });
		expect(cfg.tools).toEqual([{ googleSearch: {} }]);
	});
	it('sets JSON response config when a schema is provided', () => {
		const cfg = buildGenerateConfig({ responseSchema: { type: 'object' } });
		expect(cfg.responseMimeType).toBe('application/json');
		expect(cfg.responseSchema).toEqual({ type: 'object' });
	});
});

describe('shapeOutput', () => {
	const baseResponse = {
		text: 'hello',
		candidates: [{ content: { parts: [{ text: 'hello' }] } }],
		usageMetadata: { totalTokenCount: 12 },
	};

	it('returns text and usage metadata', () => {
		const out = shapeOutput(baseResponse as never, { responseFormat: 'text' });
		expect(out.text).toBe('hello');
		expect(out.usageMetadata).toEqual({ totalTokenCount: 12 });
	});
	it('parses JSON when responseFormat is json', () => {
		const resp = { ...baseResponse, text: '{"a":1}' };
		const out = shapeOutput(resp as never, { responseFormat: 'json' });
		expect(out.parsedJson).toEqual({ a: 1 });
	});
	it('omits parsedJson in text mode', () => {
		const out = shapeOutput(baseResponse as never, { responseFormat: 'text' });
		expect(out.parsedJson).toBeUndefined();
	});
	it('extracts a thought summary when a thought part is present', () => {
		const resp = {
			text: 'answer',
			candidates: [
				{
					content: {
						parts: [
							{ text: 'reasoning', thought: true },
							{ text: 'answer' },
						],
					},
				},
			],
		};
		const out = shapeOutput(resp as never, { responseFormat: 'text' });
		expect(out.thoughtSummary).toBe('reasoning');
	});
	it('includes groundingMetadata when present', () => {
		const resp = {
			text: 'answer',
			candidates: [{ content: { parts: [] }, groundingMetadata: { webSearchQueries: ['x'] } }],
		};
		const out = shapeOutput(resp as never, { responseFormat: 'text' });
		expect(out.groundingMetadata).toEqual({ webSearchQueries: ['x'] });
	});
});
