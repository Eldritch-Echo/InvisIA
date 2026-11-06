/* ================= EldritchEcho ================= */
"use strict";

(function () {
    const FONT_SIZE = 9;
    const LINE_HEIGHT = 12;
    const PAGE_MARGIN = 25;

    function getPDFLibrary() {
        if (typeof window.PDFLib === "undefined") {
            throw new Error("PDF library is not available.");
        }

        return window.PDFLib;
    }

    function normalizeText(text) {
        return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    }

    function wrapText(text, font, maxWidth) {
        const lines = [];
        let currentLine = "";

        for (const character of text) {
            if (character === "\n") {
                lines.push(currentLine);
                currentLine = "";

                continue;
            }

            const candidate = currentLine + character;

            const width = font.widthOfTextAtSize(candidate, FONT_SIZE);

            if (width > maxWidth && currentLine !== "") {
                lines.push(currentLine);
                currentLine = character;
            } else {
                currentLine = candidate;
            }
        }

        lines.push(currentLine);

        return lines;
    }

    async function embedInvisibleText(file, instruction) {
        const lib = getPDFLibrary();

        if (!file) {
            throw new Error("No source PDF was provided.");
        }

        if (typeof instruction !== "string" || instruction.trim() === "") {
            throw new Error("Hidden instruction cannot be empty.");
        }

        const normalizedInstruction = normalizeText(instruction);

        const sourceBytes = await file.arrayBuffer();

        const pdfDoc = await lib.PDFDocument.load(sourceBytes, {
            updateMetadata: false
        });

        const pages = pdfDoc.getPages();

        if (pages.length === 0) {
            throw new Error("The PDF does not contain any pages.");
        }

        const font = await pdfDoc.embedFont(lib.StandardFonts.Helvetica);

        try {
            font.encodeText(normalizedInstruction.replace(/\n/g, ""));
        } catch (error) {
            throw new Error(
                "The instruction contains characters " +
                    "that are not supported by the current " +
                    "PDF font. Unicode font support will " +
                    "be added in a later version."
            );
        }

        const minimumPageWidth = Math.min(...pages.map((page) => page.getWidth()));

        const availableWidth = minimumPageWidth - PAGE_MARGIN * 2;

        if (availableWidth <= 0) {
            throw new Error("The PDF pages are too narrow.");
        }

        const lines = wrapText(normalizedInstruction, font, availableWidth);

        let lineIndex = 0;

        for (const page of pages) {
            if (lineIndex >= lines.length) {
                break;
            }

            const availableHeight = page.getHeight() - PAGE_MARGIN * 2;

            const linesPerPage = Math.floor(availableHeight / LINE_HEIGHT);

            if (linesPerPage < 1) {
                continue;
            }

            const pageLines = lines.slice(lineIndex, lineIndex + linesPerPage);

            if (pageLines.length === 0) {
                continue;
            }

            page.pushOperators(
                lib.pushGraphicsState(),

                lib.setTextRenderingMode(lib.TextRenderingMode.Invisible)
            );

            page.drawText(pageLines.join("\n"), {
                x: PAGE_MARGIN,
                y: page.getHeight() - PAGE_MARGIN,

                font: font,
                size: FONT_SIZE,
                lineHeight: LINE_HEIGHT
            });

            page.pushOperators(lib.popGraphicsState());

            lineIndex += pageLines.length;
        }

        if (lineIndex < lines.length) {
            throw new Error("The complete instruction does not fit " + "within the existing PDF pages.");
        }

        const modifiedBytes = await pdfDoc.save();

        return modifiedBytes;
    }

    window.InvisIAPDF = {
        embedInvisibleText: embedInvisibleText
    };
})();
/* ================= EldritchEcho ================= */
