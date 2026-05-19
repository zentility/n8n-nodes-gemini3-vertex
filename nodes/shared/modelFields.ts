import type { INodeProperties } from 'n8n-workflow';

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
	displayName: 'Model',
	name: 'modelName',
	type: 'resourceLocator',
	default: { mode: 'list', value: 'gemini-3.1-pro' },
	required: true,
	description: 'The Gemini model to use. Pick from the live list or enter an ID.',
	modes: [
		{
			displayName: 'From List',
			name: 'list',
			type: 'list',
			typeOptions: { searchListMethod: 'modelSearch' },
		},
		{
			displayName: 'ID',
			name: 'id',
			type: 'string',
			placeholder: 'gemini-3.1-pro',
		},
	],
};

export const thinkingLevelField: INodeProperties = {
	displayName: 'Thinking Level',
	name: 'thinkingLevel',
	type: 'resourceLocator',
	default: { mode: 'list', value: '' },
	description:
		'Controls how much the model reasons before answering. Takes precedence over Thinking Budget.',
	modes: [
		{
			displayName: 'From List',
			name: 'list',
			type: 'list',
			typeOptions: { searchListMethod: 'thinkingLevelSearch' },
		},
		{
			displayName: 'Expression',
			name: 'expression',
			type: 'string',
			placeholder: 'MINIMAL, LOW, MEDIUM, or HIGH',
		},
	],
};

export const includeThoughtsField: INodeProperties = {
	displayName: 'Include Thought Summaries',
	name: 'includeThoughts',
	type: 'boolean',
	default: false,
	description: 'Whether to request a summary of the model reasoning',
};
