import { OpenAI as LangChainOpenAI } from '@langchain/openai';
import type { ClientOptions } from '@langchain/openai';
import { ChatOpenAI } from '@langchain/openai';
import { CallbackManagerForLLMRun } from '@langchain/core/callbacks/manager';
import { BaseMessage, AIMessage, HumanMessage } from '@langchain/core/messages';
import { ChatResult, ChatGeneration } from '@langchain/core/outputs';
import { PromptValue } from '@langchain/core/prompt_values';
import { debugLog, errorLog } from './config';

/**
 * 302AI API响应格式适配器
 * 处理302AI API返回的格式与langchain OpenAI客户端期望格式之间的差异
 */
export class Ai302Adapter extends ChatOpenAI {
	private originalBaseURL: string;

	constructor(
		fields: ClientOptions & {
			openAIApiKey: string;
			model: string;
			baseURL?: string;
			[key: string]: any;
		},
	) {
		// 暂时使用标准OpenAI baseURL初始化
		const { baseURL, ...restFields } = fields;

		super({
			...restFields,
			openAIApiKey: fields.openAIApiKey,
			configuration: {
				...fields.configuration,
				baseURL: baseURL || 'https://api.302.ai/v1',
			},
		});

		this.originalBaseURL = baseURL || 'https://api.302.ai/v1';
	}

	/**
	 * 重写_generate方法来适配302AI的响应格式
	 */
	async _generate(
		messages: BaseMessage[],
		options: this['ParsedCallOptions'],
		runManager?: CallbackManagerForLLMRun,
	): Promise<ChatResult> {
		// 直接使用自定义适配器处理所有请求
		// 这样可以确保所有302AI响应都经过我们的格式验证
		return await this._generateWithCustomAdapter(messages, options, runManager);
	}

	/**
	 * 判断是否需要使用自定义适配器
	 */
	private shouldUseCustomAdapter(error: any): boolean {
		// 检查错误是否与格式不兼容相关
		const errorMessage = error.message?.toLowerCase() || '';
		return (
			errorMessage.includes('unexpected token') ||
			errorMessage.includes('json') ||
			errorMessage.includes('parse') ||
			errorMessage.includes('format') ||
			error.status === 422 ||
			error.status === 400
		);
	}

	/**
	 * 使用自定义适配器处理302AI响应
	 */
	private async _generateWithCustomAdapter(
		messages: BaseMessage[],
		options: this['ParsedCallOptions'],
		runManager?: CallbackManagerForLLMRun,
	): Promise<ChatResult> {
		const messageHistory = messages.map((msg) => this.convertMessageToOpenAIFormat(msg));

		const requestBody = {
			model: this.modelName,
			messages: messageHistory,
			temperature: this.temperature,
			max_tokens: this.maxTokens || undefined,
			stream: false,
			...options,
		};

		try {
			// 直接调用302AI API
			const response = await this.makeCustomRequest(requestBody);

			// 转换响应格式
			const adaptedResponse = this.adaptResponse(response);

			// 转换为langchain期望的格式
			return this.convertToLangChainResult(adaptedResponse);
		} catch (error: any) {
			errorLog('302AI Adapter Error:', error);
			throw new Error(`302AI API call failed: ${error.message}`);
		}
	}

	/**
	 * 转换BaseMessage为OpenAI格式
	 */
	private convertMessageToOpenAIFormat(message: BaseMessage): any {
		if (message instanceof HumanMessage) {
			return { role: 'user', content: message.content };
		} else if (message instanceof AIMessage) {
			return { role: 'assistant', content: message.content };
		} else {
			return { role: 'user', content: message.content };
		}
	}

