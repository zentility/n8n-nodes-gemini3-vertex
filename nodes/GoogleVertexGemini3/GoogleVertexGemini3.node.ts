import { GoogleGenAI } from '@google/genai';
import {
	NodeOperationError,
	type IExecuteFunctions,
	type INodeExecutionData,
	type INodeType,
	type INodeTypeDescription,
} from 'n8n-workflow';

import { buildAuth, type GoogleApiCredential } from '../shared/auth';
import { describeVertexError } from '../shared/errors';
import { gcpProjectsList } from '../shared/gcpProjects';
import { modelSearch } from '../shared/modelSearch';
import {
	includeThoughtsField,
	modelNameField,
	projectIdField,
	thinkingLevelField,
} from '../shared/modelFields';
import {
	aggregateStreamChunks,
	assertNoFeatureConflict,
	buildGenerateConfig,
	shapeOutput,
} from './operations';

export class GoogleVertexGemini3 implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Google Vertex Gemini 3',
		name: 'googleVertexGemini3',
		icon: 'file:google.svg',
		group: ['transform'],
		version: 1,
		description: 'Send messages to Gemini 3 on Google Vertex AI',
		defaults: { name: 'Google Vertex Gemini 3' },
		inputs: ['main'],
		outputs: ['main'],
		credentials: [{ name: 'googleApi', required: true }],
		properties: [
			projectIdField,
			modelNameField,
			{
				displayName: 'Messages',
				name: 'messages',
				type: 'fixedCollection',
				typeOptions: { multipleValues: true },
				default: {},
				options: [
					{
						name: 'values',
						displayName: 'Message',
						values: [
							{
								displayName: 'Role',
								name: 'role',
								type: 'options',
								default: 'user',
								options: [
									{ name: 'User', value: 'user' },
									{ name: 'Model', value: 'model' },
								],
							},
							{ displayName: 'Text', name: 'text', type: 'string', default: '' },
						],
					},
				],
			},
			{
				displayName: 'System Instruction',
				name: 'systemInstruction',
				type: 'string',
				typeOptions: { rows: 2 },
				default: '',
			},
			{
				displayName: 'Stream Response',
				name: 'stream',
				type: 'boolean',
				default: false,
				description:
					'Whether to use the streaming endpoint. n8n still passes the complete aggregated result downstream.',
			},
			{
				displayName: 'Response Format',
				name: 'responseFormat',
				type: 'options',
				default: 'text',
				options: [
					{ name: 'Text', value: 'text' },
					{ name: 'JSON', value: 'json' },
				],
			},
			{
				displayName: 'Response Schema',
				name: 'responseSchema',
				type: 'json',
				default: '{}',
				displayOptions: { show: { responseFormat: ['json'] } },
				description: 'JSON Schema the model output must conform to',
			},
			{
				displayName: 'Options',
				name: 'options',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				options: [
					{
						displayName: 'Enable Google Search Grounding',
						name: 'enableGrounding',
						type: 'boolean',
						default: false,
						description:
							'Whether to let the model ground answers in live Google Search results',
					},
					includeThoughtsField,
					{
						displayName: 'Maximum Number of Tokens',
						name: 'maxOutputTokens',
						type: 'number',
						default: 2048,
						description: 'The maximum number of tokens to generate in the completion',
					},
					{
						displayName: 'Sampling Temperature',
						name: 'temperature',
						type: 'number',
						default: 1,
						description: 'Controls randomness of the output',
					},
					thinkingLevelField,
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
		listSearch: { gcpProjectsList, modelSearch },
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		const credentials = (await this.getCredentials(
			'googleApi',
		)) as unknown as GoogleApiCredential;
		const { email, privateKey, region } = buildAuth(credentials);

		for (let i = 0; i < items.length; i++) {
			try {
				const projectId = this.getNodeParameter('projectId', i, '', {
					extractValue: true,
				}) as string;
				const modelName = this.getNodeParameter('modelName', i, '', {
					extractValue: true,
				}) as string;
				const systemInstruction = this.getNodeParameter('systemInstruction', i, '') as string;
				const stream = this.getNodeParameter('stream', i, false) as boolean;
				const responseFormat = this.getNodeParameter('responseFormat', i, 'text') as
					| 'text'
					| 'json';
				const options = this.getNodeParameter('options', i, {}) as Record<string, unknown>;

				const messageValues = this.getNodeParameter('messages.values', i, []) as Array<{
					role: 'user' | 'model';
					text: string;
				}>;

				let responseSchema: unknown;
				if (responseFormat === 'json') {
					const raw = this.getNodeParameter('responseSchema', i, '{}') as string;
					responseSchema = typeof raw === 'string' ? JSON.parse(raw) : raw;
				}

				assertNoFeatureConflict(
					Boolean(options.enableGrounding),
					responseSchema !== undefined,
				);

				const config = buildGenerateConfig({
					temperature: options.temperature as number | undefined,
					topP: options.topP as number | undefined,
					topK: options.topK as number | undefined,
					maxOutputTokens: options.maxOutputTokens as number | undefined,
					thinkingLevel: options.thinkingLevel as string | undefined,
					includeThoughts: options.includeThoughts as boolean | undefined,
					enableGrounding: options.enableGrounding as boolean | undefined,
					responseSchema,
				});

				const ai = new GoogleGenAI({
					vertexai: true,
					project: projectId,
					location: region,
					googleAuthOptions: {
						credentials: { client_email: email, private_key: privateKey },
					},
				});

				const contents = messageValues.map((m) => ({
					role: m.role,
					parts: [{ text: m.text }],
				}));

				const request = {
					model: modelName,
					contents,
					config: {
						...config,
						...(systemInstruction ? { systemInstruction } : {}),
					},
				};

				let response;
				if (stream) {
					const streamIterator = await ai.models.generateContentStream(request as never);
					const chunks = [];
					for await (const chunk of streamIterator) {
						chunks.push({
							text: chunk.text,
							candidates: chunk.candidates,
							usageMetadata: chunk.usageMetadata,
						});
					}
					response = aggregateStreamChunks(chunks as never);
				} else {
					response = await ai.models.generateContent(request as never);
				}

				const shaped = shapeOutput(response as never, { responseFormat });
				returnData.push({ json: shaped as never, pairedItem: { item: i } });
			} catch (error) {
				const err = error as { status?: number; response?: { status?: number } };
				const status = Number(err?.status ?? err?.response?.status);
				const friendly = describeVertexError(status);
				if (this.continueOnFail()) {
					returnData.push({
						json: { error: friendly?.message ?? (error as Error).message },
						pairedItem: { item: i },
					});
					continue;
				}
				if (friendly) {
					throw new NodeOperationError(this.getNode(), error as Error, {
						message: friendly.message,
						description: friendly.description,
					});
				}
				throw new NodeOperationError(this.getNode(), error as Error);
			}
		}

		return [returnData];
	}
}
