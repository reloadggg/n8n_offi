import { Ai302Adapter } from '../Ai302Adapter';
import { HumanMessage, AIMessage } from '@langchain/core/messages';

describe('Ai302Adapter', () => {
	let adapter: Ai302Adapter;

	beforeEach(() => {
		adapter = new Ai302Adapter({
			openAIApiKey: 'test-key',
			model: 'gpt-3.5-turbo',
			baseURL: 'https://api.302.ai/v1',
			temperature: 0.7,
		});
	});

	describe('convertMessageToOpenAIFormat', () => {
		it('should convert HumanMessage to OpenAI user format', () => {
			const message = new HumanMessage('Hello, how are you?');
			const result = (adapter as any).convertMessageToOpenAIFormat(message);

			expect(result).toEqual({
				role: 'user',
				content: 'Hello, how are you?',
			});
		});

		it('should convert AIMessage to OpenAI assistant format', () => {
			const message = new AIMessage('I am doing well, thank you!');
			const result = (adapter as any).convertMessageToOpenAIFormat(message);

			expect(result).toEqual({
				role: 'assistant',
				content: 'I am doing well, thank you!',
			});
		});
	});

	describe('adaptResponse', () => {
		it('should return standard OpenAI response with added required fields', () => {
			const standardResponse = {
				choices: [
					{
						index: 0,
						message: {
							role: 'assistant',
							content: 'Hello there!',
						},
						finish_reason: 'stop',
					},
				],
				usage: {
					prompt_tokens: 10,
					completion_tokens: 5,
					total_tokens: 15,
				},
			};

			const result = (adapter as any).adaptResponse(standardResponse);

			// 验证基本结构保持不变
			expect(result.choices).toEqual(standardResponse.choices);
			expect(result.usage).toEqual(standardResponse.usage);

			// 验证添加了必要的字段
			expect(result.id).toBeDefined();
			expect(result.object).toBe('chat.completion');
			expect(result.created).toBeDefined();
			expect(result.model).toBe('gpt-3.5-turbo');
		});

		it('should adapt 302AI data string format', () => {
			const ai302Response = {
				data: 'Hello from 302AI!',
				id: 'test-id',
				model: 'gpt-3.5-turbo',
			};

			const result = (adapter as any).adaptResponse(ai302Response);

			expect(result.choices).toHaveLength(1);
			expect(result.choices[0].message.content).toBe('Hello from 302AI!');
			expect(result.choices[0].message.role).toBe('assistant');
			expect(result.id).toBe('test-id');
			expect(result.model).toBe('gpt-3.5-turbo');
		});

		it('should adapt 302AI message object format', () => {
			const ai302Response = {
				message: {
					content: 'Hello from 302AI message!',
				},
				usage: {
					prompt_tokens: 8,
					completion_tokens: 6,
					total_tokens: 14,
				},
			};

			const result = (adapter as any).adaptResponse(ai302Response);

			expect(result.choices).toHaveLength(1);
			expect(result.choices[0].message.content).toBe('Hello from 302AI message!');
			expect(result.usage).toEqual(ai302Response.usage);
		});

		it('should adapt 302AI direct content format', () => {
			const ai302Response = {
				content: 'Direct content from 302AI!',
			};

			const result = (adapter as any).adaptResponse(ai302Response);

			expect(result.choices).toHaveLength(1);
			expect(result.choices[0].message.content).toBe('Direct content from 302AI!');
		});

		it('should adapt 302AI string response', () => {
			const ai302Response = 'Simple string response from 302AI!';

			const result = (adapter as any).adaptResponse(ai302Response);

			expect(result.choices).toHaveLength(1);
			expect(result.choices[0].message.content).toBe('Simple string response from 302AI!');
		});

		it('should handle unknown format gracefully', () => {
			const unknownResponse = {
				someField: 'some value',
				anotherField: 123,
			};

			const result = (adapter as any).adaptResponse(unknownResponse);

			expect(result.choices).toHaveLength(1);
			expect(result.choices[0].message.content).toBe('No content available');
		});
	});

	describe('shouldUseCustomAdapter', () => {
		it('should return true for JSON parse errors', () => {
			const error = new Error('Unexpected token in JSON');
			const result = (adapter as any).shouldUseCustomAdapter(error);
			expect(result).toBe(true);
		});

		it('should return true for format errors', () => {
			const error = new Error('Invalid format received');
			const result = (adapter as any).shouldUseCustomAdapter(error);
			expect(result).toBe(true);
		});

		it('should return true for HTTP 422 errors', () => {
			const error = { status: 422, message: 'Unprocessable Entity' };
			const result = (adapter as any).shouldUseCustomAdapter(error);
			expect(result).toBe(true);
		});

		it('should return true for HTTP 400 errors', () => {
			const error = { status: 400, message: 'Bad Request' };
			const result = (adapter as any).shouldUseCustomAdapter(error);
			expect(result).toBe(true);
		});

		it('should return false for unrelated errors', () => {
			const error = new Error('Network timeout');
			const result = (adapter as any).shouldUseCustomAdapter(error);
			expect(result).toBe(false);
		});
	});

	describe('convertToLangChainResult', () => {
		it('should convert OpenAI response to LangChain format', () => {
			const openAIResponse = {
				choices: [
					{
						index: 0,
						message: {
							role: 'assistant',
							content: 'Test response',
						},
						finish_reason: 'stop',
					},
				],
				usage: {
					prompt_tokens: 10,
					completion_tokens: 5,
					total_tokens: 15,
				},
				model: 'gpt-3.5-turbo',
			};

			const result = (adapter as any).convertToLangChainResult(openAIResponse);

			expect(result.generations).toHaveLength(1);
			expect(result.generations[0].text).toBe('Test response');
			expect(result.generations[0].message.content).toBe('Test response');
			expect(result.generations[0].generationInfo.finishReason).toBe('stop');
			expect(result.llmOutput.tokenUsage).toEqual(openAIResponse.usage);
			expect(result.llmOutput.model).toBe('gpt-3.5-turbo');
		});
	});
});
