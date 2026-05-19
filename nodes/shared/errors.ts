export interface VertexErrorInfo {
	message: string;
	description: string;
}

export function describeVertexError(status: number): VertexErrorInfo | null {
	switch (status) {
		case 401:
			return {
				message: 'Authentication failed',
				description: 'Check the service account email and private key in the credential.',
			};
		case 403:
			return {
				message: 'Permission denied',
				description:
					'The service account lacks permission, or the Vertex AI API is not enabled for this project.',
			};
		case 404:
			return {
				message: 'Model not found',
				description: 'The model name may be wrong or unavailable in the selected region.',
			};
		case 429:
			return {
				message: 'Quota exceeded',
				description:
					'Vertex AI rate limit or quota was hit. Retry later or request more quota.',
			};
		case 400:
			return {
				message: 'Invalid request',
				description: 'Vertex AI rejected the request parameters.',
			};
		default:
			return null;
	}
}
