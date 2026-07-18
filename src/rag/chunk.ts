export interface DocChunk {
    source: string;
    heading: string;
    content: string;
    chunkIndex: number;
}

const MAX_CHUNK_CHARS = 800;
const OVERLAP_CHARS = 120;

export function chunkMarkdown(source: string, rawContent: string): DocChunk[] {
    const sections = splitByHeadings(rawContent);
    const chunks: DocChunk[] = [];
    let chunkIndex = 0;

    for (const section of sections) {
        const pieces = splitBySize(section.content, MAX_CHUNK_CHARS, OVERLAP_CHARS);
        for (const piece of pieces) {
            chunks.push({
                source,
                heading: section.heading,
                content: piece.trim(),
                chunkIndex: chunkIndex++
            });
        }
    }

    return chunks.filter((c) => c.content.length > 0);
}

interface Section {
    heading: string;
    content: string;
}

function splitByHeadings(rawContent: string): Section[] {
    const lines = rawContent.split("\n");
    const sections: Section[] = [];
    let currentHeading = "(sin título)";
    let currentLines: string[] = [];

    const flush = () => {
        if (currentLines.length > 0) {
            sections.push({ heading: currentHeading, content: currentLines.join("\n") });
        }
        currentLines = [];
    };

    for (const line of lines) {
        const headingMatch = line.match(/^(#{1,3})\s+(.*)/);
        if (headingMatch) {
            flush();
            currentHeading = headingMatch[2].trim();
        }
        currentLines.push(line);
    }
    flush();

    return sections;
}

function splitBySize(text: string, maxChars: number, overlap: number): string[] {
    if (text.length <= maxChars) {
        return [text];
    }

    const pieces: string[] = [];
    let start = 0;

    while (start < text.length) {
        const end = Math.min(start + maxChars, text.length);
        pieces.push(text.slice(start, end));
        if (end === text.length) break;
        start = end - overlap;
    }

    return pieces;
}