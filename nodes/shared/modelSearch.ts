import { GoogleGenAI } from '@google/genai';
import type { ILoadOptionsFunctions, INodeListSearchResult } from 'n8n-workflow';

import { buildAuth, type GoogleApiCredential } from './auth';

export interface ModelLike {
	name?: string;
	displayName?: string;
}

export interface VertexClientParams {
	email: string;
	privateKey: string;
	projectId: string;
	region: string;
}

function makeClient(params: VertexClientParams): GoogleGenAI {
	return new GoogleGenAI({
		vertexai: true,
		project: params.projectId,
		location: params.region,
		googleAuthOptions: {
			credentials: { client_email: params.email, private_key: params.privateKey },
		},
	});
}

async function listBaseModels(ai: GoogleGenAI): Promise<ModelLike[]> {
	const models: ModelLike[] = [];
	const pager = await ai.models.list({ config: { queryBase: true } });
	for await (const model of pager) {
		models.push({
			name: model.name ?? undefined,
			displayName: model.displayName ?? undefined,
		});
	}
	return models;
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

// Non-chat flash variants that must never be picked as the default model.
const FLASH_EXCLUDE = /flash-(lite|image|tts|audio|native|live)/;

/**
 * Picks the newest general-purpose flash chat model from a model list —
 * the highest Gemini version of `gemini-<version>-flash`, excluding
 * flash-lite and non-chat flash variants (image/audio/etc.). Stable
 * releases win over preview/exp at the same version.
 */
export function pickLatestFlash(models: ModelLike[]): string | undefined {
	const candidates: Array<{ id: string; version: number; preview: boolean }> = [];
	for (const model of models) {
		const id = (model.name ?? '').split('/').pop() ?? '';
		const lower = id.toLowerCase();
		const match = lower.match(/^gemini-(\d+(?:\.\d+)?)-flash\b/);
		if (!match) continue;
		if (FLASH_EXCLUDE.test(lower)) continue;
		candidates.push({
			id,
			version: parseFloat(match[1]),
			preview: /preview|exp/.test(lower),
		});
	}
	if (candidates.length === 0) return undefined;
	candidates.sort(
		(a, b) =>
			b.version - a.version ||
			Number(a.preview) - Number(b.preview) ||
			a.id.length - b.id.length,
	);
	return candidates[0].id;
}

/**
 * Resolves the latest flash model ID from the live Vertex catalogue.
 * Used when the Model field is left empty.
 */
export async function resolveLatestFlash(
	params: VertexClientParams,
): Promise<string | undefined> {
	const models = await listBaseModels(makeClient(params));
	return pickLatestFlash(models);
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

	const models = await listBaseModels(makeClient({ email, privateKey, projectId, region }));
	return { results: toModelResults(models, filter) };
}
