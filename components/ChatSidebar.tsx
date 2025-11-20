import React from 'react';
import { ChatSession } from '../types';
import { MessageSquare, Trash2, Plus, X } from 'lucide-react';

interface ChatSidebarProps {
    open: boolean;
    chats: ChatSession[];
    currentChatId: string;
    onClose: () => void;
    onNewChat: () => void;
    onSwitchChat: (id: string) => void;
    onDeleteChat: (id: string) => void;
}

const ChatSidebar: React.FC<ChatSidebarProps> = ({
    open,
    chats,
    currentChatId,
    onClose,
    onNewChat,
    onSwitchChat,
    onDeleteChat
}) => {
    const getRelativeTime = (timestamp: number): string => {
        const now = Date.now();
        const diff = now - timestamp;
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (minutes < 1) return 'gerade eben';
        if (minutes < 60) return `vor ${minutes} Min`;
        if (hours < 24) return `vor ${hours} Std`;
        if (days === 1) return 'Gestern';
        if (days < 7) return `vor ${days} Tagen`;
        return new Date(timestamp).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
    };

    const handleDelete = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (confirm('Chat wirklich löschen?')) {
            onDeleteChat(id);
        }
    };

    // Sort chats by lastMessageAt (newest first)
    const sortedChats = [...chats].sort((a, b) => b.lastMessageAt - a.lastMessageAt);

    return (
        <>
            {/* Backdrop */}
            {open && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 md:hidden"
                    onClick={onClose}
                />
            )}

            {/* Sidebar */}
            <div
                className={`fixed top-0 left-0 h-full bg-slate-900 border-r border-slate-700 z-50 transform transition-transform duration-200 ease-out ${open ? 'translate-x-0' : '-translate-x-full'
                    } w-full md:w-80 flex flex-col`}
            >
                {/* Header */}
                <div className="p-4 border-b border-slate-700 flex items-center justify-between">
                    <h2 className="font-bold text-lg text-white flex items-center gap-2">
                        <MessageSquare className="w-5 h-5 text-brand-500" />
                        Chat-Verlauf
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* New Chat Button */}
                <div className="p-4">
                    <button
                        onClick={() => {
                            onNewChat();
                            onClose();
                        }}
                        className="w-full flex items-center justify-center gap-2 p-3 bg-brand-600 hover:bg-brand-500 active:bg-brand-700 text-white rounded-lg font-medium transition-colors"
                    >
                        <Plus className="w-5 h-5" />
                        Neuer Chat
                    </button>
                </div>

                {/* Chat List */}
                <div className="flex-1 overflow-y-auto px-2" style={{ WebkitOverflowScrolling: 'touch' }}>
                    {sortedChats.length === 0 ? (
                        <div className="p-4 text-center text-slate-400 text-sm">
                            Noch keine Chats vorhanden
                        </div>
                    ) : (
                        <div className="space-y-1">
                            {sortedChats.map((chat) => (
                                <div
                                    key={chat.id}
                                    onClick={() => {
                                        onSwitchChat(chat.id);
                                        onClose();
                                    }}
                                    className={`group relative p-3 rounded-lg cursor-pointer transition-colors ${chat.id === currentChatId
                                            ? 'bg-slate-700 border-l-4 border-brand-500'
                                            : 'hover:bg-slate-800'
                                        }`}
                                >
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="flex-1 min-w-0">
                                            <div className="font-medium text-white text-sm truncate">
                                                {chat.name}
                                            </div>
                                            <div className="text-xs text-slate-400 mt-1">
                                                {getRelativeTime(chat.lastMessageAt)}
                                            </div>
                                        </div>
                                        <button
                                            onClick={(e) => handleDelete(e, chat.id)}
                                            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-slate-600 rounded text-red-400 hover:text-red-300"
                                            title="Chat löschen"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </>
    );
};

export default ChatSidebar;
