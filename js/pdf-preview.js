/* ================= EldritchEcho ================= */
"use strict";

import * as pdfjsLib from "../lib/pdf.mjs";

pdfjsLib.GlobalWorkerOptions.workerSrc =
    "lib/pdf.worker.mjs";

const isInspector = document.getElementById("inspect-pdf-file") !== null;

let pdfInput;
let previewEmpty;
let previewPages;
let previewPageCount;

if (isInspector) {
    pdfInput = document.getElementById("inspect-pdf-file");

    previewEmpty = document.getElementById("inspect-preview-empty");

    previewPages = document.getElementById("inspect-preview-pages");

    previewPageCount = document.getElementById("inspect-page-count");
} else {
    pdfInput = document.getElementById("pdf-file");

    previewEmpty = document.getElementById("preview-empty");

    previewPages = document.getElementById("preview-pages");

    previewPageCount = document.getElementById("preview-page-count");
}

let previewVersion = 0;

const MAX_PREVIEW_PAGES = 5;

function showPreviewMessage(title, description) {
    previewEmpty.querySelector("h3").textContent = title;

    previewEmpty.querySelector("p").textContent = description;

    previewEmpty.hidden = false;
    previewPages.hidden = true;
}

function resetPreview() {
    previewPages.replaceChildren();

    previewPageCount.textContent = "No document";

    showPreviewMessage("No document selected", "Select a PDF to preview its visible contents here.");
}

async function hasPDFSignature(file) {
    if (!file || file.size < 5) {
        return false;
    }

    const bytes = new Uint8Array(await file.slice(0, 5).arrayBuffer());

    return String.fromCharCode(...bytes) === "%PDF-";
}

async function renderPage(pdf, pageNumber) {
    const page = await pdf.getPage(pageNumber);

    const baseViewport = page.getViewport({
        scale: 1
    });

    const availableWidth = Math.max(200, previewPages.clientWidth - 50);

    const scale = Math.min(availableWidth / baseViewport.width, 1.6);

    const viewport = page.getViewport({ scale });

    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);

    const canvas = document.createElement("canvas");

    const context = canvas.getContext("2d");

    if (!context) {
        throw new Error("Canvas rendering is unavailable.");
    }

    canvas.width = Math.ceil(viewport.width * pixelRatio);

    canvas.height = Math.ceil(viewport.height * pixelRatio);

    canvas.style.width = `${viewport.width}px`;
    canvas.style.height = `${viewport.height}px`;

    let transform = null;

    if (pixelRatio !== 1) {
        transform = [pixelRatio, 0, 0, pixelRatio, 0, 0];
    }

    await page.render({
        canvasContext: context,
        viewport,
        transform
    }).promise;

    page.cleanup();

    return canvas;
}

async function loadPreview(file, version) {
    let pdf = null;
    let loadingTask = null;

    try {
        showPreviewMessage("Loading document...", "Reading and rendering your PDF locally.");

        previewPageCount.textContent = "Loading...";

        const buffer = await file.arrayBuffer();

        if (version !== previewVersion) {
            return;
        }

        loadingTask = pdfjsLib.getDocument({
            data: new Uint8Array(buffer),
            enableScripting: false,
            isEvalSupported: false
        });

        pdf = await loadingTask.promise;

        if (version !== previewVersion) {
            return;
        }

        const totalPages = pdf.numPages;

        const pagesToRender = Math.min(totalPages, MAX_PREVIEW_PAGES);

        previewPages.replaceChildren();

        previewEmpty.hidden = true;
        previewPages.hidden = false;

        if (totalPages > MAX_PREVIEW_PAGES) {
            previewPageCount.textContent = `${pagesToRender} / ${totalPages} pages`;
        } else if (totalPages === 1) {
            previewPageCount.textContent = "1 page";
        } else {
            previewPageCount.textContent = `${totalPages} pages`;
        }

        for (let pageNumber = 1; pageNumber <= pagesToRender; pageNumber++) {
            if (version !== previewVersion) {
                return;
            }

            const canvas = await renderPage(pdf, pageNumber);

            if (version !== previewVersion) {
                return;
            }

            previewPages.appendChild(canvas);
        }
    } catch (error) {
        if (version !== previewVersion) {
            return;
        }

        console.error("PDF preview error:", error);

        previewPages.replaceChildren();

        previewPageCount.textContent = "Preview error";

        showPreviewMessage("Unable to preview PDF", "The document may be damaged, encrypted, or unsupported.");
    } finally {
        if (loadingTask) {
            try {
                await loadingTask.destroy();
            } catch (error) {
                console.warn("PDF cleanup error:", error);
            }
        }
    }
}

if (pdfInput) {
    pdfInput.addEventListener("change", async () => {
        const version = ++previewVersion;

        resetPreview();

        const file = pdfInput.files[0];

        if (!file) {
            return;
        }

        try {
            if (!(await hasPDFSignature(file))) {
                return;
            }

            if (version !== previewVersion) {
                return;
            }

            await loadPreview(file, version);
        } catch (error) {
            if (version !== previewVersion) {
                return;
            }

            console.error("PDF loading error:", error);

            showPreviewMessage("Unable to read file", "Please select a valid PDF document.");
        }
    });
}
/* ================= EldritchEcho ================= */
