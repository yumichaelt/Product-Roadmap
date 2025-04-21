// exportManager.js
// Handles formatting roadmap data and exporting to various formats (PDF, Word, PPT, API).

import { getStatuses } from './statusManager.js';
import { API_CONFIG } from './config.js';

// --- DOM Element References ---
// Reference needed by getFormattedRoadmapHtml to find the content
const roadmapOutputDiv = document.getElementById('roadmap-output');

// --- Data Formatting & Export ---

/**
 * Generates a formatted HTML string representing the current roadmap checklist.
 * @returns {string} HTML string suitable for export.
 */
function getFormattedRoadmapHtml() {
    // Get roadmap name for document title
    const roadmapNameInput = document.getElementById('roadmap-name');
    const docTitle = roadmapNameInput ? roadmapNameInput.value.trim() : 'Roadmap Export';

    let combinedHtml = '';
    // Use :scope > div to select only direct children divs of roadmapOutputDiv
    const periodContainers = roadmapOutputDiv.querySelectorAll(':scope > div');
    const statuses = getStatuses(); // Get current statuses for lookup

    periodContainers.forEach(container => {
        const headingElement = container.querySelector('.period-header h2');
        const itemsContainer = container.querySelector('.items-container');

        if (headingElement && itemsContainer) {
            const headingText = headingElement.textContent;
            const customTitle = container.dataset.customTitle || ''; // Retrieve custom title from data attribute

            combinedHtml += `<h3>${headingText}</h3>`; // Use h3 for period titles

            // Add the custom title if it exists
            if (customTitle) {
                combinedHtml += `<h4 style="font-weight: normal; font-style: italic; margin-top: 0; margin-bottom: 0.5em; color: #555;">${customTitle}</h4>`; // Added color
            }

            const items = itemsContainer.querySelectorAll('.checklist-item');
            if (items.length > 0) {
                let itemsHtml = ''; // Build list items separately
                items.forEach(item => {
                    const statusName = item.dataset.status || (statuses.length > 0 ? statuses[0].name : 'Unknown'); // Default if somehow missing
                    const descriptionInput = item.querySelector('.item-description');
                    const description = descriptionInput ? descriptionInput.value.trim() : '';

                    // Find the corresponding status object using the current statuses array
                    const fallbackStatus = statuses.length > 0 ? statuses[0] : { name: 'Unknown', icon: '❓' }; // Use icon property and default Emoji
                    const statusObj = statuses.find(s => s.name === statusName) || fallbackStatus;
                    // const statusIconClass = statusObj.iconClass; // Removed

                    // Use template literal for the list item, including the <span> tag for the emoji
                    // Added inline styles for better compatibility in exported formats
                    itemsHtml += `<li><span aria-label="${statusObj.name}" style="margin-right: 5px; display: inline-block; width: 1.2em; text-align: center;">${statusObj.icon}</span> <strong>${statusObj.name}:</strong> ${description || '(empty)'}</li>`; // Use span with emoji
                });
                // Use template literal for the unordered list
                combinedHtml += `<ul>${itemsHtml}</ul>`;
            } else {
                // Use template literal for the 'no items' paragraph
                combinedHtml += `<p><em>No items added for this period.</em></p>`;
            }
        }
        // Use template literal for the separator
        combinedHtml += `<hr style="margin: 1em 0; border-top: 1px solid #ccc;">`;
    });

    // Basic wrapper for styling using template literal
    // Added Font Awesome CDN link and basic styles for better export rendering
    return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>${docTitle}</title>
            <!-- Font Awesome link removed -->
            <style>
                body { font-family: sans-serif; line-height: 1.5; }
                ul { list-style: none; padding-left: 0; }
                li { margin-bottom: 0.5em; }
                h3 { margin-top: 1.5em; margin-bottom: 0.5em; border-bottom: 1px solid #eee; padding-bottom: 0.2em;}
                hr { margin: 1em 0; border-top: 1px solid #ccc; }
                /* Font Awesome CSS rule removed */
            </style>
        </head>
        <body>
            ${combinedHtml}
        </body>
        </html>`;
}

/**
 * Exports the roadmap (including legend) to PDF using html2pdf.js.
 * Exported for use by the main script's event listener.
 */
export function exportToPdf() {
    if (!roadmapOutputDiv || roadmapOutputDiv.children.length === 0) {
        alert('Please generate a roadmap first before exporting.');
        return;
    }

    // Get Roadmap Name
    const roadmapNameInput = document.getElementById('roadmap-name');
    const roadmapName = roadmapNameInput ? roadmapNameInput.value.trim() : 'Product Roadmap';
    const roadmapTitleHtml = roadmapName ? `<h1 style="text-align: center; margin-bottom: 1em;">${roadmapName}</h1>` : '';

    const statuses = getStatuses(); // Get current statuses

    // Create a simple list representation for the legend
    let legendHtml = '<h3 style="margin-top:0;">Status Legend:</h3><ul>';
    statuses.forEach(s => {
        // Include Emoji icon in the exported legend HTML using a span
        legendHtml += `<li><span aria-label="${s.name}" style="margin-right: 5px; display: inline-block; width: 1.2em; text-align: center;">${s.icon}</span> ${s.name}</li>`; // Use span with emoji
    });
    legendHtml += '</ul>';
    // Removed Font Awesome note


    const roadmapHtmlContent = getFormattedRoadmapHtml(); // Get the full HTML document string

    // We need to parse the body content from the full HTML string for html2pdf
    const parser = new DOMParser();
    const doc = parser.parseFromString(roadmapHtmlContent, 'text/html');
    const roadmapBodyHtml = doc.body.innerHTML; // Extract only the body content

    const combinedExportHtml = `
        <div id="export-content-wrapper" style="padding: 20px; font-family: sans-serif; line-height: 1.5;">
            ${roadmapTitleHtml}
            ${legendHtml}
            <hr style="margin: 20px 0; border-top: 1px solid #ccc;">
            <h2>Roadmap Items</h2>
            ${roadmapBodyHtml}
        </div>
    `;

    // Include Font Awesome CSS within the HTML for html2pdf to potentially use
    const finalHtmlForPdf = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>${roadmapName}</title>
            <!-- Font Awesome link removed -->
            <style>
                body { font-family: sans-serif; line-height: 1.5; }
                ul { list-style: none; padding-left: 0; }
                li { margin-bottom: 0.5em; }
                h2 { margin-top: 1.5em; margin-bottom: 0.5em; }
                h3 { margin-top: 1.5em; margin-bottom: 0.5em; border-bottom: 1px solid #eee; padding-bottom: 0.2em;}
                hr { margin: 1em 0; border-top: 1px solid #ccc; }
                /* Font Awesome CSS rule removed */
            </style>
        </head>
        <body>
            ${combinedExportHtml}
        </body>
        </html>`;


    const options = {
      margin: [0.5, 0.5, 0.5, 0.5], // inches
      filename: 'ProductRoadmap_Checklist.pdf',
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, logging: false, useCORS: true }, // Disable logging unless debugging
      jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' },
      // Attempt to embed Font Awesome - may require CORS setup or proxy if CDN blocks direct fetching
      // enableLinks: true // Might help with external resources like fonts
    };

    console.log("Starting PDF generation (client-side)...");
    // Use the full HTML string with embedded styles and FA link
    html2pdf().set(options).from(finalHtmlForPdf).save().then(() => {
        console.log("PDF generation complete.");
    }).catch(err => {
        console.error("Error generating PDF:", err);
        alert("An error occurred while generating the PDF. Icons might not render correctly. Please check the console.");
    });
}

/**
 * Initiates export to Word via API.
 * Exported for use by the main script's event listener.
 */
export function exportToWord() {
    exportViaApi('Word', API_CONFIG.WORD, 'docx');
}

/**
 * Initiates export to PowerPoint via API.
 * Exported for use by the main script's event listener.
 */
export function exportToPpt() {
    exportViaApi('PowerPoint', API_CONFIG.PPT, 'pptx');
}

/**
 * Generic function to handle exporting via a third-party API.
 * @param {string} formatName - The user-friendly format name (e.g., "Word", "PowerPoint").
 * @param {object} apiDetails - Object containing { endpoint: string, key: string }.
 * @param {string} fileExtension - The file extension (e.g., "docx", "pptx").
 */
async function exportViaApi(formatName, apiDetails, fileExtension) {
    if (!roadmapOutputDiv || roadmapOutputDiv.children.length === 0) {
        alert('Please generate a roadmap first before exporting.');
        return;
    }

    const htmlContent = getFormattedRoadmapHtml(); // Get the full HTML document string

    // Get Roadmap Name and prepend it to the HTML body for API export
    const roadmapNameInput = document.getElementById('roadmap-name');
    const roadmapName = roadmapNameInput ? roadmapNameInput.value.trim() : 'Product Roadmap';
    const titleHtml = roadmapName ? `<h1 style="text-align: center;">${roadmapName}</h1>\n` : '';
    const finalHtmlToSend = htmlContent.replace('<body>', `<body>\n${titleHtml}`);

    const filename = `ProductRoadmap_Checklist.${fileExtension}`;

    console.log(`Starting ${formatName} (.${fileExtension}) generation via API...`);
    alert(`Preparing ${formatName} export... This may take a moment and requires a configured API.`);

    try {
        const response = await fetch(apiDetails.endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiDetails.key}` // Example: Bearer token
            },
            body: JSON.stringify({
                html: finalHtmlToSend, // Use the modified HTML with the title
                filename: filename
            })
        });

        if (!response.ok) {
            const errorBody = await response.text().catch(() => 'Could not read error body');
            throw new Error(`API request failed: ${response.status} ${response.statusText}. Response: ${errorBody}`);
        }

        const blob = await response.blob();
        triggerDownload(blob, filename);
        console.log(`${formatName} (.${fileExtension}) generation successful.`);

    } catch (error) {
        console.error(`Error exporting to ${formatName}:`, error);
        alert(`An error occurred while exporting to ${formatName}: ${error.message}. Please check the console and ensure your API endpoint/key are correct.`);
    }
}

// --- Utility Functions ---

/**
 * Triggers a browser download for a given Blob object.
 * @param {Blob} blob - The Blob data to download.
 * @param {string} filename - The desired filename for the download.
 */
function triggerDownload(blob, filename) {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = filename;

    document.body.appendChild(a);
    a.click();

    // Clean up
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
}
