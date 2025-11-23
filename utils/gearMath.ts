import { GearParams } from '../types';

/**
 * Generates the SVG path data for an involute spur gear.
 */
export const generateGearPoints = (gear: GearParams): [number, number][] => {
  const { toothCount, module, pressureAngle, centerHoleDiameter, profileShift } = gear;

  // Basic Dimensions
  const pitchDiameter = module * toothCount;
  const pitchRadius = pitchDiameter / 2;

  const baseRadius = pitchRadius * Math.cos((pressureAngle * Math.PI) / 180);
  const addendum = module * (1 + profileShift);
  const dedendum = module * (1.25 - profileShift);

  const outerRadius = pitchRadius + addendum;
  const rootRadius = pitchRadius - dedendum;

  const numPoints = 15; // Resolution of the involute curve

  const points: [number, number][] = [];

  // Calculate tooth thickness angle at base circle
  const invAlpha = Math.tan((pressureAngle * Math.PI) / 180) - (pressureAngle * Math.PI) / 180;
  const halfToothAngle = (Math.PI / (2 * toothCount)) + (2 * profileShift * Math.tan((pressureAngle * Math.PI) / 180)) / toothCount + invAlpha;

  for (let i = 0; i < toothCount; i++) {
    const angleOffset = (2 * Math.PI * i) / toothCount;

    // --- 1. Rising Flank (CW side of tooth, tracing CCW from root to tip) ---
    const risingPoints: [number, number][] = [];

    // Radial part (Root to Base)
    if (rootRadius < baseRadius) {
      const angle = angleOffset - halfToothAngle;
      risingPoints.push([rootRadius * Math.cos(angle), rootRadius * Math.sin(angle)]);
      risingPoints.push([baseRadius * Math.cos(angle), baseRadius * Math.sin(angle)]);
    }

    // Involute part (Base to Tip)
    const startR = Math.max(baseRadius, rootRadius);
    for (let j = 0; j <= numPoints; j++) {
      const r = startR + ((outerRadius - startR) * j) / numPoints;
      const alphaR = Math.acos(Math.min(1, baseRadius / r));
      const invAlphaR = Math.tan(alphaR) - alphaR;

      const angle = angleOffset - (halfToothAngle - invAlphaR);
      risingPoints.push([r * Math.cos(angle), r * Math.sin(angle)]);
    }

    // --- 2. Falling Flank (CCW side of tooth, tracing CCW from tip to root) ---
    const fallingPoints: [number, number][] = [];

    // Involute part (Tip to Base)
    for (let j = numPoints; j >= 0; j--) {
      const r = startR + ((outerRadius - startR) * j) / numPoints;
      const alphaR = Math.acos(Math.min(1, baseRadius / r));
      const invAlphaR = Math.tan(alphaR) - alphaR;

      const angle = angleOffset + (halfToothAngle - invAlphaR);
      fallingPoints.push([r * Math.cos(angle), r * Math.sin(angle)]);
    }

    // Radial part (Base to Root)
    if (rootRadius < baseRadius) {
      const angle = angleOffset + halfToothAngle;
      fallingPoints.push([baseRadius * Math.cos(angle), baseRadius * Math.sin(angle)]);
      fallingPoints.push([rootRadius * Math.cos(angle), rootRadius * Math.sin(angle)]);
    }

    // Add points to main list
    points.push(...risingPoints);
    points.push(...fallingPoints);
  }

  return points;
};

/**
 * Generates the SVG path data for an involute spur gear.
 */
