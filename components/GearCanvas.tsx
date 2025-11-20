import React, { useEffect, useRef, useMemo, useState } from 'react';
import { GearSystemState } from '../types';
import { generateGearPath, calculateCenterDistance } from '../utils/gearMath';
import { Maximize2, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

interface GearCanvasProps {
  state: GearSystemState;
  id: string;
}

const GearCanvas: React.FC<GearCanvasProps> = ({ state, id }) => {
  const requestRef = useRef<number | undefined>(undefined);
  const previousTimeRef = useRef<number | undefined>(undefined);
  const rotationRef = useRef({ r1: 0, r2: 0 }); // Mutable ref for smooth animation without re-render of geometry

  // View Transform State
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const [isDragging, setIsDragging] = useState(false);
  const lastMousePos = useRef({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const lastTouchDistance = useRef<number | null>(null);
  const lastTouchCenter = useRef<{ x: number; y: number } | null>(null);

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


  // Auto-zoom/pan logic (Initial View)
  // Calculate bounding box diameter
  const maxDiameter = (centerDist + (state.gear2.module * state.gear2.toothCount) / 2 + state.gear2.module * 2) * 2.5;
  // We use a fixed viewBox for the SVG and handle zoom via transform on a group
  const viewBoxSize = 1000;
  const viewBox = `${-viewBoxSize / 2} ${-viewBoxSize / 2} ${viewBoxSize} ${viewBoxSize}`;

  // Initial scale to fit content
  useEffect(() => {
    const initialScale = viewBoxSize / maxDiameter;
    setTransform({ x: 0, y: 0, scale: initialScale });
  }, [maxDiameter]);

  // --- Interaction Handlers ---

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();

      // Calculate Mouse Position in SVG Coordinates (relative to center)
      const rect = container.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      // Container center
      const cx = rect.width / 2;
      const cy = rect.height / 2;

      // Mouse offset from center in pixels
      const dxPixels = mouseX - cx;
      const dyPixels = mouseY - cy;

      // Convert to SVG units
      // viewBox is 1000x1000. preserveAspectRatio="xMidYMid meet"
      // The scale factor from SVG to Screen is min(width, height) / 1000
      // So SVG units per pixel is 1000 / min(width, height)
      const svgUnitsPerPixel = viewBoxSize / Math.min(rect.width, rect.height);

      const mouseX_SVG = dxPixels * svgUnitsPerPixel;
      const mouseY_SVG = dyPixels * svgUnitsPerPixel;

      const scaleFactor = 1.1;
      const direction = e.deltaY > 0 ? 1 / scaleFactor : scaleFactor;

      setTransform(prev => {
        const newScale = Math.max(0.1, Math.min(50, prev.scale * direction));

        // Formula: T_new = T_old + M_svg * (1/S_new - 1/S_old)
        // This keeps the world point P under the mouse stationary.
        // P = M_svg / S - T
        // M_svg = S_new * (P + T_new)
        // T_new = M_svg / S_new - P = M_svg / S_new - (M_svg / S_old - T_old)
        // T_new = T_old + M_svg * (1/S_new - 1/S_old)

        const newX = prev.x + mouseX_SVG * (1 / newScale - 1 / prev.scale);
        const newY = prev.y + mouseY_SVG * (1 / newScale - 1 / prev.scale);

        return {
          x: newX,
          y: newY,
          scale: newScale
        };
      });
    };

    // React's onWheel is passive by default, so we must attach manually to prevent default
    container.addEventListener('wheel', onWheel, { passive: false });

    return () => {
      container.removeEventListener('wheel', onWheel);
    };
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    lastMousePos.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;

    const dx = e.clientX - lastMousePos.current.x;
    const dy = e.clientY - lastMousePos.current.y;

    // Adjust pan speed by scale to keep it natural
    // The SVG viewBox is 1000 units wide.
    // The container width in pixels needs to be mapped to SVG units.
    const containerWidth = containerRef.current?.clientWidth || 1;
    const svgUnitsPerPixel = viewBoxSize / containerWidth;

    // When zoomed in (scale > 1), we need to move LESS SVG units per pixel to feel 1:1
    // Actually, the transform is applied inside the SVG.
    // If we move 10 pixels, and scale is 2, we want to move the content by 10 screen pixels.
    // In SVG space, that is (10 * svgUnitsPerPixel) / scale.

    setTransform(prev => ({
      ...prev,
      x: prev.x + (dx * svgUnitsPerPixel) / prev.scale,
      y: prev.y + (dy * svgUnitsPerPixel) / prev.scale
    }));

    lastMousePos.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Touch event handlers for mobile/tablet
  const getTouchDistance = (touch1: React.Touch, touch2: React.Touch) => {
    const dx = touch1.clientX - touch2.clientX;
    const dy = touch1.clientY - touch2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const getTouchCenter = (touch1: React.Touch, touch2: React.Touch) => {
    return {
      x: (touch1.clientX + touch2.clientX) / 2,
      y: (touch1.clientY + touch2.clientY) / 2
    };
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      // Single touch - pan
      setIsDragging(true);
      lastMousePos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    } else if (e.touches.length === 2) {
      // Two fingers - zoom
      e.preventDefault();
      const distance = getTouchDistance(e.touches[0], e.touches[1]);
      const center = getTouchCenter(e.touches[0], e.touches[1]);
      lastTouchDistance.current = distance;
      lastTouchCenter.current = center;
      setIsDragging(false);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 1 && isDragging) {
      // Single touch pan
      const dx = e.touches[0].clientX - lastMousePos.current.x;
      const dy = e.touches[0].clientY - lastMousePos.current.y;

      const containerWidth = containerRef.current?.clientWidth || 1;
      const svgUnitsPerPixel = viewBoxSize / containerWidth;

      setTransform(prev => ({
        ...prev,
        x: prev.x + (dx * svgUnitsPerPixel) / prev.scale,
        y: prev.y + (dy * svgUnitsPerPixel) / prev.scale
      }));

      lastMousePos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    } else if (e.touches.length === 2 && lastTouchDistance.current && lastTouchCenter.current) {
      // Pinch zoom
      e.preventDefault();
      const distance = getTouchDistance(e.touches[0], e.touches[1]);
      const center = getTouchCenter(e.touches[0], e.touches[1]);

      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;

      const cx = rect.width / 2;
      const cy = rect.height / 2;

      const dxPixels = center.x - rect.left - cx;
      const dyPixels = center.y - rect.top - cy;

      const svgUnitsPerPixel = viewBoxSize / Math.min(rect.width, rect.height);
      const centerX_SVG = dxPixels * svgUnitsPerPixel;
      const centerY_SVG = dyPixels * svgUnitsPerPixel;

      const scaleFactor = distance / lastTouchDistance.current;

      setTransform(prev => {
        const newScale = Math.max(0.1, Math.min(50, prev.scale * scaleFactor));
        const newX = prev.x + centerX_SVG * (1 / newScale - 1 / prev.scale);
        const newY = prev.y + centerY_SVG * (1 / newScale - 1 / prev.scale);

        return { x: newX, y: newY, scale: newScale };
      });

      lastTouchDistance.current = distance;
      lastTouchCenter.current = center;
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (e.touches.length < 2) {
      lastTouchDistance.current = null;
      lastTouchCenter.current = null;
    }
    if (e.touches.length === 0) {
      setIsDragging(false);
    }
  };

  const handleReset = () => {
    const initialScale = viewBoxSize / maxDiameter;
    setTransform({ x: 0, y: 0, scale: initialScale });
  };

  return (
    <div
      className="flex-1 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-800 to-slate-950 relative overflow-hidden flex items-center justify-center cursor-move touch-none min-h-[400px] md:min-h-screen"
      id={id}
      ref={containerRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{ touchAction: 'none' }}
    >

      {/* Grid / Background visual aids */}
      <div className="absolute inset-0 opacity-10 pointer-events-none"
        style={{ backgroundImage: 'radial-gradient(#cbd5e1 1px, transparent 1px)', backgroundSize: '20px 20px' }}>
      </div>

      <svg
        viewBox={viewBox}
        className="w-full h-full"
        preserveAspectRatio="xMidYMid meet"
      >
        <g transform={`scale(${transform.scale}) translate(${transform.x}, ${transform.y})`}>
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

          {/* Gear 1 Annotations */}
          <g transform={`translate(0, ${-maxDiameter / 2.5})`}>
            <text textAnchor="middle" fill="white" fontSize={maxDiameter / 35} className="font-mono opacity-80" fontWeight="bold">
              {state.gear1.role === 'antrieb' ? '⚙️ Antrieb' : '⚙️ Abtrieb'} (Blau)
            </text>
            <text textAnchor="middle" fill="white" fontSize={maxDiameter / 40} className="font-mono opacity-70" dy="1.2em">
              Ø: {state.gear1.outerDiameterCm}cm | R: {state.gear1.radiusCm}cm
            </text>
            <text textAnchor="middle" fill="white" fontSize={maxDiameter / 40} className="font-mono opacity-70" dy="2.4em">
              Bohrung: {state.gear1.centerHoleDiameter}mm | Zähne: {state.gear1.toothCount}
            </text>
          </g>

          {/* Gear 2 Annotations */}
          <g transform={`translate(${centerDist}, ${-maxDiameter / 2.5})`}>
            <text textAnchor="middle" fill="white" fontSize={maxDiameter / 35} className="font-mono opacity-80" fontWeight="bold">
              {state.gear2.role === 'antrieb' ? '⚙️ Antrieb' : '⚙️ Abtrieb'} (Rot)
            </text>
            <text textAnchor="middle" fill="white" fontSize={maxDiameter / 40} className="font-mono opacity-70" dy="1.2em">
              Ø: {state.gear2.outerDiameterCm}cm | R: {state.gear2.radiusCm}cm
            </text>
            <text textAnchor="middle" fill="white" fontSize={maxDiameter / 40} className="font-mono opacity-70" dy="2.4em">
              Bohrung: {state.gear2.centerHoleDiameter}mm | Zähne: {state.gear2.toothCount}
            </text>
          </g>

          {/* Center Info */}
          <g transform={`translate(${centerDist / 2}, ${maxDiameter / 3})`}>
            <text textAnchor="middle" fill="white" fontSize={maxDiameter / 30} className="font-mono opacity-70">
              Ratio: {state.ratio.toFixed(2)} ({state.gear2.toothCount}:{state.gear1.toothCount})
            </text>
            <text textAnchor="middle" fill="white" fontSize={maxDiameter / 35} className="font-mono opacity-60" dy="1.2em">
              Achsabstand: {centerDist.toFixed(2)}mm
            </text>
            <text textAnchor="middle" fill="white" fontSize={maxDiameter / 40} className="font-mono opacity-50" dy="2.4em">
              1 Kachel = {state.rendererScale} {state.unit}
            </text>
          </g>
        </g>
      </svg>

      {/* Controls Overlay */}
      <div className="absolute bottom-4 left-4 md:right-4 md:left-auto flex flex-col gap-2 items-start md:items-end pointer-events-none">
        <div className="flex gap-2 pointer-events-auto">
          <button onClick={() => setTransform(t => ({ ...t, scale: t.scale * 1.2 }))} className="bg-slate-800/90 active:bg-slate-700 p-3 md:p-2 rounded-lg text-white hover:bg-slate-700 transition-colors shadow-lg" title="Zoom In">
            <ZoomIn className="w-6 h-6 md:w-5 md:h-5" />
          </button>
          <button onClick={() => setTransform(t => ({ ...t, scale: t.scale / 1.2 }))} className="bg-slate-800/90 active:bg-slate-700 p-3 md:p-2 rounded-lg text-white hover:bg-slate-700 transition-colors shadow-lg" title="Zoom Out">
            <ZoomOut className="w-6 h-6 md:w-5 md:h-5" />
          </button>
          <button onClick={handleReset} className="bg-slate-800/90 active:bg-slate-700 p-3 md:p-2 rounded-lg text-white hover:bg-slate-700 transition-colors shadow-lg" title="Reset View">
            <RotateCcw className="w-6 h-6 md:w-5 md:h-5" />
          </button>
        </div>
        <div className="text-xs text-slate-400 bg-slate-900/90 px-3 py-2 md:px-2 md:py-1.5 rounded-lg shadow-lg">
          Zoom: {(transform.scale * 100).toFixed(0)}%
        </div>
      </div>
    </div>
  );
};

export default GearCanvas;