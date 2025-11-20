import React, { useState, useEffect } from 'react';
import AIChat from './components/AIChat';
import ChatSidebar from './components/ChatSidebar';
import GearCanvas from './components/GearCanvas';
import { GearSystemState, ChatSession, ChatList, ChatMessage } from './types';
import { INITIAL_GEAR_1, INITIAL_GEAR_2 } from './constants';
import { generateGearPath, downloadSVG } from './utils/gearMath';

const CHAT_SESSIONS_KEY = 'geargen-chat-sessions';
const OLD_CHAT_HISTORY_KEY = 'geargen-chat-history';
const MAX_CHATS = 50;

const DEFAULT_WELCOME_MESSAGE: ChatMessage = {
  role: 'model',
  text: `Yo! 👋 Willkommen bei GearGen Pro

Ich bin dein KI-Assistent für Zahnräder. Links hast du ein **blaues** Zahnrad, rechts ein **rotes** – die Farben sind fix, aber alles andere kannst du ändern.

**Was ich für dich tun kann:**
• "Gib mir die SVG vom blauen Zahnrad" → Download
• "Mach 20 Zähne" → Parameter ändern
• "Größeres Modul" → Easy done
• "Mach schneller" → Speed ändern
• Oder frag mich einfach irgendwas zu Zahnrädern

Schreib einfach, was du brauchst – kein Stress, kein Gelaber. Let's build! 🔧`
};

