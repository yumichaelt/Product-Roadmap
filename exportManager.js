// exportManager.js
// Handles formatting roadmap data and exporting to various formats (PDF, Word, PPT via API).

import { getStatuses } from './statusManager.js';
import { API_CONFIG } from './config.js';

// --- DOM Element References ---
const roadmapOutputDiv = document.getElementById('roadmap-output');
const roadmapNameInput = document.getElementById('roadmap-name');

// --- Internal Utility Functions ---

/**
 * Generates a formatted HTML string representing the current roadmap's body content (Milestone Structure).
 * This version focuses on the core milestone data suitable for embedding or API usage.
 * @returns {string} HTML string of the roadmap body content.
 */
function getFormattedRoadmapHtmlBody() {
  let combinedHtml = '';
  const milestoneSections = roadmapOutputDiv.querySelectorAll('.milestone-section');
  const statuses = getStatuses(); // Get current statuses for lookup

  milestoneSections.forEach(section => {
    const titleElement = section.querySelector('h3[contenteditable="true"]'); // Updated selector to h3
    const dateInputElement = section.querySelector('.milestone-date');
    const originalDateSpan = section.querySelector('.original-date-display');
    const itemsContainer = section.querySelector('.items-container');

    // Ensure essential elements exist before processing a milestone
    if (titleElement && dateInputElement && originalDateSpan && itemsContainer) {
      const milestoneTitle = titleElement.textContent?.trim() || 'Untitled Milestone';
      const currentTargetDate = dateInputElement.value;
      const originalTargetDate = originalDateSpan.dataset.originalDate;

      combinedHtml += `<h3>${milestoneTitle}</h3>`; // Use h3 for milestone titles

      // Format and add dates with basic styling
      let dateHtml = '<p style="font-size: 0.9em; color: #666; margin-top: -0.2em; margin-bottom: 0.8em;">';
      if (currentTargetDate) {
        dateHtml += `Target Date: ${currentTargetDate}`;
        // Show original date only if it exists and differs from the current target
        if (originalTargetDate && originalTargetDate !== currentTargetDate) {
          dateHtml += ` (Original: ${originalTargetDate})`;
        }
      } else if (originalTargetDate) {
        // Handle case where only original date exists (unlikely but possible)
        dateHtml += `Original Target: ${originalTargetDate}`;
      } else {
        dateHtml += 'Target Date: Not Set';
      }
      dateHtml += '</p>';
      combinedHtml += dateHtml;

      // Process checklist items
      const items = itemsContainer.querySelectorAll('.checklist-item');
      if (items.length > 0) {
        let itemsHtml = ''; // Build list items separately for clarity
        items.forEach(item => {
          const statusName = item.dataset.status || (statuses.length > 0 ? statuses[0].name : 'Unknown');
          const descriptionInput = item.querySelector('.item-description');
          const description = descriptionInput ? descriptionInput.value.trim() : '';

          // Find the status object, providing a fallback if not found
          const fallbackStatus = { name: statusName, icon: '❓' }; // Use actual name if possible
          const statusObj = statuses.find(s => s.name === statusName) || fallbackStatus;

          // Use template literal for the list item, including the emoji span
          // Ensure description is HTML-escaped if it could contain special characters (though input value should be safe)
          const escapedDescription = description.replace(/</g, "<").replace(/>/g, ">");
          itemsHtml += `<li><span aria-label="${statusObj.name}" style="margin-right: 5px; display: inline-block; width: 1.2em; text-align: center;">${statusObj.icon}</span> <strong>${statusObj.name}:</strong> ${escapedDescription || '(empty)'}</li>`;
        });
        combinedHtml += `<ul style="list-style: none; padding-left: 0;">${itemsHtml}</ul>`; // Basic list styling
      } else {
        combinedHtml += `<p><em>No items added for this milestone.</em></p>`;
      }
    } else {
        console.warn(`Skipping milestone section due to missing elements:`, section.id || section);
    }
    combinedHtml += `<hr style="margin: 1.5em 0; border: none; border-top: 1px solid #ccc;">`; // Separator
  });

  return combinedHtml;
}

/**
 * Triggers a browser download for a given Blob object.
 * @param {Blob} blob - The Blob data to download.
 * @param {string} filename - The desired filename for the download.
 */
function triggerDownload(blob, filename) {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.style.display = 'none'; // Hide the link
  a.href = url;
  a.download = filename;

  document.body.appendChild(a); // Append to body to ensure it's clickable
  a.click();

  // Clean up: remove the link and revoke the object URL
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}

// --- Export Functions ---

/**
 * Exports the roadmap (including legend) to PDF using html2pdf.js.
 * Exported for use by the main script's event listener.
 */
