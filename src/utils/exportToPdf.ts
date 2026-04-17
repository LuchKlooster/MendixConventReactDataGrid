/**
 * Minimal PDF table export — zero external dependencies.
 * Uses PDF standard Type1 fonts (Helvetica / Helvetica-Bold).
 * Characters in the WinAnsiEncoding range (0x20–0xFF) are preserved,
 * including € (mapped to 0x80) and all Latin-1 characters.
 */

export interface PdfColumn {
    header: string;
    getValue: (row: unknown) => string;
}

// ── Layout constants ────────────────────────────────────────────────────────
const MARGIN        = 30;
const HEADER_H      = 20;
const ROW_H         = 16;
const FONT_HDR      = 9;
const FONT_ROW      = 8;
const MIN_COL_W     = 55;  // floor used when scaling wide tables
const MAX_COL_W     = 160;
// Approximate character width for Helvetica at 1pt (ratio)
const CHAR_RATIO    = 0.55;

// ── Colours (R G B in 0-1 range, as PDF decimal strings) ───────────────────
const C_BLUE        = "0.149 0.290 0.898";
const C_WHITE       = "1 1 1";
const C_ALT_ROW     = "0.973 0.973 0.973";
const C_TEXT        = "0.15 0.15 0.15";
const C_BORDER      = "0.85 0.85 0.85";

// ── Helpers ─────────────────────────────────────────────────────────────────

// Map characters to WinAnsiEncoding (Windows-1252) byte values.
// Latin-1 supplement (0xA0–0xFF) maps 1-to-1; Windows-1252 extras handled explicitly.
const WIN1252_MAP: Record<string, string> = {
    "\u20AC": "\x80", // €
    "\u201A": "\x82", // ‚
    "\u0192": "\x83", // ƒ
    "\u201E": "\x84", // „
    "\u2026": "\x85", // …
    "\u2020": "\x86", // †
    "\u2021": "\x87", // ‡
    "\u02C6": "\x88", // ˆ
    "\u2030": "\x89", // ‰
    "\u0160": "\x8A", // Š
    "\u2039": "\x8B", // ‹
    "\u0152": "\x8C", // Œ
    "\u017D": "\x8E", // Ž
    "\u2018": "\x91", // '
    "\u2019": "\x92", // '
    "\u201C": "\x93", // "
    "\u201D": "\x94", // "
    "\u2022": "\x95", // •
    "\u2013": "\x96", // –
    "\u2014": "\x97", // —
    "\u02DC": "\x98", // ˜
    "\u2122": "\x99", // ™
    "\u0161": "\x9A", // š
    "\u203A": "\x9B", // ›
    "\u0153": "\x9C", // œ
    "\u017E": "\x9E", // ž
    "\u0178": "\x9F", // Ÿ
};

function toWinAnsi(s: string): string {
    // Characters 0x20–0xFF: Latin-1 (0xA0–0xFF) passes through as-is.
    // Characters outside that range: use WIN1252_MAP or replace with "?".
    return s.replace(/[^\x20-\xFF]/g, ch => WIN1252_MAP[ch] ?? "?");
}

function escapePdf(s: string): string {
    return toWinAnsi(s)
        .replace(/\\/g, "\\\\")
        .replace(/\(/g, "\\(")
        .replace(/\)/g, "\\)");
}

function charWidth(size: number): number {
    return size * CHAR_RATIO;
}

function truncate(text: string, maxW: number, size: number): string {
    const cw = charWidth(size);
    if (text.length * cw <= maxW) return text;
    const ellipsis = "...";
    const ellW = ellipsis.length * cw;
    const maxChars = Math.max(0, Math.floor((maxW - ellW) / cw));
    return text.slice(0, maxChars) + ellipsis;
}

// ── PDF builder ─────────────────────────────────────────────────────────────
class PdfBuilder {
    private parts: string[] = [];
    private offsets: number[] = [];
    private objCount = 0;
    private byteLen = 0;

    private write(s: string): void {
        this.parts.push(s);
        this.byteLen += s.length;
    }

    private startObj(): number {
        this.objCount++;
        this.offsets.push(this.byteLen);
        this.write(`${this.objCount} 0 obj\n`);
        return this.objCount;
    }

    private endObj(): void { this.write("endobj\n"); }

