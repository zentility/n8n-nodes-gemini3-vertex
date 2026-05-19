import { BaseCallbackHandler } from '@langchain/core/callbacks/base';
import type { Serialized } from '@langchain/core/load/serializable';
import type { LLMResult } from '@langchain/core/outputs';
import {
	NodeConnectionTypes,
	NodeError,
	NodeOperationError,
	type IDataObject,
	type ISupplyDataFunctions,
	type JsonObject,
} from 'n8n-workflow';

interface RunDetail {
	index: number;
}

/**
 * LangChain callback handler that surfaces each LLM call's input and output in
 * the n8n execution view. Ported from n8n's own `N8nNonEstimatingTracing`
 * (packages/@n8n/nodes-langchain/nodes/llms/N8nNonEstimatingTracing.ts),
 * trimmed to drop the `@n8n/ai-utilities` telemetry and `lodash` dependencies.
 *
 * Without a handler like this, a Chat Model sub-node reports nothing to the
 * execution log — n8n only records sub-node I/O through this callback.
 *
 * Every n8n call is wrapped in try/catch: tracing is best-effort observability
 * and must never break the actual model call. If a future n8n version changes
 * the addInputData/addOutputData API, you lose the execution log for this node
 * — not the workflow run.
 */
export class N8nTracing extends BaseCallbackHandler {
	name = 'N8nTracing';

	// Makes LangChain await the handlers before continuing — required so
	// handleLLMError runs before the error propagates to the root node.
	awaitHandlers = true;

	connectionType = NodeConnectionTypes.AiLanguageModel;

	private parentRunIndex?: number;

	// Maps each LLM run ID to the input-data index returned by addInputData.
	private runsMap: Record<string, RunDetail> = {};

	constructor(private readonly executionFunctions: ISupplyDataFunctions) {
		super();
	}

	// Called by n8n when this model is a sub-node of another sub-node.
	setParentRunIndex(runIndex: number): void {
		this.parentRunIndex = runIndex;
	}

	async handleLLMStart(llm: Serialized, prompts: string[], runId: string): Promise<void> {
		try {
			const options = llm.type === 'constructor' ? llm.kwargs : llm;
			const { index } = this.executionFunctions.addInputData(this.connectionType, [
				[{ json: { messages: prompts, options } }],
			]);
			this.runsMap[runId] = { index };
		} catch {
			// Best-effort tracing — never let a logging failure break the model call.
		}
	}

	async handleLLMEnd(output: LLMResult, runId: string): Promise<void> {
		try {
			const runDetails = this.runsMap[runId] ?? { index: Object.keys(this.runsMap).length };

			const generations = output.generations.map((generation) =>
				generation.map((item) => ({
					text: item.text,
					generationInfo: item.generationInfo,
				})),
			);

			const sourceNodeRunIndex =
				this.parentRunIndex !== undefined ? this.parentRunIndex + runDetails.index : undefined;

			this.executionFunctions.addOutputData(
				this.connectionType,
				runDetails.index,
				[[{ json: { response: { generations } } }]],
				undefined,
				sourceNodeRunIndex,
			);
		} catch {
			// Best-effort tracing — never let a logging failure break the model call.
		}
	}

	async handleLLMError(error: IDataObject | Error, runId: string): Promise<void> {
		try {
			const runDetails = this.runsMap[runId] ?? { index: Object.keys(this.runsMap).length };

			// Drop non-`x-` headers so sensitive values are not logged.
			if (typeof error === 'object' && error?.hasOwnProperty('headers')) {
				const headers = (error as { headers: Record<string, unknown> }).headers;
				for (const key of Object.keys(headers)) {
					if (!key.startsWith('x-')) delete headers[key];
				}
			}

			if (error instanceof NodeError) {
				this.executionFunctions.addOutputData(this.connectionType, runDetails.index, error);
			} else {
				this.executionFunctions.addOutputData(
					this.connectionType,
					runDetails.index,
					new NodeOperationError(this.executionFunctions.getNode(), error as JsonObject, {
						functionality: 'configuration-node',
					}),
				);
			}
		} catch {
			// Best-effort tracing — never let a logging failure break the model call.
		}
	}
}
