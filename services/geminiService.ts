import { GoogleGenAI, Type } from "@google/genai";
import { SYSTEM_PROMPT } from '../constants';
import { ChatMessage, GearSystemState } from '../types';

const MODEL_ID = 'gemini-2.5-flash';
const MAX_LOG_LENGTH = 160;
const DISABLE_THINKING_CONFIG = { thinkingBudget: 0 } as const;

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
        enum: ['download_svg', 'download_stl', 'update_params', 'set_speed', 'name_chat', 'respond']
      },
      gear: {
        type: Type.STRING,
        enum: ['blue', 'red', 'both'],
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
    required: ['action']
  }
};

// Generate compact status string for current state
const getStatusString = (state: GearSystemState): string => {
  return `**AKTUELLE WERTE:**
Blau: ${state.gear1.toothCount} Zähne, ${state.gear1.module}mm Modul, ${state.gear1.centerHoleDiameter}mm Bohrung
Rot: ${state.gear2.toothCount} Zähne, ${state.gear2.module}mm Modul, ${state.gear2.centerHoleDiameter}mm Bohrung
Übersetzung: ${state.ratio.toFixed(2)}, Geschwindigkeit: ${state.speed} U/min`;
};

// Streaming version - yields text chunks as they arrive
export async function* streamMessageToGemini(
  message: string,
  chatHistory: ChatMessage[] = [],
  currentState?: GearSystemState
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

  // Always add current state if provided (compact status as footer)
  const systemPrompt = currentState
    ? `${SYSTEM_PROMPT}\n\n${getStatusString(currentState)}`
    : SYSTEM_PROMPT;

  const payload = {
    model: MODEL_ID,
    contents: [
      ...history,
      { role: 'user' as const, parts: [{ text: message }] }
    ],
    config: {
      systemInstruction: systemPrompt,
      responseMimeType: 'application/json',
      responseSchema: ACTION_RESPONSE_SCHEMA,
      maxOutputTokens: 8192,
      // Explicitly disable thinking mode for gemini-2.5-flash (thinkingBudget > 0 would enable it)
      thinkingConfig: DISABLE_THINKING_CONFIG,
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
export const sendMessageToGemini = async (message: string, chatHistory: ChatMessage[] = [], currentState?: GearSystemState): Promise<string> => {
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

  // Always add current state if provided (compact status as footer)
  const systemPrompt = currentState
    ? `${SYSTEM_PROMPT}\n\n${getStatusString(currentState)}`
    : SYSTEM_PROMPT;

  const payload = {
    model: MODEL_ID,
    contents: [
      ...history,
      { role: 'user' as const, parts: [{ text: message }] }
    ],
    config: {
      systemInstruction: systemPrompt,
      responseMimeType: 'application/json',
      responseSchema: ACTION_RESPONSE_SCHEMA,
      maxOutputTokens: 8192,
      // Explicitly disable thinking mode for gemini-2.5-flash (thinkingBudget > 0 would enable it)
      thinkingConfig: DISABLE_THINKING_CONFIG,
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
