import { buildAuth } from '../auth';

describe('buildAuth', () => {
	const creds = {
		email: '  svc@project.iam.gserviceaccount.com  ',
		privateKey: '-----BEGIN PRIVATE KEY-----\\nABC\\n-----END PRIVATE KEY-----',
		region: 'us-central1',
	};

	it('trims the email', () => {
		expect(buildAuth(creds).email).toBe('svc@project.iam.gserviceaccount.com');
	});

	it('converts escaped newlines in the private key to real newlines', () => {
		expect(buildAuth(creds).privateKey).toContain('\n');
		expect(buildAuth(creds).privateKey).not.toContain('\\n');
	});

	it('passes region through', () => {
		expect(buildAuth(creds).region).toBe('us-central1');
	});
});
