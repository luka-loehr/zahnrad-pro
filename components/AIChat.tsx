import React, { useState, useEffect } from 'react';
import { GearSystemState, ChatMessage } from '../types';
import { MessageSquare, Send, AlertCircle, Menu, Loader2, Plus } from 'lucide-react';
import { streamMessageToGemini } from '../services/geminiService';
import { MarkdownText } from './MarkdownText';

interface AIChatProps {
    state: GearSystemState;
    setState: React.Dispatch<React.SetStateAction<GearSystemState>>;
    onDownload: (gearIndex: 1 | 2) => void;
    onDownloadBoth: () => void;
    onDownloadSTL: (gearIndex: 1 | 2) => void;
    onDownloadBothSTL: () => void;
    messages: ChatMessage[];
    chatName: string;
    onSendMessage: (message: string, role?: 'user' | 'model', isError?: boolean) => void;
    onToggleSidebar: () => void;
    onChatNamed: (name: string) => void;
    onNewChat: () => void;
    width: number; // percentage
    onDragStart: () => void;
    isDragging: boolean;
}

const AIChat: React.FC<AIChatProps> = ({
    state,
    setState,
    onDownload,
    onDownloadBoth,
    onDownloadSTL,
    onDownloadBothSTL,
    messages,
    chatName,
    onSendMessage,
    onToggleSidebar,
    onChatNamed,
    onNewChat,
    width,
    onDragStart,
    isDragging
}) => {
    const [chatInput, setChatInput] = useState('');
    const [isAiLoading, setIsAiLoading] = useState(false);
    const [streamingMessage, setStreamingMessage] = useState('');
    const chatContainerRef = React.useRef<HTMLDivElement>(null);
    const inputRef = React.useRef<HTMLInputElement>(null);

    const handleAiSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!chatInput.trim() || isAiLoading) return;

        const userMsg = chatInput;
        setChatInput('');

        // Add user message through parent
        onSendMessage(userMsg);
        setIsAiLoading(true);
        setStreamingMessage('');

        try {
            let fullResponse = '';

            // Stream the response (now guaranteed to be valid JSON)
            // Pass state only on first user message (when only welcome message exists)
            const isFirstUserMessage = messages.length === 1;
            for await (const chunk of streamMessageToGemini(userMsg, messages, isFirstUserMessage ? state : undefined)) {
                fullResponse += chunk;
                setStreamingMessage(fullResponse);
            }

            console.log("🤖 AI Full Response:", fullResponse);

            // Parse the structured JSON response (guaranteed to be valid)
            const commands = JSON.parse(fullResponse);
            console.log("✅ Parsed JSON:", commands);
            console.log(`📋 Processing ${commands.length} command(s)`);

            // Clear streaming message before processing commands
            setStreamingMessage('');

            // Process all commands sequentially with delays
            for (const command of commands) {
                // 1. Show message if present
                if (command.message && command.message.trim()) {
                    onSendMessage(command.message, 'model');
                }

                // 2. Execute action
                // Handle name_chat action
                if (command.action === 'name_chat' && command.chatName) {
                    onChatNamed(command.chatName);
                }
                // Handle download_svg action
                else if (command.action === 'download_svg' && command.gear) {
                    if (command.gear === 'both') {
                        onDownloadBoth();
                        console.log('⬇️ Downloaded both gears together (SVG)');
                    } else {
                        const gearIndex = command.gear === 'blue' ? 1 : 2;
                        onDownload(gearIndex);
                        console.log(`⬇️ Downloaded ${command.gear} gear (SVG)`);
                    }
                }
                // Handle download_stl action
                else if (command.action === 'download_stl' && command.gear) {
                    if (command.gear === 'both') {
                        onDownloadBothSTL();
                        console.log('⬇️ Downloaded both gears together (STL)');
                    } else {
                        const gearIndex = command.gear === 'blue' ? 1 : 2;
                        onDownloadSTL(gearIndex);
                        console.log(`⬇️ Downloaded ${command.gear} gear (STL)`);
                    }
                }
                // Handle set_speed action
                else if (command.action === 'set_speed' && command.speed !== undefined) {
                    // Validate speed: minimum is 3
                    const validatedSpeed = Math.max(3, command.speed);
                    setState(prev => ({ ...prev, speed: validatedSpeed }));
                    console.log(`⚡ Speed set to ${validatedSpeed}`);
                }
                // Handle update_params action (only gear parameters, no speed)
                else if (command.action === 'update_params' && command.params) {
                    setState(prev => {
                        const next = { ...prev };
                        const p = command.params;

                        // Helper function to validate and update gear params
                        const updateGear = (gear: typeof next.gear1, updates: any) => {
                            if (!updates) return gear;

                            const updated = { ...gear, ...updates };

                            // Default centerHoleDiameter if not set
                            if (updates.centerHoleDiameter === undefined && !gear.centerHoleDiameter) {
                                updated.centerHoleDiameter = 5; // mm - smaller default for laser cutting
                            }

                            return updated;
                        };

                        if (p.gear1) next.gear1 = updateGear(next.gear1, p.gear1);
                        if (p.gear2) next.gear2 = updateGear(next.gear2, p.gear2);

                        // Recalculate ratio if teeth changed
                        if (p.gear1?.toothCount || p.gear2?.toothCount) {
                            next.ratio = next.gear2.toothCount / next.gear1.toothCount;
                        }

                        return next;
                    });
                }
                // Handle get_params action (Show technical summary)
                else if (command.action === 'get_params') {
                    // Calculate derived metrics
                    const getMetrics = (gear: typeof state.gear1) => {
                        const pitchDiameter = gear.module * gear.toothCount;
                        const addendum = gear.module * (1 + gear.profileShift);
                        const outerDiameter = pitchDiameter + (2 * addendum);
                        return { pitchDiameter, outerDiameter };
                    };

                    const g1 = getMetrics(state.gear1);
                    const g2 = getMetrics(state.gear2);

                    const summary = `**⚙️ Technische Daten:**

**Blaues Zahnrad (Antrieb):**
• Zähne: ${state.gear1.toothCount}
• Modul: ${state.gear1.module}mm
• Bohrung: ${state.gear1.centerHoleDiameter}mm
• Teilkreis-Ø: ${g1.pitchDiameter.toFixed(2)}mm
• Außen-Ø: ${g1.outerDiameter.toFixed(2)}mm

**Rotes Zahnrad (Abtrieb):**
• Zähne: ${state.gear2.toothCount}
• Modul: ${state.gear2.module}mm
• Bohrung: ${state.gear2.centerHoleDiameter}mm
• Teilkreis-Ø: ${g2.pitchDiameter.toFixed(2)}mm
• Außen-Ø: ${g2.outerDiameter.toFixed(2)}mm

**System:**
• Übersetzung: 1:${state.ratio.toFixed(2)}
• Achsabstand: ${((g1.pitchDiameter + g2.pitchDiameter) / 2).toFixed(2)}mm`;

                    onSendMessage(summary, 'model');
                }

                // 3. Wait a bit before next action to simulate "agent loop"
                // Only wait if there are more commands
                if (commands.indexOf(command) < commands.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 200));
                }
            }

        } catch (error) {
            console.error("🔥 AI Service Error:", error);
            setStreamingMessage('');
            onSendMessage('Es gab ein Problem, bitte warte einen Moment und versuche es dann noch einmal.', 'model', true);
        } finally {
            setIsAiLoading(false);
        }
    };

    // Auto-scroll to bottom when messages update or streaming
    useEffect(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    }, [messages, isAiLoading, streamingMessage]);

    return (
        <div
            className="relative bg-slate-800 flex flex-col shadow-xl border-r border-slate-700"
            style={{
                width: `${width}%`,
                minWidth: '25%',
                maxWidth: '55%'
            }}
        >
            {/* Draggable Divider */}
            <div
                className={`absolute top-0 right-0 w-1 h-full cursor-col-resize transition-all z-10 ${isDragging ? 'bg-brand-500' : 'bg-slate-700 hover:bg-brand-500'
                    }`}
                onMouseDown={onDragStart}
                onTouchStart={onDragStart}
            >
                {/* Wider invisible hit area for easier grabbing */}
                <div className="absolute inset-y-0 -left-2 -right-2" />
            </div>

            {/* Header */}
            <div className="p-4 border-b border-slate-700 bg-slate-900 flex items-center gap-3">
                <button
                    onClick={onToggleSidebar}
                    className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"
                    title="Chat-Verlauf öffnen"
                >
                    <Menu className="w-5 h-5" />
                </button>
                <div className="flex-1">
                    <h1 className="font-bold text-lg text-white flex items-center gap-2">
                        <MessageSquare className="w-5 h-5 text-brand-500" />
                        {chatName}
                    </h1>
                </div>
                <button
                    onClick={onNewChat}
                    className="px-3 py-2 bg-brand-600 hover:bg-brand-500 active:bg-brand-700 rounded-lg text-white font-medium transition-colors flex items-center gap-1.5"
                    title="Neuer Chat"
                >
                    <Plus className="w-4 h-4" />
                    <span className="text-sm">Neu</span>
                </button>
            </div>

            {/* Chat Messages */}
            <div
                ref={chatContainerRef}
                className="flex-1 overflow-y-auto p-4 bg-slate-900/50"
                style={{ WebkitOverflowScrolling: 'touch' }}
            >
                {messages.map((msg, idx) => {
                    const isSameAsPrev = idx > 0 && messages[idx - 1].role === msg.role;
                    // Check if next is same role OR if it's the last message and AI is loading (which counts as a 'model' message following it)
                    const isSameAsNext = (idx < messages.length - 1 && messages[idx + 1].role === msg.role) ||
                        (idx === messages.length - 1 && isAiLoading && msg.role === 'model');

                    // Dynamic spacing
                    // If it's the first message, no margin top.
                    // If same as prev, small margin.
                    // If different from prev, large margin.
                    const marginTop = idx === 0 ? '' : (isSameAsPrev ? 'mt-1' : 'mt-4');

                    // Dynamic border radius
                    let borderRadiusClass = 'rounded-2xl';
                    if (msg.role === 'user') {
                        // User messages (Right side)
                        if (isSameAsPrev && isSameAsNext) borderRadiusClass = 'rounded-2xl rounded-tr-sm rounded-br-sm';
                        else if (isSameAsPrev) borderRadiusClass = 'rounded-2xl rounded-tr-sm';
                        else if (isSameAsNext) borderRadiusClass = 'rounded-2xl rounded-br-sm';
                        else borderRadiusClass = 'rounded-2xl rounded-br-sm'; // Standalone user message usually has a "tail" or just round
                    } else {
                        // Model messages (Left side)
                        if (isSameAsPrev && isSameAsNext) borderRadiusClass = 'rounded-2xl rounded-tl-sm rounded-bl-sm';
                        else if (isSameAsPrev) borderRadiusClass = 'rounded-2xl rounded-tl-sm';
                        else if (isSameAsNext) borderRadiusClass = 'rounded-2xl rounded-bl-sm';
                        else borderRadiusClass = 'rounded-2xl rounded-bl-sm'; // Standalone model message
                    }

                    // Refined standalone look:
                    // If it's the start of a group, give it a normal corner.
                    // If it's the end of a group, give it a sharp corner (tail effect) or normal?
                    // Let's stick to the "spine" logic:
                    // User spine is RIGHT. Model spine is LEFT.
                    // If connected to PREV, flatten TOP spine corner.
                    // If connected to NEXT, flatten BOTTOM spine corner.

                    let roundedClass = 'rounded-2xl';
                    if (msg.role === 'user') {
                        roundedClass = `rounded-2xl ${isSameAsPrev ? 'rounded-tr-sm' : ''} ${isSameAsNext ? 'rounded-br-sm' : ''}`;
                    } else {
                        roundedClass = `rounded-2xl ${isSameAsPrev ? 'rounded-tl-sm' : ''} ${isSameAsNext ? 'rounded-bl-sm' : ''}`;
                    }

                    return (
                        <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} ${marginTop}`}>
                            <div className={`max-w-[85%] p-3 text-sm ${roundedClass} ${msg.role === 'user'
                                ? 'bg-brand-600 text-white'
                                : msg.isError
                                    ? 'bg-red-900/50 border border-red-700 text-red-200'
                                    : 'bg-slate-700 text-slate-200'
                                }`}>
                                <MarkdownText text={msg.text} />
                            </div>
                        </div>
                    );
                })}
                {isAiLoading && (
                    <div className={`flex justify-start ${messages.length > 0 && messages[messages.length - 1].role === 'model' ? 'mt-1' : 'mt-4'}`}>
                        <div className={`bg-slate-700 p-3 text-sm text-slate-200 rounded-2xl ${messages.length > 0 && messages[messages.length - 1].role === 'model' ? 'rounded-tl-sm' : ''
                            }`}>
                            {(() => {
                                const isToolExecution = streamingMessage && (
                                    streamingMessage.includes('update_params') ||
                                    streamingMessage.includes('download_') ||
                                    streamingMessage.includes('set_speed') ||
                                    streamingMessage.includes('get_params')
                                );

                                return isToolExecution ? (
                                    <div className="flex items-center gap-2 text-slate-400 italic animate-slow-pulse">
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        <span>Verarbeite Aktionen...</span>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2 text-slate-400 italic animate-slow-pulse">
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        <span>Denke nach...</span>
                                    </div>
                                );
                            })()}
                        </div>
                    </div>
                )}
            </div>

            {/* Input */}
            <div className="bg-slate-900 border-t border-slate-700">
                <div className="p-4">
                    {process.env.API_KEY ? (
                        <>
                            <form onSubmit={handleAiSubmit} className="flex gap-2">
                                <input
                                    ref={inputRef}
                                    type="text"
                                    value={chatInput}
                                    onChange={(e) => setChatInput(e.target.value)}
                                    onFocus={() => {
                                        // Scroll input into view when keyboard opens (mobile)
                                        setTimeout(() => {
                                            inputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                                        }, 300);
                                    }}
                                    placeholder="Frag mich alles..."
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
                            <p className="text-xs text-slate-500 mt-2 text-center">
                                Zahnrad Pro kann Fehler machen. Niemals persönliche Daten teilen.
                            </p>
                        </>
                    ) : (
                        <div className="flex items-center gap-2 text-yellow-500 text-xs p-2 bg-yellow-900/20 border border-yellow-900 rounded">
                            <AlertCircle className="w-4 h-4" />
                            <span>API KEY MISSING</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AIChat;
