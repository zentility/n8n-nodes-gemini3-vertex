import type { INodeProperties } from 'n8n-workflow';

export const DEFAULT_MODEL = 'gemini-3-pro-preview';

// thinking_level enum values match @google/genai's ThinkingLevel enum.
export const thinkingLevelOptions = [
	{ name: 'Minimal', value: 'MINIMAL' },
	{ name: 'Low', value: 'LOW' },
	{ name: 'Medium', value: 'MEDIUM' },
	{ name: 'High', value: 'HIGH' },
];

export const projectIdField: INodeProperties = {
	displayName: 'Project ID',
	name: 'projectId',
	type: 'resourceLocator',
	default: { mode: 'list', value: '' },
	required: true,
	description: 'Select or enter your Google Cloud project ID',
	modes: [
		{
			displayName: 'From List',
			name: 'list',
			type: 'list',
			typeOptions: { searchListMethod: 'gcpProjectsList' },
		},
		{ displayName: 'ID', name: 'id', type: 'string' },
	],
};

export const modelNameField: INodeProperties = {
	displayName: 'Model Name',
	name: 'modelName',
	type: 'string',
	default: DEFAULT_MODEL,
	description: 'The Gemini model to use, e.g. gemini-3-pro-preview',
};

export const thinkingLevelField: INodeProperties = {
	displayName: 'Thinking Level',
	name: 'thinkingLevel',
	type: 'options',
	default: '',
	description:
		'Controls how much the model reasons before answering. Takes precedence over Thinking Budget.',
	options: [{ name: 'Default (Unset)', value: '' }, ...thinkingLevelOptions],
};

export const includeThoughtsField: INodeProperties = {
	displayName: 'Include Thought Summaries',
	name: 'includeThoughts',
	type: 'boolean',
	default: false,
	description: 'Whether to request a summary of the model reasoning',
};
