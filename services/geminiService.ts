import { GoogleGenAI } from "@google/genai";
import { SYSTEM_PROMPT } from '../constants';

const MODEL_ID = 'gemini-2.5-flash';
const MAX_LOG_LENGTH = 160;

const truncateForLog = (input: string) => {
  if (input.length <= MAX_LOG_LENGTH) return input;
  return `${input.slice(0, MAX_LOG_LENGTH)}…`;
};

export const sendMessageToGemini = async (message: string): Promise<string> => {
  if (!process.env.API_KEY) {
    console.error('[Gemini] API key missing before request dispatch.');
    throw new Error("API Key not configured");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const payload = {
    model: MODEL_ID,
    contents: message,
    config: {
      systemInstruction: SYSTEM_PROMPT,
    }
  } as const;

  console.debug('[Gemini] Dispatching generateContent request', {
    model: MODEL_ID,
    hasApiKey: true,
    promptPreview: truncateForLog(message),
    promptLength: message.length
  });

  const requestStartedAt = Date.now();

  try {
    const response = await ai.models.generateContent(payload);
    const durationMs = Date.now() - requestStartedAt;

    console.debug('[Gemini] Response received', {
      durationMs,
      hasText: Boolean(response.text),
      textPreview: response.text ? truncateForLog(response.text) : null,
      usage: (response as any)?.usageMetadata ?? null
    });

    return response.text || "No response generated.";
  } catch (error: any) {
    const durationMs = Date.now() - requestStartedAt;
    const status = error?.sdkHttpResponse?.status;
    const statusText = error?.sdkHttpResponse?.statusText;
    const requestId = error?.sdkHttpResponse?.headers?.['x-request-id'] ?? error?.sdkHttpResponse?.headers?.get?.('x-request-id');

    console.error('[Gemini] API Error', {
      durationMs,
      status,
      statusText,
      requestId: requestId || null,
      messageSnippet: truncateForLog(message),
      errorMessage: error?.message ?? 'Unknown error'
    }, error);

    throw error;
  }
};
