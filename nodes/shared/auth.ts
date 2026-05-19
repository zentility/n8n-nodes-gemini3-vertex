export interface GoogleApiCredential {
	email: string;
	privateKey: string;
	region: string;
}

export interface VertexAuth {
	email: string;
	privateKey: string;
	region: string;
}

export function buildAuth(credentials: GoogleApiCredential): VertexAuth {
	return {
		email: credentials.email.trim(),
		privateKey: credentials.privateKey.replace(/\\n/g, '\n'),
		region: credentials.region,
	};
}
