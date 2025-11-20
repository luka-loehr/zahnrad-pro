export interface GearParams {
  toothCount: number;
  module: number;
  pressureAngle: number; // in degrees
  centerHoleDiameter: number; // in mm
  profileShift: number;
  color: string;
  role: 'antrieb' | 'abtrieb'; // Antrieb oder Abtrieb
}

export interface GearSystemState {
  gear1: GearParams;
  gear2: GearParams;
  distance: number; // Center distance
  ratio: number; // Gear ratio (z2 / z1)
  lockedRatio: boolean;
  speed: number; // RPM (animationSpeed)
  isPlaying: boolean;
  // Globale Parameter
  rendererScale: number; // Tile-Size / Renderer-Scale (1 Kachel = X cm)
  svgScale: number; // SVG-Skalierung
  unit: 'cm' | 'mm'; // Aktuelle Maßeinheit
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  isError?: boolean;
}

export interface ChatSession {
  id: string;           // Unique ID (timestamp-based)
  name: string;         // AI-generated or "Neuer Chat"
  createdAt: number;    // Timestamp
  lastMessageAt: number; // Timestamp
  messages: ChatMessage[];
}

export interface ChatList {
  currentChatId: string;
  chats: ChatSession[];
}
