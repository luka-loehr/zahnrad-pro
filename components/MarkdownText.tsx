import React from 'react';
import { Streamdown } from 'streamdown';

interface MarkdownTextProps {
    text: string;
}

/**
 * Streamdown-powered markdown renderer optimized for AI streaming
 * Handles incomplete/unterminated markdown blocks gracefully
 */
export const MarkdownText: React.FC<MarkdownTextProps> = ({ text }) => {
    return <Streamdown>{text}</Streamdown>;
};
