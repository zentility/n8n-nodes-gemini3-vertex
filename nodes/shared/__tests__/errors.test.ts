import { describeVertexError } from '../errors';

describe('describeVertexError', () => {
	it('maps 401 to an auth message', () => {
		expect(describeVertexError(401)?.message).toMatch(/authentication/i);
	});
	it('maps 403 to a permission message', () => {
		expect(describeVertexError(403)?.message).toMatch(/permission/i);
	});
	it('maps 404 to a model-not-found message', () => {
		expect(describeVertexError(404)?.message).toMatch(/not found/i);
	});
	it('maps 429 to a quota message', () => {
		expect(describeVertexError(429)?.message).toMatch(/quota/i);
	});
	it('returns null for unmapped statuses', () => {
		expect(describeVertexError(200)).toBeNull();
	});
});