export function exportToPdf() {
  if (!roadmapOutputDiv || roadmapOutputDiv.children.length === 0) {
    alert('Please generate or load a roadmap first before exporting.');
    return;
  }

  // Get Roadmap Name for the document title and filename
  const roadmapName = roadmapNameInput?.value.trim() || 'Product Roadmap';
  const roadmapTitleHtml = roadmapName ? `<h1 style="text-align: center; margin-bottom: 1em;">${roadmapName}</h1>` : '';

  const statuses = getStatuses();

  // Create a simple HTML list for the status legend
  let legendHtml = '<h3 style="margin-top:0; font-size: 1.1em;">Status Legend:</h3><ul style="list-style: none; padding-left: 0; margin-bottom: 1.5em;">';
  statuses.forEach(s => {
    legendHtml += `<li style="margin-bottom: 0.3em;"><span aria-label="${s.name}" style="margin-right: 5px; display: inline-block; width: 1.2em; text-align: center;">${s.icon}</span> ${s.name}</li>`;
  });
  legendHtml += '</ul>';

  // Get the main roadmap content
  const roadmapBodyHtml = getFormattedRoadmapHtmlBody();

  // Combine title, legend, and roadmap body within a wrapper for PDF structure
  const combinedExportHtml = `
    <div id="export-content-wrapper" style="padding: 20px; font-family: sans-serif; line-height: 1.5;">
      ${roadmapTitleHtml}
      ${legendHtml}
      <hr style="margin: 1.5em 0; border: none; border-top: 1px solid #ccc;">
      <h2>Roadmap Milestones</h2>
      ${roadmapBodyHtml}
    </div>
  `;

  // Create the final full HTML structure needed by html2pdf
  const finalHtmlForPdf = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>${roadmapName}</title>
      <style>
        body { font-family: sans-serif; line-height: 1.5; }
        ul { list-style: none; padding-left: 0; }
        li { margin-bottom: 0.5em; }
        h1 { font-size: 1.8em; text-align: center; margin-bottom: 1em; }
        h2 { margin-top: 1.5em; margin-bottom: 0.8em; font-size: 1.4em; border-bottom: 1px solid #eee; padding-bottom: 0.2em; }
        h3 { margin-top: 1.5em; margin-bottom: 0.2em; font-size: 1.1em; border-bottom: 1px solid #eee; padding-bottom: 0.2em;}
        hr { margin: 1.5em 0; border: none; border-top: 1px solid #ccc; }
        p { margin-top: 0.5em; margin-bottom: 0.5em; }
      </style>
    </head>
    <body>
      ${combinedExportHtml}
    </body>
    </html>`;

  // html2pdf.js options
  const options = {
    margin: [0.5, 0.5, 0.5, 0.5], // inches [top, left, bottom, right]
    filename: `${roadmapName.replace(/[^a-z0-9]/gi, '_') || 'Roadmap'}_Milestones.pdf`, // Sanitize filename
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, logging: false, useCORS: true }, // Use CORS if loading external images (though unlikely here)
    jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
  };

  // Check if html2pdf library is loaded
  if (typeof html2pdf === 'undefined') {
      console.error("html2pdf library is not loaded. Cannot export to PDF.");
      alert("Error: PDF export library not found. Please check the console.");
      return;
  }

  // Perform the export
  try {
      html2pdf().set(options).from(finalHtmlForPdf).save()
          .then(() => {
              // Optional: Add success feedback if needed
          })
          .catch(err => {
              console.error("Error during PDF generation process:", err);
              alert("An error occurred while generating the PDF. Please check the console.");
          });
  } catch (err) {
       console.error("Error initializing html2pdf:", err);
       alert("An error occurred while setting up the PDF export. Please check the console.");
  }
}

/**
 * Generic function to handle exporting via a third-party API (e.g., for Word, PPT).
 * @param {string} formatName - User-friendly format name (e.g., "Word", "PowerPoint").
 * @param {object} apiDetails - Object containing { endpoint: string, key: string }.
 * @param {string} fileExtension - The file extension (e.g., "docx", "pptx").
 */
async function exportViaApi(formatName, apiDetails, fileExtension) {
  if (!roadmapOutputDiv || roadmapOutputDiv.children.length === 0) {
    alert('Please generate or load a roadmap first before exporting.');
    return;
  }
  // Validate API configuration
  if (!apiDetails || !apiDetails.endpoint || !apiDetails.key) {
    alert(`API configuration for ${formatName} export is missing or incomplete. Please check config.js.`);
    console.error(`Missing API config for ${formatName}:`, apiDetails);
    return;
  }

  // Get Roadmap Name and prepare title HTML
  const roadmapName = roadmapNameInput?.value.trim() || 'Product Roadmap';
  const titleHtml = roadmapName ? `<h1 style="text-align: center;">${roadmapName}</h1>\n` : '';

  // Get the main roadmap body content
  const roadmapBodyHtml = getFormattedRoadmapHtmlBody();

  // Combine title and body for the API payload
  // The API is expected to handle this combined HTML string.
  const finalHtmlToSend = titleHtml + roadmapBodyHtml;

  // Sanitize filename
  const filename = `${roadmapName.replace(/[^a-z0-9]/gi, '_') || 'Roadmap'}_Milestones.${fileExtension}`;

  alert(`Preparing ${formatName} export... This may take a moment.`);

  try {
    const response = await fetch(apiDetails.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Assuming Bearer token authentication based on original code
        'Authorization': `Bearer ${apiDetails.key}`
      },
      body: JSON.stringify({
        html: finalHtmlToSend, // Send the combined HTML string
        filename: filename     // Suggest filename to the API
      })
    });

    if (!response.ok) {
      // Attempt to read error details from the response body
      let errorBody = 'Could not read error body.';
      try {
          errorBody = await response.text();
      } catch (e) { /* Ignore reading error */ }
      throw new Error(`API request failed: ${response.status} ${response.statusText}. Response: ${errorBody}`);
    }

    // Assuming the API returns the file content as a blob
    const blob = await response.blob();

    // Check if the blob seems valid (basic check for non-zero size)
    if (!blob || blob.size === 0) {
        throw new Error("API returned an empty response.");
    }

    triggerDownload(blob, filename); // Initiate download

  } catch (error) {
    console.error(`Error exporting to ${formatName}:`, error);
    alert(`An error occurred while exporting to ${formatName}: ${error.message}. Please check the console and ensure the API endpoint/key in config.js are correct and the service is running.`);
  }
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
