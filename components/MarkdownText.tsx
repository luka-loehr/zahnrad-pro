import React from 'react';

interface MarkdownTextProps {
    text: string;
}

/**
 * Simple markdown renderer for AI chat messages
 * Supports: **bold**, *italic*, lists, and line breaks
 */
export const MarkdownText: React.FC<MarkdownTextProps> = ({ text }) => {
    const renderMarkdown = (content: string) => {
        const lines = content.split('\n');
        const elements: React.ReactNode[] = [];
        let currentList: string[] = [];

        const flushList = () => {
            if (currentList.length > 0) {
                elements.push(
                    <ul key={`list-${elements.length}`} className="list-disc list-inside my-2 space-y-1">
                        {currentList.map((item, idx) => (
                            <li key={idx} dangerouslySetInnerHTML={{ __html: processInlineMarkdown(item) }} />
                        ))}
                    </ul>
                );
                currentList = [];
            }
        };

        const processInlineMarkdown = (line: string): string => {
            // Bold: **text**
            line = line.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
            // Italic: *text*
            line = line.replace(/\*(.+?)\*/g, '<em>$1</em>');
            // Code: `text`
            line = line.replace(/`(.+?)`/g, '<code class="bg-slate-600 px-1 rounded text-xs">$1</code>');
            return line;
        };

        lines.forEach((line, idx) => {
            // List item
            if (line.trim().match(/^[•\-\*]\s+/)) {
                const itemText = line.trim().replace(/^[•\-\*]\s+/, '');
                currentList.push(itemText);
            }
            // Heading
            else if (line.trim().startsWith('##')) {
                flushList();
                const headingText = line.replace(/^#+\s*/, '');
                elements.push(
                    <h3 key={idx} className="font-bold text-base mt-3 mb-1" dangerouslySetInnerHTML={{ __html: processInlineMarkdown(headingText) }} />
                );
            }
            // Regular text
            else if (line.trim()) {
                flushList();
                elements.push(
                    <p key={idx} className="my-1" dangerouslySetInnerHTML={{ __html: processInlineMarkdown(line) }} />
                );
            }
            // Empty line
            else {
                flushList();
                elements.push(<br key={idx} />);
            }
        });

        flushList();
        return elements;
    };

    return <div className="markdown-content">{renderMarkdown(text)}</div>;
};
