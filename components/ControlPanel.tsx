import React, { useState } from 'react';
import { GearSystemState, GearParams, ChatMessage } from '../types';
import { Settings2, Play, Pause, Download, MessageSquare, Send, AlertCircle } from 'lucide-react';
import { sendMessageToGemini } from '../services/geminiService';

interface ControlPanelProps {
    state: GearSystemState;
    setState: React.Dispatch<React.SetStateAction<GearSystemState>>;
    onDownload: (gearIndex: 1 | 2) => void;
}

const ControlPanel: React.FC<ControlPanelProps> = ({ state, setState, onDownload }) => {
    const [activeTab, setActiveTab] = useState<'settings' | 'ai'>('settings');
    const [chatInput, setChatInput] = useState('');
    const [chatHistory, setChatHistory] = useState<ChatMessage[]>([
        { role: 'model', text: 'Hallo! Ich kann Ihnen bei Übersetzungsverhältnissen, Materialauswahl oder der Erklärung der Evolventengeometrie helfen.' }
    ]);
    const [isAiLoading, setIsAiLoading] = useState(false);

    const updateGear = (gearIdx: 1 | 2, field: keyof GearParams, value: any) => {
        setState(prev => {
            const gearKey = gearIdx === 1 ? 'gear1' : 'gear2';
            const newGear = { ...prev[gearKey], [field]: value };

            // If module changes, update both to keep them meshing
            if (field === 'module') {
                const otherGearKey = gearIdx === 1 ? 'gear2' : 'gear1';
                return {
                    ...prev,
                    gear1: { ...prev.gear1, module: value },
                    gear2: { ...prev.gear2, module: value }
                };
            }

            // If Locked Ratio is on and Tooth Count changes
            if (prev.lockedRatio && field === 'toothCount') {
                if (gearIdx === 1) {
                    // Update Gear 2 based on ratio
                    const newG2Teeth = Math.round(value * prev.ratio);
                    return {
                        ...prev,
                        gear1: newGear,
                        gear2: { ...prev.gear2, toothCount: newG2Teeth }
                    };
                } else {
                    // Update Ratio based on new Gear 2
                    const newRatio = value / prev.gear1.toothCount;
                    return {
                        ...prev,
                        gear2: newGear,
                        ratio: newRatio
                    };
                }
            }

            // Recalculate ratio if teeth changed without lock
            if (field === 'toothCount' && !prev.lockedRatio) {
                const g1 = gearIdx === 1 ? value : prev.gear1.toothCount;
                const g2 = gearIdx === 2 ? value : prev.gear2.toothCount;
                return {
                    ...prev,
                    [gearKey]: newGear,
                    ratio: g2 / g1
                }
            }

            return { ...prev, [gearKey]: newGear };
        });
    };

    const handleAiSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!chatInput.trim()) return;

        const userMsg = chatInput;
        setChatInput('');
        setChatHistory(prev => [...prev, { role: 'user', text: userMsg }]);
        setIsAiLoading(true);

        try {
            const responseText = await sendMessageToGemini(userMsg);
            console.log("🤖 AI Raw Response:", responseText); // DEBUG LOG

            // Try to find JSON in the response
            const jsonMatch = responseText.match(/\{[\s\S]*\}/);

            if (jsonMatch) {
                try {
                    console.log("🔍 Found JSON candidate:", jsonMatch[0]); // DEBUG LOG
                    const command = JSON.parse(jsonMatch[0]);
                    console.log("✅ Parsed Command:", command); // DEBUG LOG

                    if (command.action === 'update_params' && command.params) {
                        setState(prev => {
                            const next = { ...prev };
                            const p = command.params;

                            if (p.gear1) next.gear1 = { ...next.gear1, ...p.gear1 };
                            if (p.gear2) next.gear2 = { ...next.gear2, ...p.gear2 };
                            if (p.speed !== undefined) next.speed = p.speed;

                            // Recalculate ratio if teeth changed
                            if (p.gear1?.toothCount || p.gear2?.toothCount) {
                                next.ratio = next.gear2.toothCount / next.gear1.toothCount;
                            }

                            return next;
                        });

                        setChatHistory(prev => [...prev, { role: 'model', text: command.message || "Parameter aktualisiert." }]);
                    } else {
                        console.log("⚠️ JSON found but action unknown or params missing"); // DEBUG LOG
                        // JSON found but not an action we know, just show text
                        setChatHistory(prev => [...prev, { role: 'model', text: responseText }]);
                    }
                } catch (e) {
                    console.error("❌ Failed to parse AI JSON:", e); // DEBUG LOG
                    setChatHistory(prev => [...prev, { role: 'model', text: responseText }]);
                }
            } else {
                console.log("ℹ️ No JSON found in response"); // DEBUG LOG
                setChatHistory(prev => [...prev, { role: 'model', text: responseText }]);
            }

        } catch (error) {
            console.error("🔥 AI Service Error:", error); // DEBUG LOG
            setChatHistory(prev => [...prev, { role: 'model', text: 'Fehler: Verbindung zur KI nicht möglich. Prüfen Sie den API-Schlüssel.', isError: true }]);
        } finally {
            setIsAiLoading(false);
        }
    };

    return (
        <div className="w-full md:w-96 bg-slate-800 border-r border-slate-700 flex flex-col h-full overflow-hidden shadow-xl z-10">
            <div className="p-4 border-b border-slate-700 flex items-center justify-between bg-slate-900">
                <h1 className="font-bold text-xl text-white flex items-center gap-2">
                    <Settings2 className="w-5 h-5 text-brand-500" />
                    GearGen Pro
                </h1>
                <div className="flex gap-1 bg-slate-800 p-1 rounded-lg">
                    <button
                        onClick={() => setActiveTab('settings')}
                        className={`p-2 rounded-md transition-colors ${activeTab === 'settings' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}
                    >
                        <Settings2 className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => setActiveTab('ai')}
                        className={`p-2 rounded-md transition-colors ${activeTab === 'ai' ? 'bg-slate-700 text-brand-400' : 'text-slate-400 hover:text-white'}`}
                    >
                        <MessageSquare className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {activeTab === 'settings' ? (
                <div className="flex-1 overflow-y-auto p-4 space-y-6">
                    {/* Global Settings */}
                    <div className="space-y-3">
                        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Systemparameter</h3>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs text-slate-400 mb-1">Modul (mm)</label>
                                <input
                                    type="number" step="0.1"
                                    value={state.gear1.module}
                                    onChange={(e) => updateGear(1, 'module', parseFloat(e.target.value))}
                                    className="w-full bg-slate-700 border border-slate-600 rounded p-2 text-sm text-white focus:border-brand-500 outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-slate-400 mb-1">Eingriffswinkel (°)</label>
                                <input
                                    type="number"
                                    value={state.gear1.pressureAngle}
                                    onChange={(e) => {
                                        const val = parseFloat(e.target.value);
                                        updateGear(1, 'pressureAngle', val);
                                        updateGear(2, 'pressureAngle', val);
                                    }}
                                    className="w-full bg-slate-700 border border-slate-600 rounded p-2 text-sm text-white focus:border-brand-500 outline-none"
                                />
                            </div>
                        </div>

                        <div className="flex items-center justify-between bg-slate-700/50 p-2 rounded">
                            <span className="text-sm text-slate-300">Aktuelles Übersetzungsverhältnis</span>
                            <span className="font-mono text-brand-400 font-bold">1 : {state.ratio.toFixed(2)}</span>
                        </div>

                        <div className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                id="lockRatio"
                                checked={state.lockedRatio}
                                onChange={(e) => setState(s => ({ ...s, lockedRatio: e.target.checked }))}
                                className="rounded bg-slate-700 border-slate-600 text-brand-500 focus:ring-brand-500"
                            />
                            <label htmlFor="lockRatio" className="text-sm text-slate-300 cursor-pointer select-none">Verhältnis beim Ändern von Zahnrad 1 fixieren</label>
                        </div>
                    </div>

                    {/* Gear 1 Config */}
                    <div className="space-y-3 border-t border-slate-700 pt-4">
                        <div className="flex justify-between items-center">
                            <h3 className="text-xs font-semibold text-brand-500 uppercase tracking-wider">Antriebszahnrad (1)</h3>
                            <button onClick={() => onDownload(1)} className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-white" title="SVG herunterladen">
                                <Download className="w-4 h-4" />
                            </button>
                        </div>
                        <div>
                            <label className="block text-xs text-slate-400 mb-1">Zähnezahl: {state.gear1.toothCount}</label>
                            <input
                                type="range" min="4" max="100"
                                value={state.gear1.toothCount}
                                onChange={(e) => updateGear(1, 'toothCount', parseInt(e.target.value))}
                                className="w-full accent-brand-500"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="block text-xs text-slate-400 mb-1">Bohrung Ø (mm)</label>
                                <input
                                    type="number"
                                    value={state.gear1.centerHoleDiameter}
                                    onChange={(e) => updateGear(1, 'centerHoleDiameter', parseFloat(e.target.value))}
                                    className="w-full bg-slate-700 border border-slate-600 rounded p-1 text-sm text-white"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-slate-400 mb-1">Farbe</label>
                                <input
                                    type="color"
                                    value={state.gear1.color}
                                    onChange={(e) => updateGear(1, 'color', e.target.value)}
                                    className="w-full h-8 bg-transparent border-none cursor-pointer"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Gear 2 Config */}
                    <div className="space-y-3 border-t border-slate-700 pt-4">
                        <div className="flex justify-between items-center">
                            <h3 className="text-xs font-semibold text-rose-500 uppercase tracking-wider">Abtriebszahnrad (2)</h3>
                            <button onClick={() => onDownload(2)} className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-white" title="SVG herunterladen">
                                <Download className="w-4 h-4" />
                            </button>
                        </div>
                        <div>
                            <label className="block text-xs text-slate-400 mb-1">Zähnezahl: {state.gear2.toothCount}</label>
                            <input
                                type="range" min="4" max="100"
                                value={state.gear2.toothCount}
                                onChange={(e) => updateGear(2, 'toothCount', parseInt(e.target.value))}
                                className="w-full accent-rose-500"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="block text-xs text-slate-400 mb-1">Bohrung Ø (mm)</label>
                                <input
                                    type="number"
                                    value={state.gear2.centerHoleDiameter}
                                    onChange={(e) => updateGear(2, 'centerHoleDiameter', parseFloat(e.target.value))}
                                    className="w-full bg-slate-700 border border-slate-600 rounded p-1 text-sm text-white"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-slate-400 mb-1">Color</label>
                                <input
                                    type="color"
                                    value={state.gear2.color}
                                    onChange={(e) => updateGear(2, 'color', e.target.value)}
                                    className="w-full h-8 bg-transparent border-none cursor-pointer"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Animation */}
                    <div className="border-t border-slate-700 pt-4">
                        <button
                            onClick={() => setState(s => ({ ...s, isPlaying: !s.isPlaying }))}
                            className={`w-full flex items-center justify-center gap-2 p-3 rounded font-bold transition-colors ${state.isPlaying
                                ? 'bg-slate-700 text-red-400 hover:bg-slate-600'
                                : 'bg-brand-600 text-white hover:bg-brand-500'
                                }`}
                        >
                            {state.isPlaying ? <><Pause className="w-4 h-4" /> Simulation stoppen</> : <><Play className="w-4 h-4" /> Simulieren</>}
                        </button>
                        <div className="mt-4">
                            <label className="block text-xs text-slate-400 mb-1">Geschwindigkeit (U/min)</label>
                            <input
                                type="range" min="0" max="200"
                                value={state.speed}
                                onChange={(e) => setState(s => ({ ...s, speed: parseInt(e.target.value) }))}
                                className="w-full accent-slate-400"
                            />
                        </div>
                    </div>

                </div>
            ) : (
                <div className="flex-1 flex flex-col">
                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                        {chatHistory.map((msg, idx) => (
                            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[85%] rounded-lg p-3 text-sm ${msg.role === 'user'
                                    ? 'bg-brand-600 text-white'
                                    : msg.isError
                                        ? 'bg-red-900/50 border border-red-700 text-red-200'
                                        : 'bg-slate-700 text-slate-200'
                                    }`}>
                                    {msg.text}
                                </div>
                            </div>
                        ))}
                        {isAiLoading && (
                            <div className="flex justify-start">
                                <div className="bg-slate-700 rounded-lg p-3 text-sm text-slate-400 italic animate-pulse">
                                    Denke nach...
                                </div>
                            </div>
                        )}
                    </div>
                    <div className="p-4 bg-slate-900 border-t border-slate-700">
                        {process.env.API_KEY ? (
                            <form onSubmit={handleAiSubmit} className="flex gap-2">
                                <input
                                    type="text"
                                    value={chatInput}
                                    onChange={(e) => setChatInput(e.target.value)}
                                    placeholder="Fragen Sie nach Übersetzungsverhältnissen..."
                                    className="flex-1 bg-slate-800 border border-slate-600 rounded px-3 py-2 text-sm text-white focus:border-brand-500 outline-none"
                                />
                                <button
                                    type="submit"
                                    disabled={isAiLoading}
                                    className="bg-brand-600 p-2 rounded text-white hover:bg-brand-500 disabled:opacity-50"
                                >
                                    <Send className="w-4 h-4" />
                                </button>
                            </form>
                        ) : (
                            <div className="flex items-center gap-2 text-yellow-500 text-xs p-2 bg-yellow-900/20 border border-yellow-900 rounded">
                                <AlertCircle className="w-4 h-4" />
                                <span>API-Schlüssel fehlt in der Umgebungsvariable. Assistent deaktiviert.</span>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default ControlPanel;