	/**
	 * 直接调用302AI API
	 */
	private async makeCustomRequest(requestBody: any): Promise<any> {
		const fetch = (await import('node-fetch')).default;

		const response = await fetch(`${this.originalBaseURL}/chat/completions`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${this.openAIApiKey}`,
			},
			body: JSON.stringify(requestBody),
		});

		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(`HTTP ${response.status}: ${errorText}`);
		}

		return await response.json();
	}

	/**
	 * 适配302AI响应格式为标准OpenAI格式
	 */
	private adaptResponse(response: any): any {
		debugLog('302AI Original Response:', JSON.stringify(response, null, 2));

		// 确保响应是对象
		if (typeof response === 'string') {
			try {
				response = JSON.parse(response);
			} catch (e) {
				// 如果解析失败，作为纯文本处理
				return {
					id: `chatcmpl-${Date.now()}`,
					object: 'chat.completion',
					created: Math.floor(Date.now() / 1000),
					model: this.modelName,
					choices: [
						{
							index: 0,
							message: {
								role: 'assistant',
								content: response,
							},
							finish_reason: 'stop',
						},
					],
					usage: {
						prompt_tokens: 0,
						completion_tokens: 0,
						total_tokens: 0,
					},
				};
			}
		}

		// 验证和修复标准OpenAI格式
		if (response.choices && Array.isArray(response.choices)) {
			// 检查每个choice是否有正确的结构
			const validChoices = response.choices.map((choice: any, index: number) => {
				// 确保choice有正确的结构
				const validChoice = {
					index: choice.index !== undefined ? choice.index : index,
					finish_reason: choice.finish_reason || 'stop',
					message: null as any,
				};

				// 处理message字段
				if (choice.message && choice.message.content !== undefined) {
					validChoice.message = {
						role: choice.message.role || 'assistant',
						content: choice.message.content || '',
					};
				} else if (choice.text) {
					// 兼容text字段
					validChoice.message = {
						role: 'assistant',
						content: choice.text,
					};
				} else {
					// 如果没有消息内容，创建空消息
					validChoice.message = {
						role: 'assistant',
						content: '',
					};
				}

				return validChoice;
			});

			const adaptedResponse = {
				id: response.id || `chatcmpl-${Date.now()}`,
				object: response.object || 'chat.completion',
				created: response.created || Math.floor(Date.now() / 1000),
				model: response.model || this.modelName,
				choices: validChoices,
				usage: response.usage || {
					prompt_tokens: 0,
					completion_tokens: 0,
					total_tokens: 0,
				},
			};

			debugLog('302AI Adapted Response:', JSON.stringify(adaptedResponse, null, 2));
			return adaptedResponse;
		}

		// 适配其他格式
		let adaptedResponse = {
			id: response.id || `chatcmpl-${Date.now()}`,
			object: 'chat.completion',
			created: response.created || Math.floor(Date.now() / 1000),
			model: response.model || this.modelName,
			choices: [] as any[],
			usage: response.usage || {
				prompt_tokens: 0,
				completion_tokens: 0,
				total_tokens: 0,
			},
		};

		// 处理不同的响应格式
		if (response.data && typeof response.data === 'string') {
			// 302AI返回的是简单字符串格式
			adaptedResponse.choices = [
				{
					index: 0,
					message: {
						role: 'assistant',
						content: response.data,
					},
					finish_reason: 'stop',
				},
			];
		} else if (response.message && response.message.content) {
			// 302AI返回的是消息对象格式
			adaptedResponse.choices = [
				{
					index: 0,
					message: {
						role: 'assistant',
						content: response.message.content,
					},
					finish_reason: 'stop',
				},
			];
		} else if (response.content) {
			// 302AI返回的是直接内容格式
			adaptedResponse.choices = [
				{
					index: 0,
					message: {
						role: 'assistant',
						content: response.content,
					},
					finish_reason: 'stop',
				},
			];
		} else {
			// 尝试从其他可能的字段获取内容
			const content = response.text || response.output || response.result || 'No content available';
			adaptedResponse.choices = [
				{
					index: 0,
					message: {
						role: 'assistant',
						content: content,
					},
					finish_reason: 'stop',
				},
			];
		}

		debugLog('302AI Adapted Response:', JSON.stringify(adaptedResponse, null, 2));
		return adaptedResponse;
	}

	/**
	 * 转换为langchain期望的ChatResult格式
	 */
	private convertToLangChainResult(response: any): ChatResult {
		const generations: ChatGeneration[] = response.choices.map((choice: any) => ({
			text: choice.message.content,
			message: new AIMessage(choice.message.content),
			generationInfo: {
				finishReason: choice.finish_reason,
			},
		}));

		return {
			generations,
			llmOutput: {
				tokenUsage: response.usage,
				model: response.model,
			},
		};
	}
}
