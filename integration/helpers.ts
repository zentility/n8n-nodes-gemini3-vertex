import * as fs from 'fs';

import { GoogleGenAI } from '@google/genai';

import { pickLatestFlash, type ModelLike } from '../nodes/shared/modelSearch';

export interface IntegrationEnv {
	/** Service-account identity. Absent in ADC mode — see `GCP_USE_ADC`. */
	email?: string;
	privateKey?: string;
	projectId: string;
	location: string;
	/** Explicit model override; when unset the suites resolve the latest flash model. */
	model?: string;
}

/** An env backed by a service-account key, as the nodes themselves require. */
export type ServiceAccountEnv = IntegrationEnv & { email: string; privateKey: string };

/**
 * Reads live-test configuration from the environment.
 *
 *   GCP_KEY_FILE   path to a service-account JSON key file
 *   GCP_USE_ADC    set to 1 to use Application Default Credentials instead
 *                  (`gcloud auth application-default login`). Only the suites
 *                  that talk to @google/genai directly run in this mode; tests
 *                  that need a service-account email + private key self-skip.
 *   GCP_PROJECT_ID (optional with a key file, required with ADC)
 *   GCP_LOCATION   (optional) defaults to global — the location that serves
 *                  Gemini 3.x; see the README's Credentials section
 *   GEMINI_MODEL   (optional) defaults to the latest flash model in the live
 *                  catalogue, the same way the nodes resolve an empty Model
 *
 * Returns null when neither is configured so the suites can self-skip.
 */
interface ServiceAccountKey {
	client_email: string;
	private_key: string;
	project_id?: string;
}

function isServiceAccountKey(value: unknown): value is ServiceAccountKey {
	return (
		!!value &&
		typeof value === 'object' &&
		typeof (value as Record<string, unknown>).client_email === 'string' &&
		typeof (value as Record<string, unknown>).private_key === 'string'
	);
}

function readServiceAccountKey(keyFile: string): ServiceAccountKey {
	const contents = fs.readFileSync(keyFile, 'utf8').trim();
	const candidates: Array<() => string> = [
		() => contents,
		() => Buffer.from(contents, 'base64').toString('utf8'),
	];
	for (const decode of candidates) {
		try {
			const parsed: unknown = JSON.parse(decode());
			if (isServiceAccountKey(parsed)) return parsed;
		} catch {
			// try the next decoding strategy
		}
	}
	throw new Error(
		`GCP_KEY_FILE does not contain a service-account JSON (or base64-encoded one): ${keyFile}`,
	);
}

export function getIntegrationEnv(): IntegrationEnv | null {
	const location = process.env.GCP_LOCATION ?? 'global';
	const model = process.env.GEMINI_MODEL || undefined;

	const keyFile = process.env.GCP_KEY_FILE;
	if (keyFile && fs.existsSync(keyFile)) {
		const raw = readServiceAccountKey(keyFile);
		const projectId = process.env.GCP_PROJECT_ID ?? raw.project_id;
		if (!projectId) {
			throw new Error('Set GCP_PROJECT_ID or use a key file that contains project_id.');
		}
		return { email: raw.client_email, privateKey: raw.private_key, projectId, location, model };
	}

	if (process.env.GCP_USE_ADC === '1') {
		const projectId = process.env.GCP_PROJECT_ID;
		if (!projectId) throw new Error('GCP_USE_ADC=1 requires GCP_PROJECT_ID.');
		return { projectId, location, model };
	}

	return null;
}

export function hasServiceAccount(env: IntegrationEnv | null): env is ServiceAccountEnv {
	return !!env?.email && !!env.privateKey;
}

/** A Vertex client for the env — service-account credentials, or ADC when there are none. */
export function makeGenAi(env: IntegrationEnv): GoogleGenAI {
	return new GoogleGenAI({
		vertexai: true,
		project: env.projectId,
		location: env.location,
		...(hasServiceAccount(env) && {
			googleAuthOptions: {
				credentials: { client_email: env.email, private_key: env.privateKey },
			},
		}),
	});
}

export async function listBaseModels(ai: GoogleGenAI): Promise<ModelLike[]> {
	const models: ModelLike[] = [];
	for await (const model of await ai.models.list({ config: { queryBase: true } })) {
		models.push({ name: model.name ?? undefined, displayName: model.displayName ?? undefined });
	}
	return models;
}

/**
 * The model the suites run against: GEMINI_MODEL if set, else the latest flash
 * model in the live catalogue. A hardcoded default goes stale as Google retires
 * model IDs, which silently breaks every test with a 404.
 */
export async function resolveModel(env: IntegrationEnv, ai: GoogleGenAI): Promise<string> {
	if (env.model) return env.model;
	const model = pickLatestFlash(await listBaseModels(ai));
	if (!model) {
		throw new Error(`No flash model found in ${env.location}; set GEMINI_MODEL explicitly.`);
	}
	// eslint-disable-next-line no-console
	console.log(`[integration] GEMINI_MODEL not set — using latest flash model: ${model}`);
	return model;
}

export type ThinkingLevel = 'MINIMAL' | 'LOW' | 'MEDIUM' | 'HIGH';

/** Vertex words this differently per model: "is unsupported" / "is not supported by this model". */
export function isUnsupportedThinkingLevel(error: unknown): boolean {
	const message = error instanceof Error ? error.message : String(error);
	return /thinking.?level/i.test(message) && /unsupported|not supported/i.test(message);
}

/**
 * The thinking levels the model accepts, lowest first. Newer models dropped
 * MINIMAL (gemini-3.7-flash and later, gemini-3.1-pro-preview) and reject it
 * with a 400, so the suites probe once instead of assuming all four.
 */
export async function supportedThinkingLevels(
	ai: GoogleGenAI,
	model: string,
): Promise<ThinkingLevel[]> {
	try {
		await ai.models.generateContent({
			model,
			contents: 'Say OK',
			config: { maxOutputTokens: 16, thinkingConfig: { thinkingLevel: 'MINIMAL' } } as never,
		});
		return ['MINIMAL', 'LOW', 'MEDIUM', 'HIGH'];
	} catch (error) {
		if (!isUnsupportedThinkingLevel(error)) throw error;
		// eslint-disable-next-line no-console
		console.log(`[integration] ${model} does not support MINIMAL — using LOW as the lowest level`);
		return ['LOW', 'MEDIUM', 'HIGH'];
	}
}
