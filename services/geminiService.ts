import { GoogleGenAI, Type, FunctionDeclaration, Tool } from "@google/genai";
import { SYSTEM_PROMPT } from '../constants';
import { ChatMessage, GearSystemState } from '../types';

const MODEL_ID = 'gemini-2.5-flash';
const MAX_LOG_LENGTH = 160;
const DISABLE_THINKING_CONFIG = { thinkingBudget: 0 } as const;

const truncateForLog = (input: string) => {
  if (input.length <= MAX_LOG_LENGTH) return input;
  return `${input.slice(0, MAX_LOG_LENGTH)}…`;
};

// --- Tool Definitions ---

const tools: Tool[] = [{
  functionDeclarations: [
    {
      name: "download_svg",
      description: "Trigger a download of the gear(s) as SVG for laser cutting.",
      parameters: {
        type: Type.OBJECT,
        properties: {
          gear: { type: Type.STRING, enum: ["blue", "red", "both"], description: "Which gear to download." }
        },
        required: ["gear"]
      }
    },
    {
      name: "download_stl",
      description: "Trigger a download of the gear(s) as STL for 3D printing.",
      parameters: {
        type: Type.OBJECT,
        properties: {
          gear: { type: Type.STRING, enum: ["blue", "red", "both"], description: "Which gear to download." }
        },
        required: ["gear"]
      }
    },
    {
      name: "update_params",
      description: "Update the parameters of the gears (teeth, module, hole).",
      parameters: {
        type: Type.OBJECT,
        properties: {
          gear1: {
            type: Type.OBJECT,
            properties: {
              toothCount: { type: Type.NUMBER },
              module: { type: Type.NUMBER },
              centerHoleDiameter: { type: Type.NUMBER }
            }
          },
          gear2: {
            type: Type.OBJECT,
            properties: {
              toothCount: { type: Type.NUMBER },
              module: { type: Type.NUMBER },
              centerHoleDiameter: { type: Type.NUMBER }
            }
          }
        }
      }
    },
    {
      name: "set_speed",
      description: "Set the animation speed.",
      parameters: {
        type: Type.OBJECT,
        properties: {
          speed: { type: Type.NUMBER, description: "Speed value (min 3)." }
        },
        required: ["speed"]
      }
    },
    {
      name: "name_chat",
      description: "Give the chat session a name.",
      parameters: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING, description: "Short name for the chat." }
        },
        required: ["name"]
      }
    },
    {
      name: "get_params",
      description: "Get the current technical parameters of the gears to display to the user.",
      parameters: {
        type: Type.OBJECT,
        properties: {}
      }
    }
  ]
}];

// Generate compact status string for current state
const getStatusString = (state: GearSystemState): string => {
  // Calculate derived metrics for context
  const getGearMetrics = (gear: typeof state.gear1) => {
    const pitchDiameter = gear.module * gear.toothCount;
    const addendum = gear.module * (1 + gear.profileShift);
    const outerDiameter = pitchDiameter + (2 * addendum);
    return { pitchDiameter, outerDiameter };
  };

  const g1 = getGearMetrics(state.gear1);
  const g2 = getGearMetrics(state.gear2);

  return `**AKTUELLE WERTE:**
Blau (Antrieb): ${state.gear1.toothCount} Zähne, ${state.gear1.module}mm Modul, ${state.gear1.centerHoleDiameter}mm Bohrung
  -> Außendurchmesser: ${g1.outerDiameter.toFixed(2)}mm, Teilkreis: ${g1.pitchDiameter.toFixed(2)}mm
Rot (Abtrieb): ${state.gear2.toothCount} Zähne, ${state.gear2.module}mm Modul, ${state.gear2.centerHoleDiameter}mm Bohrung
  -> Außendurchmesser: ${g2.outerDiameter.toFixed(2)}mm, Teilkreis: ${g2.pitchDiameter.toFixed(2)}mm
Übersetzung: ${state.ratio.toFixed(2)}, Geschwindigkeit: ${state.speed} U/min`;
};

