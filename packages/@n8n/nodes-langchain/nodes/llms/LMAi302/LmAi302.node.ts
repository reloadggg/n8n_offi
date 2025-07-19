import { OpenAI, type ClientOptions } from '@langchain/openai';
import { NodeConnectionTypes } from 'n8n-workflow';
import type {
	INodeType,
	INodeTypeDescription,
	ISupplyDataFunctions,
	SupplyData,
	ILoadOptionsFunctions,
} from 'n8n-workflow';

import { getProxyAgent } from '@utils/httpProxyAgent';

import { makeN8nLlmFailedAttemptHandler } from '../n8nLlmFailedAttemptHandler';
import { N8nLlmTracing } from '../N8nLlmTracing';
import { Ai302Adapter } from './Ai302Adapter';

type LmAi302Options = {
	baseURL?: string;
	frequencyPenalty?: number;
	maxTokens?: number;
	presencePenalty?: number;
	temperature?: number;
	timeout?: number;
	maxRetries?: number;
	topP?: number;
};

export class LmAi302 implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'AI_302 Model',

		name: 'lmAi302',
		icon: 'file:ai302.svg',
		group: ['transform'],
		version: 1,
		description: 'Language Model for AI_302 API',
		defaults: {
			name: 'AI_302 Model',
		},
		codex: {
			categories: ['AI'],
			subcategories: {
				AI: ['Language Models', 'Root Nodes'],
				'Language Models': ['Text Completion Models'],
			},
			resources: {
				primaryDocumentation: [
					{
						url: 'https://302ai.apifox.cn/',
					},
				],
			},
		},

		inputs: [],

		outputs: [NodeConnectionTypes.AiLanguageModel],
		outputNames: ['Model'],
		credentials: [
			{
				name: 'ai302Api',
				required: true,
			},
		],
		requestDefaults: {
			ignoreHttpStatusErrors: true,
			baseURL: '={{ $parameter.options?.baseURL || "https://api.302.ai" }}',
		},
		properties: [
			{
				displayName: 'Model',
				name: 'model',
				type: 'resourceLocator',
				default: { mode: 'list', value: 'gpt-4o-mini' },
				required: true,
				description:
					'The model which will generate the completion. <a href="https://302ai.apifox.cn/">Learn more</a>.',
				modes: [
					{
						displayName: 'From List',
						name: 'list',
						type: 'list',
						typeOptions: {
							searchListMethod: 'ai302ModelSearch',
						},
					},
					{
						displayName: 'ID',
						name: 'id',
						type: 'string',
					},
				],
				routing: {
					send: {
						type: 'body',
						property: 'model',
						value: '={{$parameter.model.value}}',
					},
				},
			},
			{
				displayName: 'Options',
				name: 'options',
				placeholder: 'Add Option',
				description: 'Additional options to add',
				type: 'collection',
				default: {},
				options: [
					{
						displayName: 'Base URL',
						name: 'baseURL',
						default: 'https://api.302.ai/v1',
						description: 'Override the default base URL for the API',
						type: 'string',
					},
					{
						displayName: 'Frequency Penalty',
						name: 'frequencyPenalty',
						default: 0,
						typeOptions: { maxValue: 2, minValue: -2, numberPrecision: 1 },
						description:
							"Positive values penalize new tokens based on their existing frequency in the text so far, decreasing the model's likelihood to repeat the same line verbatim",
						type: 'number',
					},
					{
						displayName: 'Maximum Number of Tokens',
						name: 'maxTokens',
						default: -1,
						description:
							'The maximum number of tokens to generate in the completion. Most models have a context length of 2048 tokens (except for the newest models, which support 32,768).',
						type: 'number',
						typeOptions: {
							maxValue: 32768,
						},
					},
					{
						displayName: 'Presence Penalty',
						name: 'presencePenalty',
						default: 0,
						typeOptions: { maxValue: 2, minValue: -2, numberPrecision: 1 },
						description:
							"Positive values penalize new tokens based on whether they appear in the text so far, increasing the model's likelihood to talk about new topics",
						type: 'number',
					},
					{
						displayName: 'Sampling Temperature',
						name: 'temperature',
						default: 0.7,
						typeOptions: { maxValue: 1, minValue: 0, numberPrecision: 1 },
						description:
							'Controls randomness: Lowering results in less random completions. As the temperature approaches zero, the model will become deterministic and repetitive.',
						type: 'number',
					},
					{
						displayName: 'Timeout',
						name: 'timeout',
						default: 60000,
						description: 'Maximum amount of time a request is allowed to take in milliseconds',
						type: 'number',
					},
					{
						displayName: 'Max Retries',
						name: 'maxRetries',
						default: 2,
						description: 'Maximum number of retries to attempt',
						type: 'number',
					},
					{
						displayName: 'Top P',
						name: 'topP',
						default: 1,
						typeOptions: { maxValue: 1, minValue: 0, numberPrecision: 1 },
						description:
							'Controls diversity via nucleus sampling: 0.5 means half of all likelihood-weighted options are considered. We generally recommend altering this or temperature but not both.',
						type: 'number',
					},
				],
			},
		],
	};

	methods = {
		listSearch: {
			async ai302ModelSearch(this: ILoadOptionsFunctions) {
				const results = [];

				const options = this.getNodeParameter('options', {}) as LmAi302Options;

				let uri = 'https://api.302.ai/v1/models';

				if (options.baseURL) {
					uri = `${options.baseURL}/models`;
				}

				try {
					const { data } = (await this.helpers.requestWithAuthentication.call(this, 'ai302Api', {
						method: 'GET',
						uri,
						json: true,
					})) as { data: Array<{ owned_by: string; id: string }> };

					for (const model of data) {
						results.push({
							name: model.id,
							value: model.id,
						});
					}
				} catch (error) {
					// 如果API调用失败，返回一些常见的模型选项
					const commonModels = [
						'gpt-4o-mini',
						'gpt-4o',
						'gpt-4',
						'gpt-3.5-turbo',
						'claude-3-sonnet-20240229',
						'claude-3-haiku-20240307',
						'gemini-1.5-pro',
						'gemini-1.5-flash',
						'qwen-turbo',
						'qwen-plus',
						'qwen-max',
						'baichuan2-turbo',
						'chatglm3-6b',
						'deepseek-chat',
						'moonshot-v1-8k',
						'yi-34b-chat',
						'llama-3-8b-instruct',
						'llama-3-70b-instruct',
						'mistral-7b-instruct',
						'mixtral-8x7b-instruct',
					];

					for (const model of commonModels) {
						results.push({
							name: model,
							value: model,
						});
					}
				}

				return { results };
			},
		},
	};

	async supplyData(this: ISupplyDataFunctions, itemIndex: number): Promise<SupplyData> {
		const credentials = await this.getCredentials('ai302Api');

		const modelName = this.getNodeParameter('model', itemIndex, '', {
			extractValue: true,
		}) as string;

		const options = this.getNodeParameter('options', itemIndex, {}) as {
			baseURL?: string;
			frequencyPenalty?: number;
			maxTokens?: number;
			presencePenalty?: number;
			temperature?: number;
			timeout?: number;
			maxRetries?: number;
			topP?: number;
		};

		const configuration: ClientOptions = {
			fetchOptions: {
				dispatcher: getProxyAgent(options.baseURL ?? 'https://api.302.ai/v1'),
			},
		};

		if (options.baseURL) {
			configuration.baseURL = options.baseURL;
		} else {
			configuration.baseURL = 'https://api.302.ai/v1';
		}

		// 使用自定义适配器来处理302AI的响应格式
		const model = new Ai302Adapter({
			openAIApiKey: credentials.apiKey as string,
			model: modelName,
			baseURL: options.baseURL || 'https://api.302.ai/v1',
			frequencyPenalty: options.frequencyPenalty,
			maxTokens: options.maxTokens === -1 ? undefined : options.maxTokens,
			presencePenalty: options.presencePenalty,
			temperature: options.temperature,
			topP: options.topP,
			timeout: options.timeout ?? 60000,
			maxRetries: options.maxRetries ?? 2,
			callbacks: [new N8nLlmTracing(this)],
			onFailedAttempt: makeN8nLlmFailedAttemptHandler(this),
			configuration,
		});

		return {
			response: model,
		};
	}
}
