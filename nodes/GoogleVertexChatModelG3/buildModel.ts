import type { ChatVertexAIInput } from '@langchain/google-vertexai';

import type { SafetySetting } from '../shared/safetySettings';

export interface ChatVertexConfigParams {
	email: string;
	privateKey: string;
	projectId: string;
	region: string;
	modelName: string;
	options: {
		temperature?: number;
		topP?: number;
		topK?: number;
		maxOutputTokens?: number;
		streaming?: boolean;
		thinkingLevel?: string;
		thinkingBudget?: number;
		safetySettings?: SafetySetting[];
	};
}

export function buildChatVertexConfig(params: ChatVertexConfigParams): ChatVertexAIInput {
	const { email, privateKey, projectId, region, modelName, options } = params;

	const config: ChatVertexAIInput = {
		authOptions: {
			projectId,
			credentials: { client_email: email, private_key: privateKey },
		},
		location: region,
		model: modelName,
		temperature: options.temperature,
		topP: options.topP,
		topK: options.topK,
		maxOutputTokens: options.maxOutputTokens,
		streaming: Boolean(options.streaming),
	};

	// Native Gemini 3 thinking level takes precedence over the raw budget.
	if (options.thinkingLevel) {
		config.thinkingLevel = options.thinkingLevel as ChatVertexAIInput['thinkingLevel'];
	} else if (options.thinkingBudget !== undefined) {
		config.thinkingBudget = options.thinkingBudget;
	}

	if (options.safetySettings && options.safetySettings.length > 0) {
		config.safetySettings = options.safetySettings as ChatVertexAIInput['safetySettings'];
	}

	return config;
}
