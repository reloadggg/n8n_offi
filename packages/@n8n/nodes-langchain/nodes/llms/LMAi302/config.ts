/**
 * 302AI 适配器配置
 */
export const AI302_CONFIG = {
	// 是否启用调试日志
	DEBUG: process.env.NODE_ENV === 'development' || process.env.AI302_DEBUG === 'true',

	// 默认超时时间（毫秒）
	DEFAULT_TIMEOUT: 60000,

	// 默认重试次数
	DEFAULT_MAX_RETRIES: 2,

	// 支持的模型列表
	SUPPORTED_MODELS: [
		'gpt-4o-mini',
		'gpt-4o',
		'gpt-4',
		'gpt-3.5-turbo',
		'claude-3-sonnet-20240229',
		'claude-3-haiku-20240307',
		'claude-3-5-sonnet-20241022',
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
	],
};

/**
 * 调试日志工具
 */
export const debugLog = (message: string, data?: any) => {
	if (AI302_CONFIG.DEBUG) {
		console.log(`[302AI Debug] ${message}`, data ? JSON.stringify(data, null, 2) : '');
	}
};

/**
 * 错误日志工具
 */
export const errorLog = (message: string, error?: any) => {
	console.error(`[302AI Error] ${message}`, error);
};
