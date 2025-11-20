import React, { useState, useEffect } from 'react';
import { GearSystemState, ChatMessage } from '../types';
import { MessageSquare, Send, AlertCircle } from 'lucide-react';
import { sendMessageToGemini } from '../services/geminiService';
import { MarkdownText } from './MarkdownText';

interface AIChatProps {
    state: GearSystemState;
    setState: React.Dispatch<React.SetStateAction<GearSystemState>>;
    onDownload: (gearIndex: 1 | 2) => void;
}

const CHAT_HISTORY_KEY = 'geargen-chat-history';

const DEFAULT_WELCOME_MESSAGE: ChatMessage = {
    role: 'model',
    text: `Yo! 👋 Willkommen bei GearGen Pro

Ich bin dein KI-Assistent für Zahnräder. Links hast du ein **blaues** Zahnrad, rechts ein **rotes** – die Farben sind fix, aber alles andere kannst du ändern.

**Was ich für dich tun kann:**
• "Gib mir die SVG vom blauen Zahnrad" → Download
• "Mach 20 Zähne" → Parameter ändern
• "Größeres Modul" → Easy done
• "Start die Animation" → Let's go
• Oder frag mich einfach irgendwas zu Zahnrädern

Schreib einfach, was du brauchst – kein Stress, kein Gelaber. Let's build! 🔧`
};

const AIChat: React.FC<AIChatProps> = ({ state, setState, onDownload }) => {
    const [chatInput, setChatInput] = useState('');

    // Load chat history from localStorage or use default
    const [chatHistory, setChatHistory] = useState<ChatMessage[]>(() => {
        try {
            const saved = localStorage.getItem(CHAT_HISTORY_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                return parsed.length > 0 ? parsed : [DEFAULT_WELCOME_MESSAGE];
            }
        } catch (e) {
            console.error('Failed to load chat history:', e);
        }
        return [DEFAULT_WELCOME_MESSAGE];
    });

    const [isAiLoading, setIsAiLoading] = useState(false);
    const chatContainerRef = React.useRef<HTMLDivElement>(null);

    const handleAiSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!chatInput.trim()) return;

        const userMsg = chatInput;
        setChatInput('');
        setChatHistory(prev => [...prev, { role: 'user', text: userMsg }]);
        setIsAiLoading(true);

        try {
            const responseText = await sendMessageToGemini(userMsg, chatHistory);
            console.log("🤖 AI Raw Response:", responseText);

            // Try to find JSON in the response
            const jsonMatch = responseText.match(/\{[\s\S]*\}/);

            if (jsonMatch) {
                try {
                    console.log("🔍 Found JSON candidate:", jsonMatch[0]);
                    const command = JSON.parse(jsonMatch[0]);
                    console.log("✅ Parsed Command:", command);

                    // Handle download_svg action
                    if (command.action === 'download_svg' && command.gear) {
                        const gearIndex = command.gear === 'blue' ? 1 : 2;
                        onDownload(gearIndex);
                        setChatHistory(prev => [...prev, {
                            role: 'model',
                            text: command.message || `SVG-Datei für das ${command.gear === 'blue' ? 'blaue' : 'rote'} Zahnrad wird heruntergeladen...`
                        }]);
                    }
                    // Handle toggle_animation action
                    else if (command.action === 'toggle_animation' && command.playing !== undefined) {
                        setState(prev => ({ ...prev, isPlaying: command.playing }));
                        setChatHistory(prev => [...prev, {
                            role: 'model',
                            text: command.message || `Animation ${command.playing ? 'gestartet' : 'gestoppt'}.`
                        }]);
                    }
                    // Handle update_params action
                    else if (command.action === 'update_params' && command.params) {
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
                        console.log("⚠️ JSON found but action unknown or params missing");
                        setChatHistory(prev => [...prev, { role: 'model', text: responseText }]);
                    }
                } catch (e) {
                    console.error("❌ Failed to parse AI JSON:", e);
                    setChatHistory(prev => [...prev, { role: 'model', text: responseText }]);
                }
            } else {
                console.log("ℹ️ No JSON found in response");
                setChatHistory(prev => [...prev, { role: 'model', text: responseText }]);
            }

        } catch (error) {
            console.error("🔥 AI Service Error:", error);
            setChatHistory(prev => [...prev, { role: 'model', text: 'Fehler: Verbindung zur KI nicht möglich. Prüfen Sie den API-Schlüssel.', isError: true }]);
        } finally {
            setIsAiLoading(false);
        }
    };

    // Save chat history to localStorage whenever it changes
    useEffect(() => {
        try {
            localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(chatHistory));
        } catch (e) {
            console.error('Failed to save chat history:', e);
        }
    }, [chatHistory]);

    // Auto-scroll to bottom when chat history updates
    useEffect(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    }, [chatHistory, isAiLoading]);

    return (
        <div className="w-full md:w-1/2 bg-slate-800 flex flex-col shadow-xl border-r border-slate-700">
            {/* Header */}
            <div className="p-4 border-b border-slate-700 bg-slate-900">
                <h1 className="font-bold text-xl text-white flex items-center gap-2">
                    <MessageSquare className="w-5 h-5 text-brand-500" />
                    GearGen Pro - KI Assistant
                </h1>
            </div>

            {/* Chat Messages */}
            <div
                ref={chatContainerRef}
                className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-900/50"
                style={{ WebkitOverflowScrolling: 'touch' }}
            >
                {chatHistory.map((msg, idx) => (
                    <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[85%] rounded-lg p-3 text-sm ${msg.role === 'user'
                            ? 'bg-brand-600 text-white'
                            : msg.isError
                                ? 'bg-red-900/50 border border-red-700 text-red-200'
                                : 'bg-slate-700 text-slate-200'
                            }`}>
                            <MarkdownText text={msg.text} />
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

            {/* Input */}
            <div className="p-4 bg-slate-900 border-t border-slate-700">
                {process.env.API_KEY ? (
                    <form onSubmit={handleAiSubmit} className="flex gap-2">
                        <input
                            type="text"
                            value={chatInput}
                            onChange={(e) => setChatInput(e.target.value)}
                            placeholder="Frage nach Parametern, SVG-Downloads, oder starte die Animation..."
                            className="flex-1 bg-slate-800 border border-slate-600 rounded px-3 py-2 text-sm text-white focus:border-brand-500 outline-none"
                        />
                        <button
                            type="submit"
                            disabled={isAiLoading}
                            className="bg-brand-600 p-2 rounded text-white hover:bg-brand-500 disabled:opacity-50 active:bg-brand-700 transition-colors"
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
    );
};

export default AIChat;
