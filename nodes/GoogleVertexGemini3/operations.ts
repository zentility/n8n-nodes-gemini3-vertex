export interface GenerateOptions {
	temperature?: number;
	topP?: number;
	topK?: number;
	maxOutputTokens?: number;
	thinkingLevel?: string;
	includeThoughts?: boolean;
	enableGrounding?: boolean;
	responseSchema?: unknown;
	safetySettings?: unknown[];
}

export interface GenerateConfig {
	temperature?: number;
	topP?: number;
	topK?: number;
	maxOutputTokens?: number;
	thinkingConfig?: { thinkingLevel?: string; includeThoughts?: boolean };
	tools?: Array<{ googleSearch: Record<string, never> }>;
	responseMimeType?: string;
	responseSchema?: unknown;
	safetySettings?: unknown[];
}

export function assertNoFeatureConflict(
	enableGrounding: boolean,
	hasResponseSchema: boolean,
): void {
	if (enableGrounding && hasResponseSchema) {
		throw new Error(
			'Google Search grounding cannot be combined with a forced JSON response schema. Disable one of them.',
		);
	}
}

export function buildGenerateConfig(options: GenerateOptions): GenerateConfig {
	const config: GenerateConfig = {};

	if (options.temperature !== undefined) config.temperature = options.temperature;
	if (options.topP !== undefined) config.topP = options.topP;
	if (options.topK !== undefined) config.topK = options.topK;
	if (options.maxOutputTokens !== undefined) config.maxOutputTokens = options.maxOutputTokens;
	if (options.safetySettings && options.safetySettings.length > 0) {
		config.safetySettings = options.safetySettings;
	}

	if (options.thinkingLevel || options.includeThoughts) {
		config.thinkingConfig = {};
		if (options.thinkingLevel) config.thinkingConfig.thinkingLevel = options.thinkingLevel;
		if (options.includeThoughts) config.thinkingConfig.includeThoughts = true;
	}

	if (options.enableGrounding) {
		config.tools = [{ googleSearch: {} }];
	}

	if (options.responseSchema !== undefined) {
		config.responseMimeType = 'application/json';
		config.responseSchema = options.responseSchema;
	}

	return config;
}

interface GenAiResponse {
	text?: string;
	candidates?: Array<{
		content?: { parts?: Array<{ text?: string; thought?: boolean }> };
		groundingMetadata?: unknown;
	}>;
	usageMetadata?: unknown;
}

// Streaming yields partial chunks; concatenate their text and keep the last
// chunk's candidates/usageMetadata, which carry the final metadata.
export function aggregateStreamChunks(chunks: GenAiResponse[]): GenAiResponse {
	let text = '';
	let last: GenAiResponse | undefined;
	for (const chunk of chunks) {
		if (chunk.text) text += chunk.text;
		last = chunk;
	}
	return {
		text,
		candidates: last?.candidates,
		usageMetadata: last?.usageMetadata,
	};
}

export interface ShapedOutput {
	text: string;
	thoughtSummary?: string;
	parsedJson?: unknown;
	groundingMetadata?: unknown;
	usageMetadata?: unknown;
	raw: unknown;
}

export function shapeOutput(
	response: GenAiResponse,
	opts: { responseFormat: 'text' | 'json' },
): ShapedOutput {
	const text = response.text ?? '';
	const candidate = response.candidates?.[0];

	const out: ShapedOutput = {
		text,
		usageMetadata: response.usageMetadata,
		raw: candidate ?? response,
	};

	const thoughtPart = candidate?.content?.parts?.find((p) => p.thought && p.text);
	if (thoughtPart?.text) out.thoughtSummary = thoughtPart.text;

	if (candidate?.groundingMetadata) out.groundingMetadata = candidate.groundingMetadata;

	if (opts.responseFormat === 'json' && text) {
		out.parsedJson = JSON.parse(text);
	}

	return out;
}
