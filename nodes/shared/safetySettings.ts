import type { INodeProperties } from 'n8n-workflow';

const thresholdOptions = [
	{ name: 'Use Default', value: '' },
	{ name: 'Block None', value: 'BLOCK_NONE' },
	{ name: 'Block Low & Above', value: 'BLOCK_LOW_AND_ABOVE' },
	{ name: 'Block Medium & Above', value: 'BLOCK_MEDIUM_AND_ABOVE' },
	{ name: 'Block Only High', value: 'BLOCK_ONLY_HIGH' },
	{ name: 'Off', value: 'OFF' },
];

// Maps the field name of each per-category dropdown to its Gemini HarmCategory.
const CATEGORY_BY_FIELD: Record<string, string> = {
	civicIntegrity: 'HARM_CATEGORY_CIVIC_INTEGRITY',
	dangerousContent: 'HARM_CATEGORY_DANGEROUS_CONTENT',
	harassment: 'HARM_CATEGORY_HARASSMENT',
	hateSpeech: 'HARM_CATEGORY_HATE_SPEECH',
	sexuallyExplicit: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
};

export interface SafetySetting {
	category: string;
	threshold: string;
}

const categoryField = (displayName: string, name: string): INodeProperties => ({
	displayName,
	name,
	type: 'options',
	default: '',
	description: `Blocking threshold for ${displayName.toLowerCase()} content`,
	options: thresholdOptions,
});

/**
 * One always-visible threshold dropdown per harm category — no per-row
 * "add item" clicking. Expand once and set every category at a glance.
 */
export const safetySettingsField: INodeProperties = {
	displayName: 'Safety Settings',
	name: 'safetySettings',
	type: 'fixedCollection',
	default: {},
	placeholder: 'Add Safety Settings',
	description: "Per-category content-blocking thresholds. Leave a category as Use Default to keep Google's default.",
	options: [
		{
			name: 'values',
			displayName: 'Thresholds',
			values: [
				categoryField('Civic Integrity', 'civicIntegrity'),
				categoryField('Dangerous Content', 'dangerousContent'),
				categoryField('Harassment', 'harassment'),
				categoryField('Hate Speech', 'hateSpeech'),
				categoryField('Sexually Explicit', 'sexuallyExplicit'),
			],
		},
	],
};

/**
 * Turns the safetySettings.values group into the API's safetySettings array,
 * dropping any category left on "Use Default".
 */
export function buildSafetySettings(
	group: Record<string, unknown> | undefined,
): SafetySetting[] {
	if (!group) return [];
	const result: SafetySetting[] = [];
	for (const [field, category] of Object.entries(CATEGORY_BY_FIELD)) {
		const threshold = group[field];
		if (typeof threshold === 'string' && threshold !== '') {
			result.push({ category, threshold });
		}
	}
	return result;
}
