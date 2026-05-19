import { ChatVertexAI, type ChatVertexAIInput } from '@langchain/google-vertexai';
import {
	NodeConnectionTypes,
	NodeOperationError,
	type INodeType,
	type INodeTypeDescription,
	type ISupplyDataFunctions,
	type SupplyData,
} from 'n8n-workflow';

import { buildAuth, type GoogleApiCredential } from '../shared/auth';
import { gcpProjectsList } from '../shared/gcpProjects';
import { modelNameField, projectIdField } from '../shared/modelFields';

export class GoogleVertexChatModelG3 implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Google Vertex Chat Model (Gemini 3)',
		name: 'googleVertexChatModelG3',
		icon: 'file:google.svg',
		group: ['transform'],
		version: 1,
		description: 'Gemini 3 chat model on Google Vertex AI',
		defaults: { name: 'Google Vertex Chat Model (Gemini 3)' },
		codex: {
			categories: ['AI'],
			subcategories: {
				AI: ['Language Models', 'Root Nodes'],
				'Language Models': ['Chat Models (Recommended)'],
			},
		},
		// eslint-disable-next-line n8n-nodes-base/node-class-description-inputs-wrong-regular-node
		inputs: [],
		// eslint-disable-next-line n8n-nodes-base/node-class-description-outputs-wrong
		outputs: [NodeConnectionTypes.AiLanguageModel],
		outputNames: ['Model'],
		credentials: [{ name: 'googleApi', required: true }],
		properties: [
			projectIdField,
			modelNameField,
			{
				displayName: 'Options',
				name: 'options',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				options: [
					{
						displayName: 'Maximum Number of Tokens',
						name: 'maxOutputTokens',
						type: 'number',
						default: 2048,
						description: 'The maximum number of tokens to generate in the completion',
					},
					{
						displayName: 'Reasoning Effort',
						name: 'reasoningEffort',
						type: 'options',
						default: '',
						description:
							'How much the model reasons before answering. Takes precedence over Thinking Budget. For the native Gemini 3 thinking level (including Minimal) and thought summaries, use the Google Vertex Gemini 3 action node.',
						options: [
							{ name: 'Default (Unset)', value: '' },
							{ name: 'Low', value: 'low' },
							{ name: 'Medium', value: 'medium' },
							{ name: 'High', value: 'high' },
						],
					},
					{
						displayName: 'Sampling Temperature',
						name: 'temperature',
						type: 'number',
						default: 1,
						description: 'Controls randomness of the output',
					},
					{
						displayName: 'Streaming',
						name: 'streaming',
						type: 'boolean',
						default: false,
						description: 'Whether to enable streaming on the underlying model',
					},
					{
						displayName: 'Thinking Budget',
						name: 'thinkingBudget',
						type: 'number',
						default: -1,
						description:
							'Reasoning-token budget. Set to 0 to disable thinking, -1 for dynamic. Ignored when Reasoning Effort is set.',
						typeOptions: { minValue: -1, numberPrecision: 0 },
					},
					{
						displayName: 'Top K',
						name: 'topK',
						type: 'number',
						default: 40,
						description: 'Limits sampling to the K most likely tokens',
					},
					{
						displayName: 'Top P',
						name: 'topP',
						type: 'number',
						default: 0.95,
						description: 'Controls diversity via nucleus sampling',
					},
				],
			},
		],
	};

	methods = {
		listSearch: { gcpProjectsList },
	};

	async supplyData(this: ISupplyDataFunctions, itemIndex: number): Promise<SupplyData> {
		const credentials = (await this.getCredentials(
			'googleApi',
		)) as unknown as GoogleApiCredential;
		const { email, privateKey, region } = buildAuth(credentials);

		const modelName = this.getNodeParameter('modelName', itemIndex) as string;
		const projectId = this.getNodeParameter('projectId', itemIndex, '', {
			extractValue: true,
		}) as string;
		const options = this.getNodeParameter('options', itemIndex, {}) as Record<string, unknown>;

		try {
			const modelConfig: ChatVertexAIInput = {
				authOptions: {
					projectId,
					credentials: { client_email: email, private_key: privateKey },
				},
				location: region,
				model: modelName,
				temperature: options.temperature as number | undefined,
				topP: options.topP as number | undefined,
				topK: options.topK as number | undefined,
				maxOutputTokens: options.maxOutputTokens as number | undefined,
				streaming: Boolean(options.streaming),
			};

			// Reasoning Effort takes precedence over the raw Thinking Budget.
			if (options.reasoningEffort) {
				modelConfig.reasoningEffort = options.reasoningEffort as 'low' | 'medium' | 'high';
			} else if (options.thinkingBudget !== undefined) {
				modelConfig.thinkingBudget = options.thinkingBudget as number;
			}

			const model = new ChatVertexAI(modelConfig);
			return { response: model };
		} catch (e) {
			throw new NodeOperationError(this.getNode(), e as Error, {
				message: 'Invalid options',
				description: (e as Error).message,
			});
		}
	}
}
