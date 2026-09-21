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

/** The slice of `ai.models` the model lookup needs — narrow so tests can fake it. */
export interface ModelsClient {
	list(params: { config: { queryBase: boolean } }): Promise<AsyncIterable<ModelLike>>;
	get(params: { model: string }): Promise<ModelLike>;
}

async function listBaseModels(client: ModelsClient): Promise<ModelLike[]> {
	const models: ModelLike[] = [];
	const pager = await client.list({ config: { queryBase: true } });
	for await (const model of pager) {
		models.push({
			name: model.name ?? undefined,
			displayName: model.displayName ?? undefined,
		});
	}
	return models;
}

const shortId = (model: ModelLike): string => (model.name ?? '').split('/').pop() ?? '';

// Chat model families published per Gemini version.
const PROBE_SUFFIXES = [
	'pro',
	'pro-preview',
	'flash',
	'flash-preview',
	'flash-lite',
	'flash-lite-preview',
];

/**
 * Vertex's publisher model list is incomplete: some models (e.g. GA pro
 * releases) resolve via models.get but are never returned by models.list.
 * For every Gemini version the list does mention, this returns the standard
 * family IDs that are absent from it, so they can be probed individually.
 */
export function probeCandidates(models: ModelLike[]): string[] {
	const listed = new Set(models.map(shortId));
	const versions = new Set<string>();
	for (const id of listed) {
		const match = id.toLowerCase().match(/^gemini-(\d+(?:\.\d+)?)-/);
		if (match) versions.add(match[1]);
	}
	const candidates: string[] = [];
	for (const version of versions) {
		for (const suffix of PROBE_SUFFIXES) {
			const id = `gemini-${version}-${suffix}`;
			if (!listed.has(id)) candidates.push(id);
		}
	}
	return candidates;
}

/**
 * Lists base models, then appends the unlisted ones that models.get confirms
 * exist in this region. A failed probe just means "not available here".
 */
export async function listModelsWithProbe(client: ModelsClient): Promise<ModelLike[]> {
	const models = await listBaseModels(client);
	const probed = await Promise.all(
		probeCandidates(models).map(async (id) => {
			try {
				await client.get({ model: id });
				return id;
			} catch {
				return undefined;
			}
		}),
	);
	for (const id of probed) {
		if (id) models.push({ name: `publishers/google/models/${id}` });
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
	const models = await listBaseModels(makeClient(params).models);
	return pickLatestFlash(models);
}

// The dropdown re-queries on every filter keystroke; cache the probed
// catalogue briefly so typing doesn't fan out into dozens of GETs each time.
const CATALOGUE_TTL_MS = 5 * 60 * 1000;
const catalogueCache = new Map<string, { expires: number; models: ModelLike[] }>();

async function cachedCatalogue(params: VertexClientParams): Promise<ModelLike[]> {
	const key = `${params.email}|${params.projectId}|${params.region}`;
	const hit = catalogueCache.get(key);
	if (hit && hit.expires > Date.now()) return hit.models;
	const models = await listModelsWithProbe(makeClient(params).models);
	catalogueCache.set(key, { expires: Date.now() + CATALOGUE_TTL_MS, models });
	return models;
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

	const models = await cachedCatalogue({ email, privateKey, projectId, region });
	return { results: toModelResults(models, filter) };
}
