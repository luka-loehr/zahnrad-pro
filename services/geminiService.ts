import { GoogleGenAI, Type } from "@google/genai";
import { SYSTEM_PROMPT } from '../constants';
import { ChatMessage } from '../types';

const MODEL_ID = 'gemini-2.5-flash';
const MAX_LOG_LENGTH = 160;

const truncateForLog = (input: string) => {
  if (input.length <= MAX_LOG_LENGTH) return input;
  return `${input.slice(0, MAX_LOG_LENGTH)}…`;
};

// Define the response schema for structured outputs
const ACTION_RESPONSE_SCHEMA = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      action: {
        type: Type.STRING,
        enum: ['download_svg', 'update_params', 'set_speed', 'name_chat', 'respond']
      },
      gear: {
        type: Type.STRING,
        enum: ['blue', 'red'],
        nullable: true
      },
      message: {
        type: Type.STRING
      },
      chatName: {
        type: Type.STRING,
        nullable: true
      },
      speed: {
        type: Type.NUMBER,
        nullable: true
      },
      params: {
        type: Type.OBJECT,
        nullable: true,
        properties: {
          gear1: {
            type: Type.OBJECT,
            nullable: true,
            properties: {
              toothCount: { type: Type.NUMBER, nullable: true },
              module: { type: Type.NUMBER, nullable: true },
              centerHoleDiameter: { type: Type.NUMBER, nullable: true }
            }
          },
          gear2: {
            type: Type.OBJECT,
            nullable: true,
            properties: {
              toothCount: { type: Type.NUMBER, nullable: true },
              module: { type: Type.NUMBER, nullable: true },
              centerHoleDiameter: { type: Type.NUMBER, nullable: true }
            }
          },
        }
      }
    },
    required: ['action', 'message']
  }
};

// Streaming version - yields text chunks as they arrive
export async function* streamMessageToGemini(
  message: string,
  chatHistory: ChatMessage[] = []
): AsyncGenerator<string, void, unknown> {
  if (!process.env.API_KEY) {
    console.error('[Gemini] API key missing before request dispatch.');
    throw new Error("API Key not configured");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  // Build conversation history for context
  // Skip the first message (welcome message) and format for Gemini
  const history = chatHistory.slice(1).map(msg => ({
    role: msg.role === 'model' ? 'model' : 'user',
    parts: [{ text: msg.text }]
  }));

  const payload = {
    model: MODEL_ID,
    contents: [
      ...history,
      { role: 'user' as const, parts: [{ text: message }] }
    ],
    config: {
      systemInstruction: SYSTEM_PROMPT,
      responseMimeType: 'application/json',
      responseSchema: ACTION_RESPONSE_SCHEMA,
    }
  };

  console.debug('[Gemini] Dispatching streaming request', {
    model: MODEL_ID,
    hasApiKey: true,
    promptPreview: truncateForLog(message),
    promptLength: message.length,
    historyLength: history.length
  });

  const requestStartedAt = Date.now();

  try {
    const stream = await ai.models.generateContentStream(payload);

    for await (const chunk of stream) {
      const chunkText = chunk.text;
      if (chunkText) {
        yield chunkText;
      }
    }

    const durationMs = Date.now() - requestStartedAt;
    console.debug('[Gemini] Stream completed', { durationMs });

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
}

// Non-streaming version (kept for backwards compatibility)
export const sendMessageToGemini = async (message: string, chatHistory: ChatMessage[] = []): Promise<string> => {
  if (!process.env.API_KEY) {
    console.error('[Gemini] API key missing before request dispatch.');
    throw new Error("API Key not configured");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  // Build conversation history for context
  // Skip the first message (welcome message) and format for Gemini
  const history = chatHistory.slice(1).map(msg => ({
    role: msg.role === 'model' ? 'model' : 'user',
    parts: [{ text: msg.text }]
  }));

  const payload = {
    model: MODEL_ID,
    contents: [
      ...history,
      { role: 'user' as const, parts: [{ text: message }] }
    ],
    config: {
      systemInstruction: SYSTEM_PROMPT,
      responseMimeType: 'application/json',
      responseSchema: ACTION_RESPONSE_SCHEMA,
    }
  };

  console.debug('[Gemini] Dispatching generateContent request', {
    model: MODEL_ID,
    hasApiKey: true,
    promptPreview: truncateForLog(message),
    promptLength: message.length,
    historyLength: history.length
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
