/* ================= EldritchEcho ================= */
"use strict";

document.addEventListener("DOMContentLoaded", () => {
    const pdfInput = document.getElementById("pdf-file");

    const selectedFileBox = document.getElementById("selected-file");

    const selectedFileName = document.getElementById("selected-file-name");

    const selectedFileSize = document.getElementById("selected-file-size");

    const instructionInput = document.getElementById("hidden-instruction");

    const characterCount = document.getElementById("character-count");

    const generateButton = document.getElementById("generate-button");

    const generationStatus = document.getElementById("generation-status");

    const fileError = document.createElement("p");

    fileError.className = "generation-status";
    fileError.setAttribute("role", "alert");

    document.getElementById("file-help").insertAdjacentElement("afterend", fileError);

    const downloadSection = document.getElementById("download-section");

    let sourcePDF = null;
    let generatedPDF = null;

    let selectionVersion = 0;
    let isGenerating = false;

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
        generationStatus.textContent = message;

        generationStatus.classList.remove("success", "error");

        if (type) {
            generationStatus.classList.add(type);
        }

        fileError.textContent = type === "error" ? message : "";

        fileError.classList.toggle("error", type === "error");
    }

    function updateGenerateButton() {
        const hasFile = sourcePDF !== null;

        const hasInstruction = instructionInput.value.trim().length > 0;

        generateButton.disabled = isGenerating || !hasFile || !hasInstruction;
    }

    function resetFileSelection() {
        sourcePDF = null;
        generatedPDF = null;

        selectedFileBox.hidden = true;
        selectedFileName.textContent = "";
        selectedFileSize.textContent = "";

        updateGenerateButton();
        downloadSection.hidden = true;

        setStatus("");
    }

    async function isPDF(file) {
        if (!file || file.size < 5) {
            return false;
        }

        const header = await file.slice(0, 5).arrayBuffer();

        const signature = new TextDecoder("ascii").decode(header);

        return signature === "%PDF-";
    }

    pdfInput.addEventListener("change", async () => {
        const version = ++selectionVersion;

        resetFileSelection();

        const file = pdfInput.files[0];

        if (!file) {
            return;
        }

        setStatus("Validating PDF document...");

        try {
            const validPDF = await isPDF(file);

            if (version !== selectionVersion) {
                return;
            }

            if (!validPDF) {
                pdfInput.value = "";

                setStatus("Invalid PDF document. Please select a valid PDF file.", "error");

                return;
            }

            sourcePDF = file;
            updateGenerateButton();

            selectedFileName.textContent = file.name;

            selectedFileSize.textContent = formatFileSize(file.size);

            selectedFileBox.hidden = false;

            setStatus(
                "PDF selected successfully. Document preview and generation will be available when the PDF engine is connected.",
                "success"
            );
        } catch (error) {
            if (version !== selectionVersion) {
                return;
            }

            resetFileSelection();
            pdfInput.value = "";

            setStatus("Unable to read the selected PDF document.", "error");

            console.error("PDF validation error:", error);
        }
    });

    function updateCharacterCount() {
        const text = instructionInput.value;

        const count = Array.from(text).length;

        characterCount.textContent = `${count.toLocaleString("en-US")} characters`;

        generatedPDF = null;
        downloadSection.hidden = true;

        updateGenerateButton();
    }

    instructionInput.addEventListener("input", updateCharacterCount);

    updateCharacterCount();

    generateButton.addEventListener("click", async () => {
        if (isGenerating || !sourcePDF) {
            return;
        }

        const instruction = instructionInput.value;

        if (instruction.trim().length === 0) {
            return;
        }

        if (!window.InvisIAPDF || typeof window.InvisIAPDF.embedInvisibleText !== "function") {
            setStatus("PDF engine is not available.", "error");

            return;
        }

        isGenerating = true;
        generatedPDF = null;

        downloadSection.hidden = true;

        pdfInput.disabled = true;
        instructionInput.disabled = true;

        updateGenerateButton();

        setStatus("Generating PDF document...");

        try {
            generatedPDF = await window.InvisIAPDF.embedInvisibleText(sourcePDF, instruction);

            downloadSection.hidden = false;

            downloadButton.click();

            setStatus("PDF generated successfully. Download requested.", "success");
        } catch (error) {
            generatedPDF = null;

            console.error("PDF generation error:", error);

            setStatus(error.message || "Unable to generate PDF.", "error");
        } finally {
            isGenerating = false;

            pdfInput.disabled = false;
            instructionInput.disabled = false;

            updateGenerateButton();
        }
    });

    const downloadButton = document.getElementById("download-button");

    downloadButton.addEventListener("click", () => {
        if (!generatedPDF || !sourcePDF) {
            return;
        }

        const blob = new Blob([generatedPDF], { type: "application/pdf" });

        const url = URL.createObjectURL(blob);

        const link = document.createElement("a");

        const originalName = sourcePDF.name.replace(/\.pdf$/i, "");

        link.href = url;
        link.download = `${originalName}_InvisIA.pdf`;

        document.body.appendChild(link);

        link.click();
        link.remove();

        window.setTimeout(() => {
            URL.revokeObjectURL(url);
        }, 1000);
    });

    const clearFileButton = document.getElementById("clear-file-button");

    clearFileButton.addEventListener("click", () => {
        window.location.reload();
    });

    resetFileSelection();
});
/* ================= EldritchEcho ================= */