const App: React.FC = () => {
  const [state, setState] = useState<GearSystemState>({
    gear1: INITIAL_GEAR_1,
    gear2: INITIAL_GEAR_2,
    distance: 0,
    ratio: INITIAL_GEAR_2.toothCount / INITIAL_GEAR_1.toothCount,
    lockedRatio: true,
    speed: 10,
    isPlaying: true,
    rendererScale: 1, // 1 Kachel = 1 cm
    svgScale: 1,
    unit: 'cm'
  });

  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Initialize chat sessions - ALWAYS create a new chat on load
  const [chatList, setChatList] = useState<ChatList>(() => {
    let existingChats: ChatSession[] = [];

    try {
      // Load existing chats from localStorage
      const saved = localStorage.getItem(CHAT_SESSIONS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as ChatList;
        existingChats = parsed.chats;
      }

      // Check for old format and migrate
      const oldHistory = localStorage.getItem(OLD_CHAT_HISTORY_KEY);
      if (oldHistory) {
        const oldMessages = JSON.parse(oldHistory) as ChatMessage[];
        const migratedChat: ChatSession = {
          id: Date.now().toString(),
          name: 'Alter Chat',
          createdAt: Date.now(),
          lastMessageAt: Date.now(),
          messages: oldMessages
        };
        existingChats.push(migratedChat);
        localStorage.removeItem(OLD_CHAT_HISTORY_KEY);
      }
    } catch (e) {
      console.error('Failed to load chat sessions:', e);
    }

    // ALWAYS create a new chat on page load/refresh
    const newChat: ChatSession = {
      id: Date.now().toString(),
      name: 'Neuer Chat',
      createdAt: Date.now(),
      lastMessageAt: Date.now(),
      messages: [DEFAULT_WELCOME_MESSAGE]
    };

    // Add new chat to the beginning and limit total chats
    const allChats = [newChat, ...existingChats].slice(0, MAX_CHATS);

    return {
      currentChatId: newChat.id,
      chats: allChats
    };
  });

  // Save to localStorage whenever chatList changes
  useEffect(() => {
    try {
      localStorage.setItem(CHAT_SESSIONS_KEY, JSON.stringify(chatList));
    } catch (e) {
      console.error('Failed to save chat sessions:', e);
    }
  }, [chatList]);

  // Get current chat
  const currentChat = chatList.chats.find(c => c.id === chatList.currentChatId) || chatList.chats[0];

  const createNewChat = () => {
    const newChat: ChatSession = {
      id: Date.now().toString(),
      name: 'Neuer Chat',
      createdAt: Date.now(),
      lastMessageAt: Date.now(),
      messages: [DEFAULT_WELCOME_MESSAGE]
    };

    setChatList(prev => {
      let newChats = [newChat, ...prev.chats];

      // Limit to MAX_CHATS
      if (newChats.length > MAX_CHATS) {
        newChats = newChats.slice(0, MAX_CHATS);
      }

      return {
        currentChatId: newChat.id,
        chats: newChats
      };
    });
  };

  const switchChat = (id: string) => {
    setChatList(prev => ({
      ...prev,
      currentChatId: id
    }));
  };

  const deleteChat = (id: string) => {
    setChatList(prev => {
      const newChats = prev.chats.filter(c => c.id !== id);

      // If we deleted the current chat, switch to most recent
      let newCurrentId = prev.currentChatId;
      if (id === prev.currentChatId) {
        if (newChats.length === 0) {
          // Create a new chat if all were deleted
          const newChat: ChatSession = {
            id: Date.now().toString(),
            name: 'Neuer Chat',
            createdAt: Date.now(),
            lastMessageAt: Date.now(),
            messages: [DEFAULT_WELCOME_MESSAGE]
          };
          return {
            currentChatId: newChat.id,
            chats: [newChat]
          };
        }
        newCurrentId = newChats[0].id;
      }

      return {
        currentChatId: newCurrentId,
        chats: newChats
      };
    });
  };

  const updateChatName = (id: string, name: string) => {
    setChatList(prev => ({
      ...prev,
      chats: prev.chats.map(c =>
        c.id === id ? { ...c, name } : c
      )
    }));
  };

  const handleSendMessage = (text: string, role: 'user' | 'model' = 'user', isError: boolean = false) => {
    const message: ChatMessage = { role, text, isError };

    setChatList(prev => ({
      ...prev,
      chats: prev.chats.map(c =>
        c.id === prev.currentChatId
          ? {
            ...c,
            messages: [...c.messages, message],
            lastMessageAt: Date.now()
          }
          : c
      )
    }));
  };

  const handleDownload = (gearIdx: 1 | 2) => {
    const gear = gearIdx === 1 ? state.gear1 : state.gear2;
    const pathData = generateGearPath(gear);

    // Calculate the actual outer diameter in mm based on gear math
    // Outer Diameter = Module * ToothCount + 2 * Addendum
    // Addendum = Module * (1 + profileShift)
    const addendum = gear.module * (1 + gear.profileShift);
    const pitchDiameter = gear.module * gear.toothCount;
    const outerDiameterMm = pitchDiameter + (2 * addendum);

    // Apply SVG scale if needed
    const size = outerDiameterMm * state.svgScale;
    const offset = size / 2;

    // Calculate the scale factor to match path coordinates to viewBox
    // The path is generated in mm units based on module and tooth count
    const pathOuterRadius = pitchDiameter / 2 + addendum;
    const scaleToViewBox = (size / 2) / pathOuterRadius;

    const svgContent = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}mm" height="${size}mm">
  <!-- GearGen Pro Export -->
  <!-- Outer Diameter: ${outerDiameterMm.toFixed(2)}mm (${(outerDiameterMm / 10).toFixed(2)}cm) -->
  <!-- Role: ${gear.role}, Module: ${gear.module}mm, Teeth: ${gear.toothCount} -->
  <!-- Pressure Angle: ${gear.pressureAngle}°, Center Hole: ${gear.centerHoleDiameter}mm -->
  <!-- Ratio: ${state.ratio.toFixed(2)} (${state.gear2.toothCount}:${state.gear1.toothCount}) -->
  <path d="${pathData}" fill="none" stroke="black" stroke-width="0.5" transform="translate(${offset}, ${offset}) scale(${scaleToViewBox})"/>
</svg>`.trim();

    const gearName = gearIdx === 1 ? 'Blaues_Zahnrad' : 'Rotes_Zahnrad';
    downloadSVG(svgContent, `${gearName}.svg`);
  };

  return (
    <div className="flex flex-col md:flex-row min-h-screen w-full bg-slate-900 text-slate-100">
      <ChatSidebar
        open={sidebarOpen}
        chats={chatList.chats}
        currentChatId={chatList.currentChatId}
        onClose={() => setSidebarOpen(false)}
        onNewChat={createNewChat}
        onSwitchChat={switchChat}
        onDeleteChat={deleteChat}
      />
      <AIChat
        state={state}
        setState={setState}
        onDownload={handleDownload}
        messages={currentChat.messages}
        chatName={currentChat.name}
        onSendMessage={handleSendMessage}
        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        onChatNamed={(name) => updateChatName(currentChat.id, name)}
      />
      <GearCanvas state={state} id="gear-canvas-main" />
    </div>
  );
};

export default App;
