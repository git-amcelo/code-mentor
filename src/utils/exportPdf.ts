/**
 * exportPdf.ts
 * ─────────────────────────────────────────────────────────
 * Dynamic PDF Generation utility for CodeMentor chat.
 * Converts the current conversation (messages array) into
 * a cleanly formatted PDF document using jsPDF.
 * ─────────────────────────────────────────────────────────
 */

import jsPDF from 'jspdf';

interface ChatMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
}

/**
 * Strips basic markdown syntax so the PDF contains readable
 * plain text. Handles headings, bold, italic, inline code,
 * code fences, links, images, and list markers.
 */
function stripMarkdown(text: string): string {
    return text
        // Remove code fences (``` ... ```)
        .replace(/```[\s\S]*?```/g, (match) => {
            // Keep the code content, just remove the fences
            const lines = match.split('\n');
            // Remove first line (```lang) and last line (```)
            const codeLines = lines.slice(1, -1);
            return codeLines.join('\n');
        })
        // Remove headings (## Heading → Heading)
        .replace(/^#{1,6}\s+/gm, '')
        // Bold **text** or __text__
        .replace(/(\*\*|__)(.*?)\1/g, '$2')
        // Italic *text* or _text_
        .replace(/(\*|_)(.*?)\1/g, '$2')
        // Inline code `code`
        .replace(/`([^`]+)`/g, '$1')
        // Links [text](url) → text
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        // Images ![alt](url) → alt
        .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
        // Horizontal rules
        .replace(/^[-*_]{3,}\s*$/gm, '────────────────────────────')
        // Unordered list markers
        .replace(/^\s*[-*+]\s+/gm, '  • ')
        // Ordered list markers
        .replace(/^\s*\d+\.\s+/gm, '  ')
        // Blockquotes
        .replace(/^\s*>\s?/gm, '  │ ')
        // Clean up extra blank lines
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

/**
 * Wraps a long string into an array of lines, each fitting
 * within `maxWidth` pixels according to the current jsPDF
 * font settings.
 */
function wrapText(doc: jsPDF, text: string, maxWidth: number): string[] {
    return doc.splitTextToSize(text, maxWidth) as string[];
}

/**
 * Generates and downloads a PDF from an array of chat messages.
 *
 * The PDF includes:
 *  - A styled header with the CodeMentor branding
 *  - A timestamp showing when the export was created
 *  - Each message formatted with role labels and content
 *  - Automatic page breaks when content overflows
 */
export function exportChatAsPdf(messages: ChatMessage[]): void {
    const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'pt',
        format: 'a4',
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const marginLeft = 40;
    const marginRight = 40;
    const marginTop = 50;
    const marginBottom = 50;
    const contentWidth = pageWidth - marginLeft - marginRight;

    let yPos = marginTop;

    /**
     * Checks if there's enough space for the next block
     * of text, and adds a new page if needed.
     */
    const ensureSpace = (requiredHeight: number) => {
        if (yPos + requiredHeight > pageHeight - marginBottom) {
            doc.addPage();
            // Paint page background offwhite
            doc.setFillColor(245, 243, 238);
            doc.rect(0, 0, pageWidth, pageHeight, 'F');
            
            yPos = marginTop;
            // Add a subtle page header on continuation pages
            doc.setFontSize(8);
            doc.setFont('courier', 'normal');
            doc.setTextColor(17, 17, 17);
            doc.text('CODEMENTOR_SYS // EXPORT_CONTINUED', marginLeft, 30);
            doc.setDrawColor(17, 17, 17);
            doc.line(marginLeft, 35, pageWidth - marginRight, 35);
            yPos = marginTop;
        }
    };

    // Paint initial page background
    doc.setFillColor(245, 243, 238);
    doc.rect(0, 0, pageWidth, pageHeight, 'F');

    // ─── HEADER ──────────────────────────────────────────

    // Background accent bar (Signal Red)
    doc.setFillColor(230, 59, 46);
    doc.rect(0, 0, pageWidth, 6, 'F');

    // Title
    doc.setFontSize(22);
    doc.setFont('times', 'italic');
    doc.setTextColor(17, 17, 17); // Blackish
    doc.text('CodeMentor', marginLeft, yPos);
    yPos += 20;

    // Subtitle
    doc.setFontSize(10);
    doc.setFont('courier', 'bold');
    doc.setTextColor(17, 17, 17); 
    doc.text('DIAGNOSTIC EXPORT // LOCAL NEURO-SYMBOLIC AI', marginLeft, yPos);
    yPos += 14;

    // Timestamp
    const now = new Date();
    const timestamp = now.toLocaleString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    });
    doc.setFontSize(9);
    doc.setFont('courier', 'normal');
    doc.setTextColor(17, 17, 17);
    doc.text(`TIMESTAMP: ${timestamp}`, marginLeft, yPos);
    yPos += 8;

    // Divider
    doc.setDrawColor(17, 17, 17);
    doc.setLineWidth(1.5);
    doc.line(marginLeft, yPos, pageWidth - marginRight, yPos);
    yPos += 20;

    // ─── MESSAGES ────────────────────────────────────────

    messages.forEach((msg, index) => {
        const isUser = msg.role === 'user';
        const label = isUser ? 'GUEST_INPUT' : 'CODEMENTOR_PROCESS';
        const cleanContent = stripMarkdown(msg.content);

        // Role label wrapping logic
        ensureSpace(40);
        
        doc.setFontSize(9);
        doc.setFont('courier', 'bold');

        // Draw Brutalist Tag Background
        const tagWidth = doc.getTextWidth(label) + 12;
        if (isUser) {
            doc.setFillColor(17, 17, 17); // Blackish
            doc.rect(marginLeft, yPos - 10, tagWidth, 14, 'F');
            doc.setTextColor(245, 243, 238); // Off-white text
        } else {
            doc.setFillColor(230, 59, 46); // Signal Red
            doc.rect(marginLeft, yPos - 10, tagWidth, 14, 'F');
            doc.setTextColor(255, 255, 255); // White text
        }

        // Draw text inside tag
        doc.text(label, marginLeft + 6, yPos);
        yPos += 14;

        // Message content
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(17, 17, 17); // Blackish

        const lines = wrapText(doc, cleanContent, contentWidth);

        lines.forEach((line: string) => {
            ensureSpace(14);
            doc.text(line, marginLeft, yPos);
            yPos += 13;
        });

        // Spacing between messages
        yPos += 12;

        // Subtle divider between messages (except for the last)
        if (index < messages.length - 1) {
            ensureSpace(12);
            doc.setDrawColor(17, 17, 17);
            doc.setLineWidth(0.5);
            doc.line(marginLeft, yPos, pageWidth - marginRight, yPos);
            yPos += 16;
        }
    });

    // ─── FOOTER on every page ────────────────────────────
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setFont('courier', 'bold');
        doc.setTextColor(17, 17, 17);
        doc.text(
            `[ PG ${i} // ${totalPages} ]`,
            pageWidth / 2,
            pageHeight - 20,
            { align: 'center' }
        );
        // Bottom accent bar (Signal Red)
        doc.setFillColor(230, 59, 46);
        doc.rect(0, pageHeight - 6, pageWidth, 6, 'F');
    }

    // ─── DOWNLOAD ────────────────────────────────────────
    const fileName = `CodeMentor_Chat_${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}.pdf`;
    doc.save(fileName);
}
