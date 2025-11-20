export interface GearParams {
  toothCount: number;
  module: number;
  pressureAngle: number; // in degrees
  centerHoleDiameter: number;
  profileShift: number;
  color: string;
}

export interface GearSystemState {
  gear1: GearParams;
  gear2: GearParams;
  distance: number; // Center distance
  ratio: number; // Gear ratio (z2 / z1)
  lockedRatio: boolean;
  speed: number; // RPM
  isPlaying: boolean;
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  isError?: boolean;
}
