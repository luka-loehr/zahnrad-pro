import React, { useState, useEffect } from 'react';
import AIChat from './components/AIChat';
import ChatSidebar from './components/ChatSidebar';
import GearCanvas from './components/GearCanvas';
import { GearSystemState, ChatSession, ChatList, ChatMessage } from './types';
import { INITIAL_GEAR_1, INITIAL_GEAR_2 } from './constants';
import { generateGearPath, downloadSVG, calculateCenterDistance } from './utils/gearMath';

const CHAT_SESSIONS_KEY = 'geargen-chat-sessions';
const OLD_CHAT_HISTORY_KEY = 'geargen-chat-history';
const MAX_CHATS = 50;

const DEFAULT_WELCOME_MESSAGE: ChatMessage = {
  role: 'model',
  text: `Hey! 👋 Ich bin ZahnradPro, gebaut von Luka.

Sag mir einfach:

wie viele Zähne ein Zahnrad haben soll,

welches Übersetzungsverhältnis du brauchst,

welche Bohrung du willst,

oder frag mich irgendwas – ich erklär dir alles zu Zahnrädern und Formeln.

Und wenn alles passt: „Gib mir die SVG-Datei."

Leg los! 🚀`
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

    // Calculate the geometric outer diameter from the gear math
    // Outer Diameter = Module * ToothCount + 2 * Addendum
    const addendum = gear.module * (1 + gear.profileShift);
    const pitchDiameter = gear.module * gear.toothCount;
    const outerDiameterMm = pitchDiameter + (2 * addendum);

    // Apply SVG scale
    const size = outerDiameterMm * state.svgScale;
    const offset = size / 2;

    const svgContent = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}mm" height="${size}mm">
  <!-- ZahnradPro Export -->
  <!-- Outer Diameter: ${outerDiameterMm.toFixed(2)}mm (${(outerDiameterMm / 10).toFixed(2)}cm) -->
  <!-- Role: ${gear.role}, Module: ${gear.module}mm, Teeth: ${gear.toothCount} -->
  <!-- Pressure Angle: ${gear.pressureAngle}°, Center Hole: ${gear.centerHoleDiameter}mm -->
  <!-- Ratio: ${state.ratio.toFixed(2)} (${state.gear2.toothCount}:${state.gear1.toothCount}) -->
  <path d="${pathData}" fill="none" stroke="black" stroke-width="0.5" transform="translate(${offset}, ${offset})"/>
</svg>`.trim();

    const gearName = gearIdx === 1 ? 'Blaues_Zahnrad' : 'Rotes_Zahnrad';
    downloadSVG(svgContent, `${gearName}.svg`);
  };

  const handleDownloadBoth = () => {
    const gear1Path = generateGearPath(state.gear1);
    const gear2Path = generateGearPath(state.gear2);

    // Calculate geometric dimensions for both gears
    const addendum1 = state.gear1.module * (1 + state.gear1.profileShift);
    const pitchDiameter1 = state.gear1.module * state.gear1.toothCount;
    const diameter1Mm = pitchDiameter1 + (2 * addendum1);

    const addendum2 = state.gear2.module * (1 + state.gear2.profileShift);
    const pitchDiameter2 = state.gear2.module * state.gear2.toothCount;
    const diameter2Mm = pitchDiameter2 + (2 * addendum2);

    // For laser cutting: separate gears with a gap instead of meshing them
    const gapBetweenGears = 10; // mm gap for laser cutting
    const separationDistance = diameter1Mm / 2 + diameter2Mm / 2 + gapBetweenGears;

    // Calculate viewBox to fit both gears with padding
    const maxRadius = Math.max(diameter1Mm / 2, diameter2Mm / 2);
    const totalWidth = diameter1Mm + diameter2Mm + gapBetweenGears;
    const padding = 10; // mm padding around edges
    const viewBoxWidth = totalWidth + padding * 2;
    const viewBoxHeight = maxRadius * 2 + padding * 2;

    // Position gear1 at left and gear2 at right with gap between
    const gear1X = padding + diameter1Mm / 2;
    const gear1Y = viewBoxHeight / 2;
    const gear2X = gear1X + separationDistance;
    const gear2Y = viewBoxHeight / 2;

    const svgContent = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${viewBoxWidth} ${viewBoxHeight}" width="${viewBoxWidth}mm" height="${viewBoxHeight}mm">
  <!-- ZahnradPro Export - Both Gears (Separated for Laser Cutting) -->
  <!-- Blue Gear (Gear 1): ${(diameter1Mm / 10).toFixed(2)}cm, ${state.gear1.toothCount} teeth, ${state.gear1.role} -->
  <!-- Red Gear (Gear 2): ${(diameter2Mm / 10).toFixed(2)}cm, ${state.gear2.toothCount} teeth, ${state.gear2.role} -->
  <!-- Gap Between Gears: ${gapBetweenGears}mm (for laser cutting) -->
  <!-- Ratio: ${state.ratio.toFixed(2)} (${state.gear2.toothCount}:${state.gear1.toothCount}) -->
  <!-- Module: ${state.gear1.module}mm, Pressure Angle: ${state.gear1.pressureAngle}° -->
  
  <!-- Gear 1 (Blue, Left) -->
  <path d="${gear1Path}" fill="none" stroke="blue" stroke-width="0.5" transform="translate(${gear1X}, ${gear1Y})"/>
  
  <!-- Gear 2 (Red, Right) -->
  <path d="${gear2Path}" fill="none" stroke="red" stroke-width="0.5" transform="translate(${gear2X}, ${gear2Y})"/>
</svg>`.trim();

    downloadSVG(svgContent, 'Zahnrad_System_Beide.svg');
  };

  return (
    <div className="flex flex-col md:flex-row h-screen w-full bg-slate-900 text-slate-100 overflow-hidden">
      <ChatSidebar
        open={sidebarOpen}
        chats={chatList.chats}
        currentChatId={chatList.currentChatId}
        onClose={() => setSidebarOpen(false)}
        onSwitchChat={switchChat}
        onDeleteChat={deleteChat}
      />
      <AIChat
        state={state}
        setState={setState}
        onDownload={handleDownload}
        onDownloadBoth={handleDownloadBoth}
        messages={currentChat.messages}
        chatName={currentChat.name}
        onSendMessage={handleSendMessage}
        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        onChatNamed={(name) => updateChatName(currentChat.id, name)}
        onNewChat={createNewChat}
      />
      <GearCanvas state={state} id="gear-canvas-main" />
    </div>
  );
};

export default App;