// --- Streaming Service ---

export type ToolExecutors = {
  download_svg: (args: { gear: "blue" | "red" | "both" }) => void;
  download_stl: (args: { gear: "blue" | "red" | "both" }) => void;
  update_params: (args: { gear1?: any, gear2?: any }) => void;
  set_speed: (args: { speed: number }) => void;
  name_chat: (args: { name: string }) => void;
  get_params: () => string; // Returns the summary string
};

export async function* streamMessageToGemini(
  message: string,
  chatHistory: ChatMessage[] = [],
  currentState: GearSystemState,
  toolExecutors: ToolExecutors
): AsyncGenerator<string, void, unknown> {
  if (!process.env.API_KEY) {
    throw new Error("API Key not configured");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  // 1. Prepare History
  const history = chatHistory.slice(1).map(msg => ({
    role: msg.role === 'model' ? 'model' : 'user',
    parts: [{ text: msg.text }]
  }));

  // 2. Prepare System Prompt with Context
  const systemPrompt = `${SYSTEM_PROMPT}\n\n${getStatusString(currentState)}`;

  // 3. Initial Request
  // We use 'any' for parts to avoid strict type issues with the SDK's Part type during this migration
  let currentContents: any[] = [
    ...history,
    { role: 'user', parts: [{ text: message }] }
  ];

  const config = {
    systemInstruction: systemPrompt,
    tools: tools,
    thinkingConfig: DISABLE_THINKING_CONFIG,
  };

  console.debug('[Gemini] Starting stream loop', { message: truncateForLog(message) });

  while (true) {
    const stream = await ai.models.generateContentStream({
      model: MODEL_ID,
      contents: currentContents,
      config: config
    });

    let fullTextResponse = "";
    let functionCallPart: any = null;

    for await (const chunk of stream) {
      // 1. Yield Text immediately
      // chunk.text is a property, not a function in some versions, or a function in others.
      // The error said "Type 'String' has no call signatures", so it's a property.
      const text = chunk.text;
      if (text) {
        fullTextResponse += text;
        yield text;
      }

      // 2. Check for Function Calls
      // The error said "Type 'FunctionCall[]' has no call signatures", so it's a property.
      const calls = chunk.functionCalls;
      if (calls && calls.length > 0) {
        functionCallPart = calls[0];
        console.log("[Gemini] Tool Call Detected:", functionCallPart.name, functionCallPart.args);
      }
    }

    if (!functionCallPart) {
      break;
    }

    const { name, args } = functionCallPart;
    let result: any = { success: true };

    try {
      switch (name) {
        case 'download_svg':
          toolExecutors.download_svg(args as any);
          result = { output: "Download started." };
          break;
        case 'download_stl':
          toolExecutors.download_stl(args as any);
          result = { output: "Download started." };
          break;
        case 'update_params':
          toolExecutors.update_params(args as any);
          result = { output: "Parameters updated." };
          break;
        case 'set_speed':
          toolExecutors.set_speed(args as any);
          result = { output: `Speed set to ${args.speed}` };
          break;
        case 'name_chat':
          toolExecutors.name_chat(args as any);
          result = { output: `Chat named: ${args.name}` };
          break;
        case 'get_params':
          const paramsSummary = toolExecutors.get_params();
          result = { output: paramsSummary };
          break;
        default:
          console.warn("Unknown tool:", name);
          result = { error: "Unknown tool" };
      }
    } catch (e: any) {
      console.error("Tool execution failed:", e);
      result = { error: e.message };
    }

    // Append the model's tool call
    currentContents.push({
      role: 'model',
      parts: [
        { text: fullTextResponse },
        { functionCall: { name, args } }
      ]
    });

    // Append the tool response
    currentContents.push({
      role: 'user',
      parts: [{
        functionResponse: {
          name: name,
          response: { result: result }
        }
      }]
    });

    console.log("[Gemini] Tool Executed. Looping back with result...");
  }
}
