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

  // Check for undercut (simplified check)
  // If baseRadius > rootRadius, the involute starts above the root, need a straight flank or undercut logic.
  // For this visualizer, we clamp the start of involute to the larger of baseRadius or rootRadius.
  
  const numPoints = 15; // Resolution of the involute curve
  
  let path = "";

  // Generate one tooth profile
  for (let i = 0; i < toothCount; i++) {
    const angleOffset = (2 * Math.PI * i) / toothCount;
    
    // Calculate tooth thickness angle at pitch circle
    // Standard tooth thickness is pi * m / 2
    // Angular thickness = pi / (2 * N) + (2 * x * tan(alpha)) / N
    const invAlpha = Math.tan((pressureAngle * Math.PI) / 180) - (pressureAngle * Math.PI) / 180;
    const halfToothAngle = (Math.PI / (2 * toothCount)) + (2 * profileShift * Math.tan((pressureAngle * Math.PI) / 180)) / toothCount + invAlpha;

    // Draw the tooth
    // 1. Right side involute
    const rightFlankPoints: [number, number][] = [];
    
    // Start from root or base (whichever is larger) up to outer radius
    // We parametrize the involute by pressure angle at a specific radius
    // inv(alpha) = tan(alpha) - alpha
    // r = r_base / cos(alpha)
    
    // Let's iterate radius from max(root, base) to outer
    const startR = Math.max(baseRadius, rootRadius);
    
    for (let j = 0; j <= numPoints; j++) {
      const r = startR + ((outerRadius - startR) * j) / numPoints;
      
      // Calculate pressure angle at radius r
      // cos(alpha_r) = r_base / r
      const alphaR = Math.acos(Math.min(1, baseRadius / r));
      const invAlphaR = Math.tan(alphaR) - alphaR;
      
      // Theta relative to the tooth centerline
      const theta = halfToothAngle - (invAlphaR - invAlpha); // Wait, standard calc usually relative to center of tooth
      
      // Actual polar coord relative to gear center
      // We want the tooth to be centered at angleOffset
      // Let's say the tooth center is at angleOffset.
      // Right face is at angleOffset + theta ?? No.
      // Let's center the TOOTH at 0 first.
      
      // Right side: theta_point = theta_thickness_half - inv(alpha_r)
      // Actually simplified: 
      // Angle at base circle = invAlpha.
      // Angle at radius r = invAlphaR.
      // Angle of point = halfToothAngle - invAlphaR; (?) 
      
      // Let's stick to standard polar involute:
      // theta = tan(alpha) - alpha
      // We shift it so the pitch point intersects the pitch circle at the correct thickness.
      
      const angle = angleOffset + (halfToothAngle - invAlphaR);
      
      const x = r * Math.cos(angle);
      const y = r * Math.sin(angle);
      rightFlankPoints.push([x, y]);
    }
    
    // 2. Top Land (arc from right flank end to left flank end)
    // Left flank is mirror of right flank
    // We calculate left flank points by mirroring angle around angleOffset
    
    const leftFlankPoints: [number, number][] = [];
    for (let j = numPoints; j >= 0; j--) {
      const r = startR + ((outerRadius - startR) * j) / numPoints;
      const alphaR = Math.acos(Math.min(1, baseRadius / r));
      const invAlphaR = Math.tan(alphaR) - alphaR;
      
      const angle = angleOffset - (halfToothAngle - invAlphaR);
      
      const x = r * Math.cos(angle);
      const y = r * Math.sin(angle);
      leftFlankPoints.push([x, y]);
    }

    // Build path string for this tooth
    
    // Line from previous root to start of right flank
    if (i === 0) {
       path += `M ${rightFlankPoints[0][0]} ${rightFlankPoints[0][1]} `;
    } else {
       path += `L ${rightFlankPoints[0][0]} ${rightFlankPoints[0][1]} `;
    }

    // Right Flank
    rightFlankPoints.forEach(p => path += `L ${p[0]} ${p[1]} `);

    // Top Land (Straight line approximation is usually fine for small steps, but Arc is better)
    // For simplicity in this generator, simple line connect
    path += `L ${leftFlankPoints[0][0]} ${leftFlankPoints[0][1]} `;

    // Left Flank
    leftFlankPoints.forEach(p => path += `L ${p[0]} ${p[1]} `);
    
    // Root (Arc to next tooth)
    // Calculated implicitly by the loop start of next tooth
  }

  path += "Z"; // Close the gear shape

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
