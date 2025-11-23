import React, { useState, useEffect } from 'react';
import { MarkdownText } from './MarkdownText';

interface TypewriterTextProps {
    text: string;
    speed?: number;
    onComplete?: () => void;
}

export const TypewriterText: React.FC<TypewriterTextProps> = ({
    text,
    speed = 2, // ms per character - extremely fast
    onComplete
}) => {
    const [displayedText, setDisplayedText] = useState('');

    useEffect(() => {
        // Reset if text changes significantly (though usually we just append)
        // Actually for chat, we want to animate from scratch if it's a new message component
        // But if we switch chats, we might not want animation.
        // For now, let's just animate on mount.

        let currentIndex = 0;
        setDisplayedText('');

        const intervalId = setInterval(() => {
            if (currentIndex < text.length) {
                // Use slice to be deterministic and avoid "missing character" bugs
                // Also type 2 characters at a time for extra speed if needed, 
                // but 2ms interval is already very fast.
                // Let's stick to 1 char per tick but very fast ticks.
                setDisplayedText(text.slice(0, currentIndex + 1));
                currentIndex++;
            } else {
                clearInterval(intervalId);
                if (onComplete) onComplete();
            }
        }, speed);

        return () => clearInterval(intervalId);
    }, [text, speed, onComplete]);

    return <MarkdownText text={displayedText} />;
};
