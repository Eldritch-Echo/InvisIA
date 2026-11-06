/* ================= EldritchEcho ================= */
import * as pdfjsLib from "../lib/pdf.mjs";

pdfjsLib.GlobalWorkerOptions.workerSrc =
    "lib/pdf.worker.mjs";

const pdfInput = document.getElementById("inspect-pdf-file");

const inspectButton = document.getElementById("inspect-button");

const selectedFile = document.getElementById("inspect-selected-file");

const fileName = document.getElementById("inspect-file-name");

const fileSize = document.getElementById("inspect-file-size");

const inspectionStatus = document.getElementById("inspection-status");

const statPages = document.getElementById("stat-pages");

const statTextItems = document.getElementById("stat-text-items");

const statHiddenItems = document.getElementById("stat-hidden-items");

const analysisSummary = document.getElementById("analysis-summary");

const hiddenResultsEmpty = document.getElementById("hidden-results-empty");

const hiddenResultsList = document.getElementById("hidden-results-list");

let currentFile = null;
let isInspecting = false;
let selectionVersion = 0;

window.InvisIADebugExtractedText = "";

function formatFileSize(bytes) {
    if (bytes < 1024) {
        return `${bytes} B`;
    }

    if (bytes < 1024 * 1024) {
        return `${(bytes / 1024).toFixed(2)} KB`;
    }

    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function setStatus(message, type = "") {
    inspectionStatus.textContent = message;

    inspectionStatus.classList.remove("success", "error");

    if (type) {
        inspectionStatus.classList.add(type);
    }
}

async function hasPDFSignature(file) {
    if (!file || file.size < 5) {
        return false;
    }

    const header = new Uint8Array(await file.slice(0, 5).arrayBuffer());

    return String.fromCharCode(...header) === "%PDF-";
}

function resetResults() {
    statPages.textContent = "0";
    statTextItems.textContent = "0";
    statHiddenItems.textContent = "0";

    window.InvisIADebugExtractedText = "";

    analysisSummary.textContent = "Select and inspect a PDF to view the analysis results.";

    hiddenResultsList.replaceChildren();
    hiddenResultsList.hidden = true;

    hiddenResultsEmpty.hidden = false;

    hiddenResultsEmpty.querySelector("p").textContent = "No document analyzed yet.";
}

function extractGlyphText(glyphs) {
    if (typeof glyphs === "string") {
        return glyphs;
    }

    if (!Array.isArray(glyphs)) {
        return "";
    }

    let text = "";

    for (const glyph of glyphs) {
        if (Array.isArray(glyph)) {
            text += extractGlyphText(glyph);
        } else if (glyph && typeof glyph.unicode === "string") {
            text += glyph.unicode;
        }
    }

    return text;
}

function detectInvisibleText(operatorList, pageNumber) {
    const OPS = pdfjsLib.OPS;
    const findings = [];

    const stateStack = [];

    let renderingMode = 0;
    let currentText = "";

    function flushText() {
        const text = currentText.trim();

        if (text.length > 0) {
            findings.push({
                page: pageNumber,
                mode: 3,
                technique: "Invisible Text Rendering",
                text: text
            });
        }

        currentText = "";
    }

    function appendLineBreak() {
        if (renderingMode === 3 && currentText.length > 0 && !currentText.endsWith("\n")) {
            currentText += "\n";
        }
    }

    for (let index = 0; index < operatorList.fnArray.length; index++) {
        const operation = operatorList.fnArray[index];

        const args = operatorList.argsArray[index] || [];

        if (operation === OPS.save) {
            stateStack.push(renderingMode);
        } else if (operation === OPS.restore) {
            flushText();

            if (stateStack.length > 0) {
                renderingMode = stateStack.pop();
            } else {
                renderingMode = 0;
            }
        } else if (operation === OPS.setTextRenderingMode) {
            flushText();

            renderingMode = args[0];
        } else if (
            operation === OPS.nextLine ||
            operation === OPS.moveText ||
            operation === OPS.setLeadingMoveText ||
            operation === OPS.setTextMatrix
        ) {
            appendLineBreak();
        } else if (
            operation === OPS.showText ||
            operation === OPS.showSpacedText ||
            operation === OPS.showType3Text ||
            operation === OPS.nextLineShowText ||
            operation === OPS.nextLineSetSpacingShowText
        ) {
            if (renderingMode !== 3) {
                continue;
            }

            if (operation === OPS.nextLineShowText || operation === OPS.nextLineSetSpacingShowText) {
                appendLineBreak();
            }

            const glyphs = args[args.length - 1];

            currentText += extractGlyphText(glyphs);
        } else if (operation === OPS.endText) {
            flushText();
        }
    }

    flushText();

    return findings;
}

function renderHiddenResults(findings) {
    hiddenResultsList.replaceChildren();

    if (findings.length === 0) {
        hiddenResultsEmpty.hidden = false;
        hiddenResultsList.hidden = true;

        hiddenResultsEmpty.querySelector("p").textContent = "No invisible text using rendering mode 3 Tr was detected.";

        return;
    }

    hiddenResultsEmpty.hidden = true;
    hiddenResultsList.hidden = false;

    for (let index = 0; index < findings.length; index++) {
        const finding = findings[index];

        const card = document.createElement("article");
        card.className = "hidden-item";

        const header = document.createElement("div");
        header.className = "hidden-item-header";

        const title = document.createElement("h4");
        title.className = "hidden-item-title";

        title.textContent = `Hidden Text #${index + 1}`;

        const metadata = document.createElement("span");
        metadata.className = "hidden-item-meta";

        metadata.textContent = `Page ${finding.page} | 3 Tr`;

        const textBlock = document.createElement("pre");
        textBlock.className = "hidden-item-text";

        textBlock.textContent = finding.text;

        header.appendChild(title);
        header.appendChild(metadata);

        card.appendChild(header);
        card.appendChild(textBlock);

        hiddenResultsList.appendChild(card);
    }
}

pdfInput.addEventListener("change", async () => {
    const version = ++selectionVersion;

    currentFile = null;
    inspectButton.disabled = true;
    selectedFile.hidden = true;

    resetResults();
    setStatus("");

    const file = pdfInput.files[0];

    if (!file) {
        return;
    }

    try {
        const valid = await hasPDFSignature(file);

        if (version !== selectionVersion) {
            return;
        }

        if (!valid) {
            pdfInput.value = "";

            setStatus("Invalid PDF document. Please select a valid PDF file.", "error");

            return;
        }

        currentFile = file;

        fileName.textContent = file.name;
        fileSize.textContent = formatFileSize(file.size);

        selectedFile.hidden = false;
        inspectButton.disabled = false;

        setStatus("PDF selected. Ready to inspect.");
    } catch (error) {
        if (version !== selectionVersion) {
            return;
        }

        console.error("File validation error:", error);

        setStatus("Unable to read the selected file.", "error");
    }
});

inspectButton.addEventListener("click", async () => {
    if (!currentFile || isInspecting) {
        return;
    }

    isInspecting = true;

    inspectButton.disabled = true;
    pdfInput.disabled = true;

    resetResults();

    setStatus("Analyzing PDF document...");

    let pdf = null;
    let loadingTask = null;

    try {
        const buffer = await currentFile.arrayBuffer();

        loadingTask = pdfjsLib.getDocument({
            data: new Uint8Array(buffer),
            enableScripting: false,
            isEvalSupported: false
        });

        pdf = await loadingTask.promise;

        let totalTextItems = 0;

        const extractedPages = [];
        const hiddenFindings = [];

        for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
            const page = await pdf.getPage(pageNumber);

            const textContent = await page.getTextContent();

            totalTextItems += textContent.items.length;

            const pageText = textContent.items.map((item) => item.str || "").join(" ");

            extractedPages.push(`--- PAGE ${pageNumber} ---\n${pageText}`);

            const operatorList = await page.getOperatorList({
                annotationMode: pdfjsLib.AnnotationMode.DISABLE
            });

            const pageFindings = detectInvisibleText(operatorList, pageNumber);

            hiddenFindings.push(...pageFindings);

            page.cleanup();
        }

        window.InvisIADebugExtractedText = extractedPages.join("\n\n");

        statPages.textContent = String(pdf.numPages);

        statTextItems.textContent = String(totalTextItems);

        statHiddenItems.textContent = String(hiddenFindings.length);

        renderHiddenResults(hiddenFindings);

        if (hiddenFindings.length > 0) {
            analysisSummary.textContent =
                `${hiddenFindings.length} invisible text ` +
                `block(s) detected using PDF rendering ` +
                `mode 3 Tr. Review the findings below.`;
        } else {
            analysisSummary.textContent =
                "No invisible text using rendering mode " +
                "3 Tr was detected. Other hiding techniques " +
                "are not analyzed yet.";
        }

        setStatus("PDF inspection completed successfully.", "success");
    } catch (error) {
        console.error("PDF inspection error:", error);

        resetResults();

        setStatus("Unable to inspect this PDF document.", "error");
    } finally {
        if (loadingTask) {
            try {
                await loadingTask.destroy();
            } catch (error) {
                console.warn("PDF cleanup error:", error);
            }
        }

        isInspecting = false;

        pdfInput.disabled = false;
        inspectButton.disabled = currentFile === null;
    }
});

const clearInspectorButton = document.getElementById("clear-inspector-button");

clearInspectorButton.addEventListener("click", () => {
    window.location.reload();
});
/* ================= EldritchEcho ================= */
