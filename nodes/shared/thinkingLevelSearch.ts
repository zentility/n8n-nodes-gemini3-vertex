import type { ILoadOptionsFunctions, INodeListSearchResult } from 'n8n-workflow';

const THINKING_LEVELS = [
	{ name: 'Default (Unset)', value: '' },
	{ name: 'Minimal', value: 'MINIMAL' },
	{ name: 'Low', value: 'LOW' },
	{ name: 'Medium', value: 'MEDIUM' },
	{ name: 'High', value: 'HIGH' },
];

/**
 * Static list-search backing the Thinking Level resource locator's
 * "From List" mode. The "Expression" mode handles dynamic values.
 */
export async function thinkingLevelSearch(
	this: ILoadOptionsFunctions,
	filter?: string,
): Promise<INodeListSearchResult> {
	const needle = filter?.toLowerCase();
	const results = needle
		? THINKING_LEVELS.filter(
				(level) =>
					level.name.toLowerCase().includes(needle) ||
					level.value.toLowerCase().includes(needle),
			)
		: THINKING_LEVELS;
	return { results };
}