export const generateGearPath = (gear: GearParams): string => {
  const points = generateGearPoints(gear);
  const { rootRadius, baseRadius, toothCount, pressureAngle, profileShift, centerHoleDiameter } = {
    rootRadius: (gear.module * gear.toothCount) / 2 - gear.module * (1.25 - gear.profileShift),
    baseRadius: (gear.module * gear.toothCount) / 2 * Math.cos((gear.pressureAngle * Math.PI) / 180),
    toothCount: gear.toothCount,
    pressureAngle: gear.pressureAngle,
    profileShift: gear.profileShift,
    centerHoleDiameter: gear.centerHoleDiameter
  };

  // Re-calculate halfToothAngle for the root arc logic (needed for the A command)
  // Note: This is a bit redundant but keeps the path logic clean without passing too much extra data
  const invAlpha = Math.tan((pressureAngle * Math.PI) / 180) - (pressureAngle * Math.PI) / 180;
  const halfToothAngle = (Math.PI / (2 * toothCount)) + (2 * profileShift * Math.tan((pressureAngle * Math.PI) / 180)) / toothCount + invAlpha;

  let path = "";

  // We need to reconstruct the path with Arcs for the root
  // The points array contains all points on the gear profile (flanks)
  // We need to identify where one tooth ends and the next begins to draw the root arc

  // Each tooth has a certain number of points. 
  // Logic from before: 
  // Rising: 2 (radial) + 16 (involute) = 18? No, depends on if root < base.
  // Let's just iterate through points and insert Arcs where needed?
  // Or better: Re-implement the loop but use the pre-calculated points?
  // Actually, to keep it simple and robust, let's just use the points and draw lines, 
  // BUT for the root connection, we need the arc.

  // Let's stick to the original logic for SVG path generation to ensure visual consistency (especially the Arcs),
  // but use the shared math if possible. 
  // Since the original function mixed calculation and string building heavily, 
  // and we want to keep the exact visual output (Arcs), maybe we just keep generateGearPath as is 
  // but update it to use the same math constants?
  // OR: We can approximate the root arc with lines in the 3D model (STL doesn't support arcs anyway),
  // so generateGearPoints is perfect for STL.
  // For SVG, we can keep the "perfect" arc representation.

  // However, to avoid code duplication, let's try to use the points.
  // If we just use L commands for everything, the root will be a straight line instead of an arc.
  // For small modules, this is negligible. For large ones, it might be visible.
  // Let's keep the original implementation for SVG to ensure high quality, 
  // and use generateGearPoints for STL (where we have to tessellate anyway).

  // Wait, I replaced the whole file content. I need to put back the SVG logic or adapt it.
  // I will re-implement generateGearPath to be fully self-contained again (or call a shared helper for math),
  // but for now, I'll paste back the original logic for SVG and add the new logic for STL.

  // ... Actually, let's just copy the logic from the previous file content for generateGearPath 
  // and add the new functions.

  // RE-INSERTING ORIGINAL SVG LOGIC (slightly cleaned up)

  const { module } = gear;
  const pitchDiameter = module * toothCount;
  const pitchRadius = pitchDiameter / 2;
  // const baseRadius = ... (already calc above)
  const addendum = module * (1 + profileShift);
  const dedendum = module * (1.25 - profileShift);
  const outerRadius = pitchRadius + addendum;
  // const rootRadius = ... (already calc above)

  const numPoints = 15;

  path = "";

  for (let i = 0; i < toothCount; i++) {
    const angleOffset = (2 * Math.PI * i) / toothCount;

    // Re-calc points locally to ensure we have the exact structure for Arcs
    // (This is a bit of duplication but safest for preserving exact SVG behavior)

    const risingPoints: [number, number][] = [];
    if (rootRadius < baseRadius) {
      const angle = angleOffset - halfToothAngle;
      risingPoints.push([rootRadius * Math.cos(angle), rootRadius * Math.sin(angle)]);
      risingPoints.push([baseRadius * Math.cos(angle), baseRadius * Math.sin(angle)]);
    }

    const startR = Math.max(baseRadius, rootRadius);
    for (let j = 0; j <= numPoints; j++) {
      const r = startR + ((outerRadius - startR) * j) / numPoints;
      const alphaR = Math.acos(Math.min(1, baseRadius / r));
      const invAlphaR = Math.tan(alphaR) - alphaR;
      const angle = angleOffset - (halfToothAngle - invAlphaR);
      risingPoints.push([r * Math.cos(angle), r * Math.sin(angle)]);
    }

    const fallingPoints: [number, number][] = [];
    for (let j = numPoints; j >= 0; j--) {
      const r = startR + ((outerRadius - startR) * j) / numPoints;
      const alphaR = Math.acos(Math.min(1, baseRadius / r));
      const invAlphaR = Math.tan(alphaR) - alphaR;
      const angle = angleOffset + (halfToothAngle - invAlphaR);
      fallingPoints.push([r * Math.cos(angle), r * Math.sin(angle)]);
    }

    if (rootRadius < baseRadius) {
      const angle = angleOffset + halfToothAngle;
      fallingPoints.push([baseRadius * Math.cos(angle), baseRadius * Math.sin(angle)]);
      fallingPoints.push([rootRadius * Math.cos(angle), rootRadius * Math.sin(angle)]);
    }

    // Build Path
    if (i === 0) {
      path += `M ${risingPoints[0][0]} ${risingPoints[0][1]} `;
    } else {
      const start = risingPoints[0];
      path += `A ${rootRadius} ${rootRadius} 0 0 1 ${start[0]} ${start[1]} `;
    }

    risingPoints.forEach(p => path += `L ${p[0]} ${p[1]} `);
    fallingPoints.forEach(p => path += `L ${p[0]} ${p[1]} `);
  }

  // Close loop
  const angle0 = 0 - halfToothAngle;
  const r0 = rootRadius < baseRadius ? rootRadius : Math.max(baseRadius, rootRadius);
  const p0x = r0 * Math.cos(angle0);
  const p0y = r0 * Math.sin(angle0);
  path += `A ${rootRadius} ${rootRadius} 0 0 1 ${p0x} ${p0y} `;
  path += "Z";

  // Center Hole
  const rHole = centerHoleDiameter / 2;
  if (rHole > 0) {
    path += ` M ${rHole} 0`;
    path += ` A ${rHole} ${rHole} 0 1 0 ${-rHole} 0`;
    path += ` A ${rHole} ${rHole} 0 1 0 ${rHole} 0`;
    path += " Z";
  }

  return path;
};

