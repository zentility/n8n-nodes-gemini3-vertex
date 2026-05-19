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
 *   GEMINI_MODEL   (optional) defaults to gemini-3-pro-preview
 *
 * Returns null when no key file is configured so the suites can self-skip.
 */
export function getIntegrationEnv(): IntegrationEnv | null {
	const keyFile = process.env.GCP_KEY_FILE;
	if (!keyFile || !fs.existsSync(keyFile)) return null;

	const raw = JSON.parse(fs.readFileSync(keyFile, 'utf8')) as {
		client_email: string;
		private_key: string;
		project_id?: string;
	};

	const projectId = process.env.GCP_PROJECT_ID ?? raw.project_id;
	if (!projectId) {
		throw new Error('Set GCP_PROJECT_ID or use a key file that contains project_id.');
	}

	return {
		email: raw.client_email,
		privateKey: raw.private_key,
		projectId,
		location: process.env.GCP_LOCATION ?? 'us-central1',
		model: process.env.GEMINI_MODEL ?? 'gemini-3-pro-preview',
	};
}
