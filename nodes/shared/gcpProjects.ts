import { ProjectsClient } from '@google-cloud/resource-manager';
import type { ILoadOptionsFunctions, INodeListSearchResult } from 'n8n-workflow';

import { buildAuth, type GoogleApiCredential } from './auth';

export async function gcpProjectsList(
	this: ILoadOptionsFunctions,
): Promise<INodeListSearchResult> {
	const credentials = (await this.getCredentials(
		'googleApi',
	)) as unknown as GoogleApiCredential;
	const { email, privateKey } = buildAuth(credentials);

	const client = new ProjectsClient({
		credentials: { client_email: email, private_key: privateKey },
	});

	const [projects] = await client.searchProjects();
	const results: Array<{ name: string; value: string }> = [];
	for (const project of projects) {
		if (project.projectId) {
			results.push({
				name: project.displayName ?? project.projectId,
				value: project.projectId,
			});
		}
	}
	return { results };
}
