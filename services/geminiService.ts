import { GoogleGenAI, Type } from "@google/genai";
import { SYSTEM_PROMPT } from '../constants';
import { ChatMessage, GearSystemState } from '../types';

const MODEL_ID = 'gemini-2.5-flash-lite';
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
    required: ['action', 'message']
  }
};

// Generate status string from current state
const getStatusString = (state: GearSystemState): string => {
  return `**AKTUELLE PARAMETER - DU HAST IMMER ZUGRIFF AUF ALLE WERTE:**

**GLOBALE PARAMETER:**
- **Animationsgeschwindigkeit:** ${state.speed} U/min
- **Renderer-Skalierung:** ${state.rendererScale} (1 Kachel = ${state.rendererScale} ${state.unit})
- **SVG-Skalierung:** ${state.svgScale}
- **Maßeinheit:** ${state.unit}

**BLAUES ZAHNRAD (links, gear1):**
- **Rolle:** ${state.gear1.role}
- **Zähnezahl:** ${state.gear1.toothCount}
- **Modul:** ${state.gear1.module} mm
- **Äußerer Durchmesser:** ${((state.gear1.module * state.gear1.toothCount + 2 * state.gear1.module * (1 + state.gear1.profileShift)) / 10).toFixed(2)} cm (berechnet aus Modul × Zähne)
- **Bohrungsdurchmesser:** ${state.gear1.centerHoleDiameter} mm
- **Farbe:** Blau

**ROTES ZAHNRAD (rechts, gear2):**
- **Rolle:** ${state.gear2.role}
- **Zähnezahl:** ${state.gear2.toothCount}
- **Modul:** ${state.gear2.module} mm
- **Äußerer Durchmesser:** ${((state.gear2.module * state.gear2.toothCount + 2 * state.gear2.module * (1 + state.gear2.profileShift)) / 10).toFixed(2)} cm (berechnet aus Modul × Zähne)
- **Bohrungsdurchmesser:** ${state.gear2.centerHoleDiameter} mm
- **Farbe:** Rot

**ÜBERSETZUNGSVERHÄLTNIS:**
- **Übersetzungsverhältnis:** ${state.ratio.toFixed(2)} (${state.gear2.toothCount}:${state.gear1.toothCount})
- **Achsabstand:** ${state.distance.toFixed(2)} mm

**WICHTIGE REGELN:**
- Durchmesser wird automatisch berechnet: Ø = Modul × Zähne + 2 × Addendum
- Bohrungsdurchmesser Standard: 5mm (falls nicht gesetzt)
- Übersetzungsverhältnis: Zähnezahl_rechts ÷ Zähnezahl_links`;
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

  // If this is the first user message (only welcome message exists) and state is provided, add status to system prompt
  const isFirstUserMessage = chatHistory.length === 1;
  const systemPrompt = isFirstUserMessage && currentState
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

  // If this is the first user message (only welcome message exists) and state is provided, add status to system prompt
  const isFirstUserMessage = chatHistory.length === 1;
  const systemPrompt = isFirstUserMessage && currentState
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