export const calculateCenterDistance = (g1: GearParams, g2: GearParams): number => {
  const d1 = g1.module * g1.toothCount;
  const d2 = g2.module * g2.toothCount;
  return (d1 + d2) / 2;
};

export const downloadSVG = (svgContent: string, filename: string) => {
  const blob = new Blob([svgContent], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const generateSTL = (gear: GearParams, options: { thickness?: number, offsetX?: number, offsetY?: number } = {}): string => {
  const { thickness = 5, offsetX = 0, offsetY = 0 } = options;
  const points = generateGearPoints(gear);
  const holeRadius = gear.centerHoleDiameter / 2;

  // ASCII STL Header
  // We use a unique name based on role to allow concatenation of multiple solids
  const solidName = `gear_${gear.role}`;
  let stl = `solid ${solidName}\n`;

  // Helper to add a triangle
  const addTriangle = (v1: number[], v2: number[], v3: number[]) => {
    // Calculate normal
    const u = [v2[0] - v1[0], v2[1] - v1[1], v2[2] - v1[2]];
    const v = [v3[0] - v1[0], v3[1] - v1[1], v3[2] - v1[2]];
    const nx = u[1] * v[2] - u[2] * v[1];
    const ny = u[2] * v[0] - u[0] * v[2];
    const nz = u[0] * v[1] - u[1] * v[0];

    // Normalize (optional for some readers but good practice)
    const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
    const n = len > 0 ? [nx / len, ny / len, nz / len] : [0, 0, 0];

    stl += `facet normal ${n[0].toExponential()} ${n[1].toExponential()} ${n[2].toExponential()}\n`;
    stl += `  outer loop\n`;
    stl += `    vertex ${v1[0].toExponential()} ${v1[1].toExponential()} ${v1[2].toExponential()}\n`;
    stl += `    vertex ${v2[0].toExponential()} ${v2[1].toExponential()} ${v2[2].toExponential()}\n`;
    stl += `    vertex ${v3[0].toExponential()} ${v3[1].toExponential()} ${v3[2].toExponential()}\n`;
    stl += `  endloop\n`;
    stl += `endfacet\n`;
  };

  // 1. Top and Bottom Faces (Triangulation)
  // Simple fan triangulation from center (or hole edge) to perimeter
  // Note: This is a simplification. For a proper mesh with a hole, we need to bridge the hole and outer profile.
  // Since we have a hole, we can strip-triangulate between the hole circle and the gear profile.

  const holePoints = [];
  const segments = points.length; // Match resolution of gear profile roughly? 
  // Actually, generateGearPoints returns a lot of points. 
  // We should generate hole points with similar angular distribution or just fixed resolution.
  // For simplicity, let's generate a hole point for every gear point angle? 
  // No, gear points are not uniformly distributed in angle.

  // Better approach: Triangulate the polygon `points` with a hole `holeRadius`.
  // Since the gear is star-shaped-ish (convex-ish locally), we can try a simple center fan if no hole.
  // With hole: Connect outer point i to hole point i?
  // We need to project each outer point to the hole radius to get a matching inner point.

  const innerPoints: [number, number][] = [];
  for (const p of points) {
    const angle = Math.atan2(p[1], p[0]);
    innerPoints.push([holeRadius * Math.cos(angle) + offsetX, holeRadius * Math.sin(angle) + offsetY]);
  }

  // Apply offset to outer points
  const outerPoints: [number, number][] = points.map(p => [p[0] + offsetX, p[1] + offsetY]);

  const zTop = thickness;
  const zBottom = 0;

  for (let i = 0; i < outerPoints.length; i++) {
    const next = (i + 1) % outerPoints.length;

    const o1 = outerPoints[i];
    const o2 = outerPoints[next];
    const i1 = innerPoints[i];
    const i2 = innerPoints[next];

    // Top Face (CCW)
    // Quad: o1, o2, i2, i1
    // Tri 1: o1, o2, i1
    // Tri 2: o2, i2, i1
    addTriangle([o1[0], o1[1], zTop], [o2[0], o2[1], zTop], [i1[0], i1[1], zTop]);
    addTriangle([o2[0], o2[1], zTop], [i2[0], i2[1], zTop], [i1[0], i1[1], zTop]);

    // Bottom Face (CW - to point down)
    // Quad: o1, o2, i2, i1 (but viewed from bottom)
    // Normal should be down (0, 0, -1)
    // Order: o1, i1, o2 AND i1, i2, o2
    addTriangle([o1[0], o1[1], zBottom], [i1[0], i1[1], zBottom], [o2[0], o2[1], zBottom]);
    addTriangle([i1[0], i1[1], zBottom], [i2[0], i2[1], zBottom], [o2[0], o2[1], zBottom]);

    // Outer Walls
    // Quad: o1_bot, o2_bot, o2_top, o1_top
    // Tri 1: o1_bot, o2_bot, o1_top
    // Tri 2: o2_bot, o2_top, o1_top
    addTriangle([o1[0], o1[1], zBottom], [o2[0], o2[1], zBottom], [o1[0], o1[1], zTop]);
    addTriangle([o2[0], o2[1], zBottom], [o2[0], o2[1], zTop], [o1[0], o1[1], zTop]);

    // Inner Walls (Hole)
    // Quad: i1_bot, i2_bot, i2_top, i1_top (facing INWARD)
    // Normal points to center
    // Order: i1_bot, i1_top, i2_bot AND i2_bot, i1_top, i2_top
    addTriangle([i1[0], i1[1], zBottom], [i1[0], i1[1], zTop], [i2[0], i2[1], zBottom]);
    addTriangle([i2[0], i2[1], zBottom], [i1[0], i1[1], zTop], [i2[0], i2[1], zTop]);
  }

  stl += `endsolid ${solidName}\n`;
  return stl;
};

export const downloadSTL = (stlContent: string, filename: string) => {
  const blob = new Blob([stlContent], { type: 'model/stl' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

