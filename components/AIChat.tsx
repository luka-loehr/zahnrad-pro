import React, { useState, useEffect } from 'react';
import { GearSystemState, ChatMessage } from '../types';
import { MessageSquare, Send, AlertCircle, Menu, Loader2 } from 'lucide-react';
import { streamMessageToGemini } from '../services/geminiService';
import { MarkdownText } from './MarkdownText';

interface AIChatProps {
    state: GearSystemState;
    setState: React.Dispatch<React.SetStateAction<GearSystemState>>;
    onDownload: (gearIndex: 1 | 2) => void;
    messages: ChatMessage[];
    chatName: string;
    onSendMessage: (message: string, role?: 'user' | 'model', isError?: boolean) => void;
    onToggleSidebar: () => void;
    onChatNamed: (name: string) => void;
}

const AIChat: React.FC<AIChatProps> = ({
    state,
    setState,
    onDownload,
    messages,
    chatName,
    onSendMessage,
    onToggleSidebar,
    onChatNamed
}) => {
    const [chatInput, setChatInput] = useState('');
    const [isAiLoading, setIsAiLoading] = useState(false);
    const [streamingMessage, setStreamingMessage] = useState('');
    const chatContainerRef = React.useRef<HTMLDivElement>(null);

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
            for await (const chunk of streamMessageToGemini(userMsg, messages)) {
                fullResponse += chunk;
                setStreamingMessage(fullResponse);
            }

            console.log("🤖 AI Full Response:", fullResponse);

            // Parse the structured JSON response (guaranteed to be valid)
            const commands = JSON.parse(fullResponse);
            console.log("✅ Parsed JSON:", commands);
            console.log(`📋 Processing ${commands.length} command(s)`);

            let messageToShow = '';

            // Process all commands
            for (const command of commands) {
                // Collect the message from the first command (message is now required)
                if (!messageToShow && command.message && command.message.trim()) {
                    messageToShow = command.message;
                }

                // Handle name_chat action
                if (command.action === 'name_chat' && command.chatName) {
                    onChatNamed(command.chatName);
                }
                // Handle download_svg action
                else if (command.action === 'download_svg' && command.gear) {
                    const gearIndex = command.gear === 'blue' ? 1 : 2;
                    onDownload(gearIndex);
                    console.log(`⬇️ Downloaded ${command.gear} gear`);
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

                        if (p.gear1) next.gear1 = { ...next.gear1, ...p.gear1 };
                        if (p.gear2) next.gear2 = { ...next.gear2, ...p.gear2 };

                        // Recalculate ratio if teeth changed
                        if (p.gear1?.toothCount || p.gear2?.toothCount) {
                            next.ratio = next.gear2.toothCount / next.gear1.toothCount;
                        }

                        return next;
                    });
                }
                // Handle respond action (pure conversational response)
                // No additional action needed, just the message
            }

            // Clear streaming message and show final message
            setStreamingMessage('');

            // Show message (required by schema, so always present)
            // Use first non-empty message, or first command's message if all are empty
            const finalMessage = messageToShow || (commands.length > 0 ? commands[0].message : '');
            if (finalMessage) {
                onSendMessage(finalMessage, 'model');
            }

        } catch (error) {
            console.error("🔥 AI Service Error:", error);
            setStreamingMessage('');
            onSendMessage('Fehler: Verbindung zur KI nicht möglich. Prüfen Sie den API-Schlüssel.', 'model', true);
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
        <div className="w-full md:w-1/2 bg-slate-800 flex flex-col shadow-xl border-r border-slate-700">
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
            </div>

            {/* Chat Messages */}
            <div
                ref={chatContainerRef}
                className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-900/50"
                style={{ WebkitOverflowScrolling: 'touch' }}
            >
                {messages.map((msg, idx) => (
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
                        <div className="bg-slate-700 rounded-lg p-3 text-sm text-slate-200">
                            {streamingMessage ? (
                                <MarkdownText text={streamingMessage} />
                            ) : (
                                <div className="flex items-center gap-2 text-slate-400 italic animate-slow-pulse">
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    <span>Denke nach...</span>
                                </div>
                            )}
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
