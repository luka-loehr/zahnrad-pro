import React, { useEffect, useRef, useMemo } from 'react';
import { GearSystemState } from '../types';
import { generateGearPath, calculateCenterDistance } from '../utils/gearMath';

interface GearCanvasProps {
  state: GearSystemState;
  id: string;
}

const GearCanvas: React.FC<GearCanvasProps> = ({ state, id }) => {
  const requestRef = useRef<number | undefined>(undefined);
  const previousTimeRef = useRef<number | undefined>(undefined);
  const rotationRef = useRef({ r1: 0, r2: 0 }); // Mutable ref for smooth animation without re-render of geometry
  
  // References to SVG groups to manipulate transform directly for performance
  const g1Ref = useRef<SVGGElement>(null);
  const g2Ref = useRef<SVGGElement>(null);

  // 1. Memoize Geometry Generation
  // Only regenerate paths when physical parameters change, not during animation
  const gear1Path = useMemo(() => generateGearPath(state.gear1), [state.gear1]);
  const gear2Path = useMemo(() => generateGearPath(state.gear2), [state.gear2]);
  
  const centerDist = useMemo(() => calculateCenterDistance(state.gear1, state.gear2), [state.gear1, state.gear2]);
  
  // 2. Animation Loop
  const animate = (time: number) => {
    if (previousTimeRef.current !== undefined) {
      const deltaTime = (time - previousTimeRef.current) / 1000; // Seconds
      
      if (state.isPlaying) {
         // Rotational Velocity
         // RPM to degrees per second: RPM * 360 / 60 = RPM * 6
         const velocity1 = state.speed * 6;
         
         // Gear Ratio Relation: w1 * z1 = w2 * z2  => w2 = w1 * (z1/z2)
         // Direction: w2 is opposite to w1
         const ratio = state.gear1.toothCount / state.gear2.toothCount;
         const velocity2 = -(velocity1 * ratio);

         rotationRef.current.r1 += velocity1 * deltaTime;
         rotationRef.current.r2 += velocity2 * deltaTime;
         
         // Apply transforms directly to DOM nodes
         if (g1Ref.current) {
             g1Ref.current.setAttribute('transform', `rotate(${rotationRef.current.r1 % 360})`);
         }
         if (g2Ref.current) {
            // Gear 2 is offset by centerDist on X axis
            // To rotate it around its own center (centerDist, 0), we need:
            // translate(centerDist, 0) rotate(angle)
            // However, inside the group we usually place the path centered at 0,0 then move the group.
            // Let's handle the group positioning in the parent SVG, and rotation here.
            g2Ref.current.setAttribute('transform', `translate(${centerDist}, 0) rotate(${rotationRef.current.r2 % 360})`);
         }
      } else {
          // Even if not playing, we need to update position if centerDist changes
           if (g2Ref.current) {
              g2Ref.current.setAttribute('transform', `translate(${centerDist}, 0) rotate(${rotationRef.current.r2 % 360})`);
           }
           if (g1Ref.current) {
             g1Ref.current.setAttribute('transform', `rotate(${rotationRef.current.r1 % 360})`);
           }
      }
    }
    previousTimeRef.current = time;
    requestRef.current = requestAnimationFrame(animate);
  };

  useEffect(() => {
    requestRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(requestRef.current!);
  }, [state.isPlaying, state.speed, centerDist, state.gear1.toothCount, state.gear2.toothCount]); // Re-bind if structural params change

  // Mesh alignment adjustment
  // To mesh properly, one gear often needs a half-tooth rotation offset relative to the other depending on angle 0
  // Simple heuristic: Rotate Gear 2 by (180 / z2) degrees initially to align tooth with valley
  useEffect(() => {
     const initialOffset = 180 / state.gear2.toothCount;
     rotationRef.current.r2 = initialOffset;
     rotationRef.current.r1 = 0;
  }, [state.gear1.toothCount, state.gear2.toothCount]);


  // Auto-zoom/pan logic
  // Calculate bounding box diameter
  const maxDiameter = (centerDist + (state.gear2.module * state.gear2.toothCount) / 2 + state.gear2.module * 2) * 2.5;
  const viewBox = `${-maxDiameter/2} ${-maxDiameter/2} ${maxDiameter} ${maxDiameter}`;

  return (
    <div className="flex-1 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-800 to-slate-950 relative overflow-hidden flex items-center justify-center" id={id}>
        
        {/* Grid / Background visual aids */}
        <div className="absolute inset-0 opacity-10 pointer-events-none" 
             style={{backgroundImage: 'radial-gradient(#cbd5e1 1px, transparent 1px)', backgroundSize: '20px 20px'}}>
        </div>

        <svg 
            viewBox={viewBox} 
            className="w-full h-full max-w-[90vw] max-h-[90vh]"
            preserveAspectRatio="xMidYMid meet"
        >
            {/* Gear 1 */}
            <g ref={g1Ref}>
                <path 
                    d={gear1Path} 
                    fill={state.gear1.color} 
                    stroke="rgba(255,255,255,0.2)" 
                    strokeWidth={state.gear1.module * 0.1} 
                />
                {/* Decorator: Pitch Circle */}
                <circle r={(state.gear1.module * state.gear1.toothCount) / 2} fill="none" stroke="white" strokeOpacity="0.1" strokeDasharray="1 1" />
            </g>

            {/* Gear 2 */}
            <g ref={g2Ref}>
                <path 
                    d={gear2Path} 
                    fill={state.gear2.color} 
                    stroke="rgba(255,255,255,0.2)" 
                    strokeWidth={state.gear2.module * 0.1}
                />
                 <circle r={(state.gear2.module * state.gear2.toothCount) / 2} fill="none" stroke="white" strokeOpacity="0.1" strokeDasharray="1 1" />
            </g>

            {/* Annotations */}
             <g transform={`translate(${centerDist/2}, ${maxDiameter/3})`}>
                <text textAnchor="middle" fill="white" fontSize={maxDiameter/30} className="font-mono opacity-50">
                    Center Distance: {centerDist.toFixed(2)}mm
                </text>
             </g>
        </svg>
        
        <div className="absolute bottom-4 right-4 text-xs text-slate-500 bg-slate-900/80 p-2 rounded pointer-events-none">
            Real-time Render | SVG
        </div>
    </div>
  );
};

export default GearCanvas;