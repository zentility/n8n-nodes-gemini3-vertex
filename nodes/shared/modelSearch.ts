import { GoogleGenAI } from '@google/genai';
import type { ILoadOptionsFunctions, INodeListSearchResult } from 'n8n-workflow';

import { buildAuth, type GoogleApiCredential } from './auth';

export interface ModelLike {
	name?: string;
	displayName?: string;
}

/**
 * Filters a raw model list down to Gemini models and maps each to a
 * dropdown entry. The `value` is the short model ID (last path segment),
 * which is what generateContent / ChatVertexAI expect.
 */
export function toModelResults(
	models: ModelLike[],
	filter?: string,
): Array<{ name: string; value: string }> {
	const needle = filter?.toLowerCase();
	const results: Array<{ name: string; value: string }> = [];
	for (const model of models) {
		const id = (model.name ?? '').split('/').pop() ?? '';
		if (!id.toLowerCase().includes('gemini')) continue;
		if (
			needle &&
			!id.toLowerCase().includes(needle) &&
			!(model.displayName ?? '').toLowerCase().includes(needle)
		) {
			continue;
		}
		results.push({ name: model.displayName || id, value: id });
	}
	return results;
}

export async function modelSearch(
	this: ILoadOptionsFunctions,
	filter?: string,
): Promise<INodeListSearchResult> {
	const credentials = (await this.getCredentials(
		'googleApi',
	)) as unknown as GoogleApiCredential;
	const { email, privateKey, region } = buildAuth(credentials);
	const projectId = this.getNodeParameter('projectId', '', {
		extractValue: true,
	}) as string;

	const ai = new GoogleGenAI({
		vertexai: true,
		project: projectId,
		location: region,
		googleAuthOptions: {
			credentials: { client_email: email, private_key: privateKey },
		},
	});

	const models: ModelLike[] = [];
	const pager = await ai.models.list({ config: { queryBase: true } });
	for await (const model of pager) {
		models.push({
			name: model.name ?? undefined,
			displayName: model.displayName ?? undefined,
		});
	}

	return { results: toModelResults(models, filter) };
}
