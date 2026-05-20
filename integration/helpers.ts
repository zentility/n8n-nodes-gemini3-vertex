import * as fs from 'fs';

export interface IntegrationEnv {
	email: string;
	privateKey: string;
	projectId: string;
	location: string;
	model: string;
}

/**
 * Reads live-test configuration from the environment.
 *
 *   GCP_KEY_FILE   (required) path to a service-account JSON key file
 *   GCP_PROJECT_ID (optional) defaults to project_id inside the key file
 *   GCP_LOCATION   (optional) defaults to us-central1
 *   GEMINI_MODEL   (optional) defaults to gemini-3.1-pro
 *
 * Returns null when no key file is configured so the suites can self-skip.
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
	const keyFile = process.env.GCP_KEY_FILE;
	if (!keyFile || !fs.existsSync(keyFile)) return null;

	const raw = readServiceAccountKey(keyFile);

	const projectId = process.env.GCP_PROJECT_ID ?? raw.project_id;
	if (!projectId) {
		throw new Error('Set GCP_PROJECT_ID or use a key file that contains project_id.');
	}

	return {
		email: raw.client_email,
		privateKey: raw.private_key,
		projectId,
		location: process.env.GCP_LOCATION ?? 'us-central1',
		model: process.env.GEMINI_MODEL ?? 'gemini-3.1-pro',
	};
}
