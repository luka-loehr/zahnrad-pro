import React, { useState } from 'react';
import AIChat from './components/AIChat';
import GearCanvas from './components/GearCanvas';
import { GearSystemState } from './types';
import { INITIAL_GEAR_1, INITIAL_GEAR_2 } from './constants';
import { generateGearPath, downloadSVG } from './utils/gearMath';

const App: React.FC = () => {
  const [state, setState] = useState<GearSystemState>({
    gear1: INITIAL_GEAR_1,
    gear2: INITIAL_GEAR_2,
    distance: 0, // Calculated in render
    ratio: INITIAL_GEAR_2.toothCount / INITIAL_GEAR_1.toothCount,
    lockedRatio: true,
    speed: 60,
    isPlaying: true
  });

  const handleDownload = (gearIdx: 1 | 2) => {
    const gear = gearIdx === 1 ? state.gear1 : state.gear2;
    const pathData = generateGearPath(gear);
    const size = (gear.module * gear.toothCount) + (4 * gear.module); // add margins
    const offset = size / 2;

    // Wrap in a clean standalone SVG for export
    const svgContent = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}mm" height="${size}mm">
  <!-- GearGen Pro Export -->
  <!-- Module: ${gear.module}, Teeth: ${gear.toothCount}, Pressure Angle: ${gear.pressureAngle} -->
  <path d="${pathData}" fill="none" stroke="black" stroke-width="1" transform="translate(${offset}, ${offset})"/>
</svg>`.trim();

    downloadSVG(svgContent, `gear-m${gear.module}-z${gear.toothCount}.svg`);
  };

  return (
    <div className="flex flex-col md:flex-row min-h-screen w-full bg-slate-900 text-slate-100">
      <AIChat
        state={state}
        setState={setState}
        onDownload={handleDownload}
      />
      <GearCanvas state={state} id="gear-canvas-main" />
    </div>
  );
};

export default App;