    build(
        columns: PdfColumn[],
        rows: unknown[]
    ): void {
        const landscape = columns.length > 5;
        const PW = landscape ? 841.89 : 595.28;
        const PH = landscape ? 595.28 : 841.89;
        const usableW = PW - MARGIN * 2;

        // ── Cell data ─────────────────────────────────────────────────────
        const headers  = columns.map(c => toWinAnsi(c.header));
        const bodyData = rows.map(row => columns.map(c => toWinAnsi(c.getValue(row))));

        // ── Column widths (natural, capped) ──────────────────────────────
        const rawW = columns.map((_, ci) => {
            const hw = headers[ci].length * charWidth(FONT_HDR) + 10;
            const dw = bodyData.reduce((m, r) =>
                Math.max(m, r[ci].length * charWidth(FONT_ROW) + 8), 0);
            return Math.min(MAX_COL_W, Math.max(MIN_COL_W, Math.max(hw, dw)));
        });

        // ── Split columns into groups ─────────────────────────────────────
        // Split when the next column would overflow usableW OR when the group
        // already holds the max readable column count for this orientation.
        const MAX_COLS_PER_PAGE = landscape ? 7 : 5;
        const colGroups: number[][] = [];
        let curGroup: number[] = [];
        let curW = 0;
        for (let ci = 0; ci < columns.length; ci++) {
            const w = rawW[ci];
            if (curGroup.length > 0 &&
                (curW + w > usableW || curGroup.length >= MAX_COLS_PER_PAGE)) {
                colGroups.push(curGroup);
                curGroup = [ci];
                curW = w;
            } else {
                curGroup.push(ci);
                curW += w;
            }
        }
        if (curGroup.length > 0) colGroups.push(curGroup);

        // ── Paginate rows ─────────────────────────────────────────────────
        const rowsPerPage  = Math.floor((PH - MARGIN * 2 - HEADER_H) / ROW_H);
        const rowPageCount = Math.max(1, Math.ceil(bodyData.length / rowsPerPage));

        // ── Generate page content streams ─────────────────────────────────
        const pageStreams: string[] = [];

        for (let rp = 0; rp < rowPageCount; rp++) {
            const slice = bodyData.slice(rp * rowsPerPage, (rp + 1) * rowsPerPage);

            for (const group of colGroups) {
                // Stretch columns proportionally to fill the full page width
                const naturalGroupColW = group.map(ci => rawW[ci]);
                const naturalTotal     = naturalGroupColW.reduce((a, b) => a + b, 0);
                const scale            = naturalTotal > 0 ? usableW / naturalTotal : 1;
                const groupColW        = naturalGroupColW.map(w => w * scale);
                let out = "";

                const hdrY = PH - MARGIN - HEADER_H;

                // Header backgrounds
                let x = MARGIN;
                out += `${C_BLUE} rg\n`;
                groupColW.forEach(w => {
                    out += `${x.toFixed(2)} ${hdrY.toFixed(2)} ${w.toFixed(2)} ${HEADER_H} re f\n`;
                    x += w;
                });

                // Header text
                out += `BT\n/F2 ${FONT_HDR} Tf\n${C_WHITE} rg\n`;
                x = MARGIN;
                group.forEach((ci, gi) => {
                    const label = escapePdf(truncate(headers[ci], groupColW[gi] - 6, FONT_HDR));
                    out += `1 0 0 1 ${(x + 4).toFixed(2)} ${(hdrY + 6).toFixed(2)} Tm (${label}) Tj\n`;
                    x += groupColW[gi];
                });
                out += "ET\n";

                // Data rows
                slice.forEach((rowData, ri) => {
                    const rowY = hdrY - (ri + 1) * ROW_H;

                    // Background
                    out += `${ri % 2 === 1 ? C_ALT_ROW : C_WHITE} rg\n`;
                    x = MARGIN;
                    groupColW.forEach(w => {
                        out += `${x.toFixed(2)} ${rowY.toFixed(2)} ${w.toFixed(2)} ${ROW_H} re f\n`;
                        x += w;
                    });

                    // Borders
                    out += `${C_BORDER} RG 0.3 w\n`;
                    x = MARGIN;
                    groupColW.forEach(w => {
                        out += `${x.toFixed(2)} ${rowY.toFixed(2)} ${w.toFixed(2)} ${ROW_H} re S\n`;
                        x += w;
                    });

                    // Text
                    out += `BT\n/F1 ${FONT_ROW} Tf\n${C_TEXT} rg\n`;
                    x = MARGIN;
                    group.forEach((ci, gi) => {
                        const cell = escapePdf(truncate(rowData[ci] ?? "", groupColW[gi] - 8, FONT_ROW));
                        out += `1 0 0 1 ${(x + 4).toFixed(2)} ${(rowY + 4).toFixed(2)} Tm (${cell}) Tj\n`;
                        x += groupColW[gi];
                    });
                    out += "ET\n";
                });

                pageStreams.push(out);
            }
        }

        // ── Write PDF objects ─────────────────────────────────────────────
        this.write("%PDF-1.4\n%\xFF\xFF\xFF\xFF\n");

        // Object 1: Catalog
        this.startObj();
        this.write("  << /Type /Catalog /Pages 2 0 R >>\n");
        this.endObj();

        // Object 2: Pages tree (will be written after we know page obj IDs)
        // Reserve slot: written at the end with forward reference fix — use simple approach instead:
        // Write pages tree after collecting page object numbers.
        // Reserve slot for obj 2 (Pages tree) — written after page IDs are known
        this.offsets.push(this.byteLen); // offset for obj 2
        this.objCount++;

        // Font objects: 3 = Helvetica, 4 = Helvetica-Bold
        this.startObj();
        this.write("  << /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\n");
        this.endObj();

        this.startObj();
        this.write("  << /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>\n");
        this.endObj();

        // Page objects + content streams
        const pageObjIds: number[] = [];
        for (const streamData of pageStreams) {
            const streamLen = streamData.length;

            // Content stream object
            const contentId = this.startObj();
            this.write(`  << /Length ${streamLen} >>\n`);
            this.write("stream\n");
            this.write(streamData);
            this.write("\nendstream\n");
            this.endObj();

            // Page object
            const pageId = this.startObj();
            pageObjIds.push(pageId);
            this.write(
                `  << /Type /Page /Parent 2 0 R\n` +
                `     /MediaBox [0 0 ${PW.toFixed(2)} ${PH.toFixed(2)}]\n` +
                `     /Contents ${contentId} 0 R\n` +
                `     /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >>\n` +
                `  >>\n`
            );
            this.endObj();
        }

        // Now build Pages tree string and insert at correct position
        const kidsList = pageObjIds.map(id => `${id} 0 R`).join(" ");
        const pagesStr = `2 0 obj\n  << /Type /Pages /Kids [${kidsList}] /Count ${pageObjIds.length} >>\nendobj\n`;

        // Insert the pages object at the right offset in parts
        // The offset for obj 2 is at this.offsets[1]
        // We need to inject pagesStr into the output at that position
        // Since we skipped writing obj 2, insert it now by replacing the placeholder offset
        // Simpler: just append obj 2 now and update the offset entry
        this.offsets[1] = this.byteLen;
        this.write(pagesStr);

        // ── xref table ───────────────────────────────────────────────────
        const xrefOffset = this.byteLen;
        const totalObjs  = this.objCount + 1; // +1 for free object 0
        this.write(`xref\n0 ${totalObjs}\n`);
        this.write("0000000000 65535 f \n");
        this.offsets.forEach(off => {
            this.write(String(off).padStart(10, "0") + " 00000 n \n");
        });

        // ── Trailer ──────────────────────────────────────────────────────
        this.write(
            `trailer\n  << /Size ${totalObjs} /Root 1 0 R >>\n` +
            `startxref\n${xrefOffset}\n%%EOF\n`
        );
    }

    getBytes(): Uint8Array {
        const full = this.parts.join("");
        const arr  = new Uint8Array(full.length);
        for (let i = 0; i < full.length; i++) arr[i] = full.charCodeAt(i) & 0xFF;
        return arr;
    }
}

// ── Public export function ───────────────────────────────────────────────────
export function exportToPdf(filename: string, columns: PdfColumn[], rows: unknown[]): void {
    const builder = new PdfBuilder();
    builder.build(columns, rows);
    const bytes = builder.getBytes();
    const blob  = new Blob([bytes.buffer as ArrayBuffer], { type: "application/pdf" });
    const url   = URL.createObjectURL(blob);
    const link  = document.createElement("a");
    link.href = url;
    link.download = filename.endsWith(".pdf") ? filename : `${filename}.pdf`;
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}
