import { NodeConnectionTypes } from 'n8n-workflow';

import { N8nTracing } from '../n8nTracing';

function mockCtx() {
	const addInputData = jest.fn().mockReturnValue({ index: 3 });
	const addOutputData = jest.fn();
	const getNode = jest.fn().mockReturnValue({ name: 'test-node' });
	return { addInputData, addOutputData, getNode };
}

describe('N8nTracing', () => {
	it('records the prompt via addInputData on LLM start', async () => {
		const ctx = mockCtx();
		const tracer = new N8nTracing(ctx as never);
		await tracer.handleLLMStart({ type: 'not_implemented' } as never, ['hello'], 'run-1');

		expect(ctx.addInputData).toHaveBeenCalledTimes(1);
		const [connectionType, data] = ctx.addInputData.mock.calls[0];
		expect(connectionType).toBe(NodeConnectionTypes.AiLanguageModel);
		expect(data).toEqual([[{ json: { messages: ['hello'], options: { type: 'not_implemented' } } }]]);
	});

	it('uses constructor kwargs as options when present', async () => {
		const ctx = mockCtx();
		const tracer = new N8nTracing(ctx as never);
		await tracer.handleLLMStart(
			{ type: 'constructor', kwargs: { model: 'gemini-3.1-flash' } } as never,
			['hi'],
			'run-1',
		);
		expect(ctx.addInputData.mock.calls[0][1][0][0].json.options).toEqual({
			model: 'gemini-3.1-flash',
		});
	});

	it('records the output via addOutputData keyed to the input index', async () => {
		const ctx = mockCtx();
		const tracer = new N8nTracing(ctx as never);
		await tracer.handleLLMStart({ type: 'not_implemented' } as never, ['hi'], 'run-1');
		await tracer.handleLLMEnd(
			{ generations: [[{ text: 'world', generationInfo: { finishReason: 'STOP' } }]] } as never,
			'run-1',
		);

		expect(ctx.addOutputData).toHaveBeenCalledTimes(1);
		const [connectionType, runIndex, data] = ctx.addOutputData.mock.calls[0];
		expect(connectionType).toBe(NodeConnectionTypes.AiLanguageModel);
		expect(runIndex).toBe(3);
		expect(data).toEqual([
			[{ json: { response: { generations: [[{ text: 'world', generationInfo: { finishReason: 'STOP' } }]] } } }],
		]);
	});

	it('reports an error via addOutputData on LLM error', async () => {
		const ctx = mockCtx();
		const tracer = new N8nTracing(ctx as never);
		await tracer.handleLLMError(new Error('boom'), 'run-x');
		expect(ctx.addOutputData).toHaveBeenCalledTimes(1);
		expect(ctx.addOutputData.mock.calls[0][0]).toBe(NodeConnectionTypes.AiLanguageModel);
	});

	it('swallows a failing addInputData — tracing must not break the model call', async () => {
		const ctx = mockCtx();
		ctx.addInputData.mockImplementation(() => {
			throw new Error('n8n API changed');
		});
		const tracer = new N8nTracing(ctx as never);
		await expect(
			tracer.handleLLMStart({ type: 'not_implemented' } as never, ['hi'], 'run-1'),
		).resolves.toBeUndefined();
	});

	it('swallows a failing addOutputData on both end and error paths', async () => {
		const ctx = mockCtx();
		ctx.addOutputData.mockImplementation(() => {
			throw new Error('n8n API changed');
		});
		const tracer = new N8nTracing(ctx as never);
		await expect(
			tracer.handleLLMEnd({ generations: [[{ text: 'x' }]] } as never, 'run-1'),
		).resolves.toBeUndefined();
		await expect(tracer.handleLLMError(new Error('boom'), 'run-1')).resolves.toBeUndefined();
	});
});
