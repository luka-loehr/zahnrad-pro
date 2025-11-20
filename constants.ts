export const DEFAULT_MODULE = 5;
export const DEFAULT_PRESSURE_ANGLE = 20;

export const INITIAL_GEAR_1 = {
  toothCount: 12,
  module: DEFAULT_MODULE,
  pressureAngle: DEFAULT_PRESSURE_ANGLE,
  centerHoleDiameter: 10,
  profileShift: 0,
  color: '#0ea5e9' // Sky 500
};

export const INITIAL_GEAR_2 = {
  toothCount: 24,
  module: DEFAULT_MODULE,
  pressureAngle: DEFAULT_PRESSURE_ANGLE,
  centerHoleDiameter: 10,
  profileShift: 0,
  color: '#f43f5e' // Rose 500
};

export const SYSTEM_PROMPT = `You are an expert Mechanical Engineer specializing in gear design and transmission systems. 
User queries will likely be about gear ratios, modules for 3D printing, material selection, or troubleshooting meshing issues.
Keep answers concise, practical, and technical but accessible.
If asked about the tool, explain that 'Module' determines the size of the teeth and must be identical for gears to mesh.`;
