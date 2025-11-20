import { GearParams } from '../types';

/**
 * Generates the SVG path data for an involute spur gear.
 */
export const generateGearPath = (gear: GearParams): string => {
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

  let path = "";

  // Calculate tooth thickness angle at base circle
  const invAlpha = Math.tan((pressureAngle * Math.PI) / 180) - (pressureAngle * Math.PI) / 180;
  const halfToothAngle = (Math.PI / (2 * toothCount)) + (2 * profileShift * Math.tan((pressureAngle * Math.PI) / 180)) / toothCount + invAlpha;

  for (let i = 0; i < toothCount; i++) {
    const angleOffset = (2 * Math.PI * i) / toothCount;

    // --- 1. Rising Flank (CW side of tooth, tracing CCW from root to tip) ---
    // Angle = angleOffset - (halfToothAngle - invAlphaR)
    // But below base circle, it's radial: Angle = angleOffset - halfToothAngle

    const risingPoints: [number, number][] = [];

    // Radial part (Root to Base)
    if (rootRadius < baseRadius) {
      const angle = angleOffset - halfToothAngle;
      risingPoints.push([rootRadius * Math.cos(angle), rootRadius * Math.sin(angle)]);
      risingPoints.push([baseRadius * Math.cos(angle), baseRadius * Math.sin(angle)]);
    } else {
      // Start at root (which is above base?) - unusual for standard gears but possible with shift
      // For standard logic, we start at max(root, base)
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
    // Angle = angleOffset + (halfToothAngle - invAlphaR)

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

    // --- Build Path ---

    // Move to start of first tooth
    if (i === 0) {
      path += `M ${risingPoints[0][0]} ${risingPoints[0][1]} `;
    } else {
      // Line from previous tooth end (root arc handled implicitly? No, we need explicit arc)
      // Actually, if we just draw lines between points, the "Root Arc" is the connection 
      // between the end of previous falling flank and start of current rising flank.
      // Let's draw the arc explicitly if we want it round.

      // Previous point was fallingPoints[last] of tooth i-1.
      // Current point is risingPoints[0] of tooth i.
      // They are both on rootRadius.
      // We can draw an Arc command.

      const start = risingPoints[0]; // Current tooth start
      // We are currently at the cursor position from previous iteration

      // A rx ry x-axis-rotation large-arc-flag sweep-flag x y
      path += `A ${rootRadius} ${rootRadius} 0 0 1 ${start[0]} ${start[1]} `;
    }

    // Draw Rising Flank
    risingPoints.forEach(p => path += `L ${p[0]} ${p[1]} `);

    // Draw Falling Flank
    fallingPoints.forEach(p => path += `L ${p[0]} ${p[1]} `);
  }

  // Close the loop (Root arc from last tooth to first tooth)
  const firstPointX = (rootRadius < baseRadius ? rootRadius : Math.max(baseRadius, rootRadius)) * Math.cos(-halfToothAngle); // Roughly
  // Better: retrieve the exact first point we moved to.
  // Since we can't easily store it in this string builder structure without refactor, 
  // let's just recalculate the first point of tooth 0.

  const angle0 = 0 - halfToothAngle;
  const r0 = rootRadius < baseRadius ? rootRadius : Math.max(baseRadius, rootRadius);
  // Wait, risingPoints[0] logic above:
  // if root < base: r=root, angle = -half
  // else: r=startR, angle = -half - (invAlphaR_at_startR - invAlpha) = -half (since invAlphaR=invAlpha at base)

  const p0x = r0 * Math.cos(angle0);
  const p0y = r0 * Math.sin(angle0);

  path += `A ${rootRadius} ${rootRadius} 0 0 1 ${p0x} ${p0y} `;

  path += "Z";

  // Create Center Hole (Counter-clockwise to create a hole in non-zero fill rule)
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
};
