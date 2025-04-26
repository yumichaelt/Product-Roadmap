// script.js
// Main entry point for the Roadmap Generator application.
// Initializes the app, handles save/load, and wires up event listeners.

import {
    renderStatusLegend,
    populateEmojiGrid,
    handleStatusLegendChange,
    handleLegendClick,
    handleAddStatusClick,
    closeEmojiPopupOnClickOutside,
    getStatuses,
} from './statusManager.js';

import {
    generateRoadmap,
    addMilestoneSection,
    handleRoadmapInteraction
} from './roadmapUi.js';

import {
    exportToPdf,
    exportToWord,
    exportToPpt
} from './exportManager.js';

// --- DOM Element References ---
// General UI
const generateButton = document.getElementById('generate-roadmap'); // Manual "Start New Roadmap"
const exportButtonsContainer = document.getElementById('export-buttons-container');
const exportPdfButton = document.getElementById('export-pdf');
const exportWordButton = document.getElementById('export-word');
const exportPptButton = document.getElementById('export-ppt');
const roadmapOutputDiv = document.getElementById('roadmap-output');
const editableStatusListDiv = document.getElementById('editable-status-list');
const addStatusBtn = document.getElementById('add-status-button');
const addMilestoneBtn = document.getElementById('add-milestone-btn');
const exportableContentDiv = document.getElementById('exportable-content');
const roadmapNameInput = document.getElementById('roadmap-name');
const saveButton = document.getElementById('save-roadmap-button');
const loadButton = document.getElementById('load-roadmap-button');
const saveLoadStatusSpan = document.getElementById('saveLoadStatus');
// AI Related UI
const aiPromptInput = document.getElementById('ai-prompt-input');
const generateAiButton = document.getElementById('generate-ai-roadmap-btn');
const aiButtonSpinner = document.querySelector('#generate-ai-roadmap-btn .spinner-border'); // More specific selector
const aiStatusMessage = document.getElementById('ai-status-message');
const roadmapPlaceholder = document.getElementById('roadmap-placeholder');


// --- Constants ---
const ROADMAP_STORAGE_KEY = 'roadmapGeneratorState_v2'; // Key for milestone-based format
const BACKEND_API_URL = 'http://localhost:3000/api/generate-roadmap';

// --- Utility Functions ---

/**
 * Debounce function: Limits the rate at which a function can fire.
 * @param {Function} func - The function to debounce.
 * @param {number} wait - The number of milliseconds to delay.
 * @returns {Function} The debounced function.
 */
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// --- Save/Load Functionality ---

/**
 * Updates the status message span.
 * @param {string} message - The message to display.
 * @param {boolean} [isError=false] - If true, style as an error.
 * @param {number} [timeout=3000] - Duration before clearing the message (0 for persistent).
 */
function updateStatusMessage(message, isError = false, timeout = 3000) {
  if (saveLoadStatusSpan) {
    saveLoadStatusSpan.textContent = message;
    saveLoadStatusSpan.style.color = isError ? '#f87171' : '#9ca3af'; // Tailwind red-400 / gray-400
    if (timeout > 0) {
      setTimeout(() => {
        // Only clear if the message hasn't changed in the meantime
        if (saveLoadStatusSpan.textContent === message) {
          saveLoadStatusSpan.textContent = '';
        }
      }, timeout);
    }
  } else {
    console.warn("Save/Load status span not found.");
  }
}

/**
 * Updates the AI status message span.
 * @param {string} message - The message to display.
 * @param {boolean} [isError=false] - If true, style as an error (red).
 * @param {number} [timeout=5000] - Duration before clearing the message (0 for persistent).
 */
function updateAiStatusMessage(message, isError = false, timeout = 5000) {
    if (aiStatusMessage) {
        aiStatusMessage.textContent = message;
        aiStatusMessage.style.color = isError ? '#dc2626' : 'inherit'; // Tailwind red-600 or default
        aiStatusMessage.classList.toggle('text-red-600', isError); // Optional: Add class for more styling
        aiStatusMessage.classList.toggle('text-green-600', !isError && message.includes('generated')); // Green for success

        if (timeout > 0) {
            setTimeout(() => {
                if (aiStatusMessage.textContent === message) {
                    aiStatusMessage.textContent = '';
                    aiStatusMessage.style.color = 'inherit';
                    aiStatusMessage.classList.remove('text-red-600', 'text-green-600');
                }
            }, timeout);
        }
    } else {
        console.warn("AI status message element not found.");
    }
}


/**
 * Reads the current state of the roadmap from the DOM (Milestone Structure).
 * @returns {object | null} A serializable object representing the roadmap state, or null if essential elements are missing.
 */
function getCurrentRoadmapState() {
  if (!roadmapNameInput || !roadmapOutputDiv) {
    console.error("Cannot get state: Roadmap name input or output div not found.");
    return null;
  }

  const state = {
    roadmapName: roadmapNameInput.value || '',
    milestones: []
  };

  const milestoneElements = roadmapOutputDiv.querySelectorAll('.milestone-section');

  milestoneElements.forEach((milestoneEl, milestoneIndex) => {
    const titleEl = milestoneEl.querySelector('h4[contenteditable="true"]'); // Corrected selector from h3 to h4
    const dateInput = milestoneEl.querySelector('.milestone-date');
    const originalDateSpan = milestoneEl.querySelector('.original-date-display');
    const itemsContainer = milestoneEl.querySelector('.items-container');
    const purposeEl = milestoneEl.querySelector('.milestone-purpose[contenteditable="true"]'); // Added purpose element query

    // Basic validation for essential elements within a milestone
    if (!titleEl || !dateInput || !originalDateSpan || !itemsContainer) {
      console.warn(`Skipping milestone ${milestoneEl.id || `(index ${milestoneIndex})`} due to missing internal elements.`);
      return; // Skip this milestone
    }

    const originalDateFromDataset = originalDateSpan.dataset.originalDate || '';

    const milestoneData = {
      id: milestoneEl.id,
      title: titleEl.textContent || `Milestone ${milestoneIndex + 1}`, // Use textContent, provide fallback
      purpose: purposeEl ? purposeEl.textContent : '', // Read purpose text, fallback to empty string
      currentCompletionDate: dateInput.value || '',
      originalCompletionDate: originalDateFromDataset,
      items: []
    };

    const itemElements = itemsContainer.querySelectorAll('.checklist-item');
    itemElements.forEach((itemEl, itemIndex) => {
      const descriptionInput = itemEl.querySelector('.item-description');
      const status = itemEl.dataset.status; // Get status from data attribute

      if (!descriptionInput || typeof status === 'undefined') {
        console.warn("Skipping item due to missing description or status:", itemEl);
        return; // Skip this item
      }

      milestoneData.items.push({
        // Simple unique ID for items within the milestone (useful for potential future features)
        id: `item-${milestoneData.id}-${itemIndex + 1}`,
        text: descriptionInput.value || '',
        status: status || 'Not Started' // Provide a default status if somehow missing
      });
    });

    state.milestones.push(milestoneData);
  });

  return state;
}


/**
 * Performs the actual save operation to localStorage.
 * Saves the roadmap configuration. Statuses are saved separately by statusManager.
 * @param {boolean} [isAutoSave=false] - Indicates if this is an automatic save.
 */
function performSave(isAutoSave = false) {
  if (!isAutoSave) {
    updateStatusMessage("Saving...", false, 0); // Show persistent "Saving..." for manual save
  }

  const currentRoadmapState = getCurrentRoadmapState();
  if (!currentRoadmapState) {
      updateStatusMessage("Save failed: Could not read roadmap state.", true);
      return; // Don't proceed if state reading failed
  }

  try {
    // Save Roadmap State
    const roadmapStateJson = JSON.stringify(currentRoadmapState);
    localStorage.setItem(ROADMAP_STORAGE_KEY, roadmapStateJson);

    // Status configuration is saved automatically by statusManager.js when statuses change.

    if (!isAutoSave) {
      updateStatusMessage("Roadmap saved!", false);
    }
  } catch (error) {
    console.error("Error saving state to localStorage:", error);
    const message = isAutoSave ? "Autosave error." : "Error saving!";
    updateStatusMessage(message, true);
    if (!isAutoSave) {
        alert("Error saving data. Please check the console for details.");
    }
  }
}

// --- AI Roadmap Generation ---

/**
 * Handles the click event for the "Generate with AI" button.
 * Fetches roadmap data from the backend based on user input.
 */
async function handleGenerateAiRoadmap() {
    if (!aiPromptInput || !generateAiButton || !aiButtonSpinner || !aiStatusMessage || !roadmapOutputDiv || !roadmapPlaceholder || !roadmapNameInput) {
        console.error("AI generation cannot proceed: One or more required UI elements are missing.");
        updateAiStatusMessage("Internal error: UI elements missing.", true);
        return;
    }

    const projectDescription = aiPromptInput.value.trim();

    // 1. Input Validation
    if (!projectDescription) {
        updateAiStatusMessage("Please enter a project description first.", true, 3000);
        aiPromptInput.focus();
        return;
    }

    // 2. Set Loading State
    generateAiButton.disabled = true;
    aiButtonSpinner.classList.remove('d-none'); // Show spinner
    updateAiStatusMessage("Generating roadmap with AI...", false, 0); // Persistent message

    try {
        // 3. Fetch Call
        const response = await fetch(BACKEND_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ projectDescription: projectDescription }),
        });

        // 4. Handle Response
        if (response.ok) {
            const data = await response.json();

            // --- Success ---
            console.log("AI Response Data:", data);

            // Clear Existing Roadmap (if user confirms)
            if (roadmapOutputDiv.children.length > 0) {
                if (!confirm("Generating with AI will replace the current roadmap. Continue?")) {
                    updateAiStatusMessage("AI generation cancelled.", false);
                    return; // Exit if user cancels
                }
            }
            roadmapOutputDiv.innerHTML = ''; // Clear current roadmap UI

            // Hide Placeholder
            roadmapPlaceholder.classList.add('d-none');

            // Render New Roadmap
            roadmapNameInput.value = data.roadmapName || 'AI Generated Roadmap'; // Set name

            if (data.milestones && Array.isArray(data.milestones)) {
                data.milestones.forEach(milestoneData => {
                    addMilestoneSection(milestoneData); // Render each milestone
                });
            } else {
                console.warn("AI response missing milestones array.");
                updateAiStatusMessage("AI generated data, but it seems incomplete (no milestones).", true);
            }

            updateAiStatusMessage("Roadmap generated successfully!", false, 5000); // Success message

            // Save the new state
            debouncedAutoSave();

        } else {
            // --- Backend Error ---
            let errorMsg = 'Unknown backend error occurred.';
            try {
                const errorData = await response.json();
                errorMsg = errorData.error || `Server responded with status ${response.status}`;
                console.error("Backend Error Response:", errorData);
            } catch (e) {
                console.error("Could not parse backend error response:", e);
                errorMsg = `Server responded with status ${response.status}, but error details couldn't be read.`;
            }
            updateAiStatusMessage(errorMsg, true); // Show backend error
        }

    } catch (error) {
        // --- Network/Fetch Error ---
        console.error("Error fetching AI roadmap:", error);
        updateAiStatusMessage("Network error or server unreachable. Please check the backend server.", true);
    } finally {
        // 5. Reset Loading State
        generateAiButton.disabled = false;
        aiButtonSpinner.classList.add('d-none'); // Hide spinner
        // Clear persistent "Generating..." message only if no other message replaced it
        if (aiStatusMessage.textContent === "Generating roadmap with AI...") {
             updateAiStatusMessage('', false, 0); // Clear it
        }
    }
}


/**
 * Handles the click event for the manual save button.
 */
function handleManualSaveClick() {
  performSave(false); // Call as manual save
}

// --- Debounced Autosave ---
// Exported so roadmapUi.js can trigger it on interactions that modify the state.
export const debouncedAutoSave = debounce(() => {
  performSave(true); // Call performSave indicating it's an autosave
}, 2500); // 2.5-second debounce delay


/**
 * Renders the roadmap UI based on loaded milestone data.
 * Includes validation for the data format and placeholder visibility.
 * @param {object} data - The roadmap state object loaded from storage.
 * @returns {boolean} True if rendering was successful, false otherwise.
 */
function renderRoadmapFromData(data) {
  if (!roadmapNameInput || !roadmapOutputDiv || !addMilestoneBtn || !exportButtonsContainer || !roadmapPlaceholder) {
    console.error("Cannot render from data: Required UI elements not found.");
    return false;
  }

  // --- Data Format Validation ---
  if (!data || typeof data !== 'object') {
    console.error("Invalid data format: Data is null or not an object.");
    alert("Error: Could not load data due to invalid format.");
    return false;
  }
  // Check for the OLD format (presence of 'periods') - Provide helpful message
  if (data.periods && Array.isArray(data.periods)) {
    console.warn("Detected old data format (with 'periods'). Cannot load.");
    alert("Incompatible Data: Your previously saved roadmap uses an old format and cannot be loaded with this version. Please create a new roadmap. Your old data might still be in localStorage under the key 'roadmapGeneratorState'.");
    // Optionally offer to clear old data (consider user experience)
    // if (confirm("Do you want to remove the old incompatible data from storage?")) {
    //     localStorage.removeItem('roadmapGeneratorState');
    //     alert("Old data removed.");
    // }
    return false; // Stop rendering
  }
  // Check for the NEW format (presence of 'milestones')
  if (!data.milestones || !Array.isArray(data.milestones)) {
    // Allow loading if it's just an empty roadmap from the new version (only name)
    if (Object.keys(data).length === 1 && data.hasOwnProperty('roadmapName')) {
       data.milestones = []; // Ensure milestones array exists for iteration
    } else {
      console.error("Invalid data format: 'milestones' array is missing or not an array.");
      alert("Error: Could not load data. The 'milestones' array is missing or invalid in the saved data.");
      return false; // Stop rendering
    }
  }
  // --- End Validation ---

  // Clear existing content before rendering
  roadmapOutputDiv.innerHTML = '';

  // Restore global state (roadmap name)
  roadmapNameInput.value = data.roadmapName || '';

  // Render milestones using the UI function
  if (data.milestones.length > 0) {
    data.milestones.forEach(milestoneData => {
      // addMilestoneSection handles creating the element and appending it
      addMilestoneSection(milestoneData);
    });
    // Buttons visibility is handled within addMilestoneSection
  } else {
    // No milestones, ensure buttons are hidden
    exportButtonsContainer.classList.add('hidden');
    addMilestoneBtn.classList.add('hidden');
    // Consider adding a placeholder message in roadmapOutputDiv?
    // Show placeholder if no milestones
    roadmapPlaceholder.classList.remove('d-none');
  }

  return true; // Indicate success
}

/**
 * Loads roadmap state from localStorage (using the new key) and renders it.
 */
function loadRoadmapState() {
  updateStatusMessage("Loading...", false, 0); // Show Loading...
  const stateJson = localStorage.getItem(ROADMAP_STORAGE_KEY);

  if (!stateJson) {
    updateStatusMessage("No saved data found.", false);
    // Clear the roadmap area and show placeholder if nothing is loaded
    roadmapOutputDiv.innerHTML = '';
    roadmapNameInput.value = '';
    exportButtonsContainer.classList.add('hidden');
    addMilestoneBtn.classList.add('hidden');
    if (roadmapPlaceholder) roadmapPlaceholder.classList.remove('d-none'); // Show placeholder
    return;
  }

  try {
    const loadedState = JSON.parse(stateJson);
    const renderSuccess = renderRoadmapFromData(loadedState); // Calls validation internally

    if (renderSuccess) {
      updateStatusMessage("Roadmap loaded!", false);
    } else {
      // renderRoadmapFromData handles specific alerts for incompatible/invalid data
      updateStatusMessage("Load failed.", true); // General failure message
      // Clear the UI and show placeholder if loading failed after parsing
      roadmapOutputDiv.innerHTML = '';
      roadmapNameInput.value = '';
      exportButtonsContainer.classList.add('hidden');
      addMilestoneBtn.classList.add('hidden');
      if (roadmapPlaceholder) roadmapPlaceholder.classList.remove('d-none'); // Show placeholder
    }
  } catch (error) {
    updateStatusMessage("Error loading data!", true);
    console.error("Error parsing roadmap state (v2) from localStorage:", error);
    alert("Error parsing saved data. It might be corrupted. See console for details.");
    // Clear the UI and show placeholder on parsing error
    roadmapOutputDiv.innerHTML = '';
    roadmapNameInput.value = '';
    exportButtonsContainer.classList.add('hidden');
    addMilestoneBtn.classList.add('hidden');
    if (roadmapPlaceholder) roadmapPlaceholder.classList.remove('d-none'); // Show placeholder
  }
}

/**
 * Attempts to automatically load saved state on page load.
 * Loads statuses first, then roadmap data.
 */
function attemptAutoLoad() {
  // 1. Load Statuses FIRST (essential for rendering items correctly)
  renderStatusLegend(); // Render the legend
  populateEmojiGrid(); // Populate emoji grid based on loaded/default statuses

  // 2. Load Roadmap Data (using the new key)
  const stateJson = localStorage.getItem(ROADMAP_STORAGE_KEY);
  if (stateJson) {
    // Use loadRoadmapState which includes parsing, validation, rendering, and feedback
    loadRoadmapState();
  } else {
    // No saved roadmap state found, ensure buttons are hidden and placeholder is shown
    exportButtonsContainer.classList.add('hidden');
    addMilestoneBtn.classList.add('hidden');
    if (roadmapPlaceholder) roadmapPlaceholder.classList.remove('d-none'); // Show placeholder
  }
}


// --- Initialization & Event Listeners ---

/**
 * Initializes the application: sets up UI and attaches event listeners.
 */
function initializeApp() {
  // Ensure export/add buttons are hidden initially (attemptAutoLoad will show them if needed)
  if (exportButtonsContainer) exportButtonsContainer.classList.add('hidden');
  if (addMilestoneBtn) addMilestoneBtn.classList.add('hidden');
  // Ensure placeholder is hidden initially (attemptAutoLoad will show it if needed)
  if (roadmapPlaceholder) roadmapPlaceholder.classList.add('d-none');
  // Ensure AI spinner is hidden initially
  if (aiButtonSpinner) aiButtonSpinner.classList.add('d-none');


  // --- Attach Event Listeners ---

  // Generate Button (Clears and adds first milestone)
  if (generateButton) {
    generateButton.addEventListener('click', () => {
      // Confirm if roadmap already has content
      if (roadmapOutputDiv.children.length > 0) {
        if (!confirm("This will clear the current roadmap and start a new one. Continue?")) {
          return;
        }
      }
      generateRoadmap(); // Call the UI function to clear and add the first milestone
      if (roadmapPlaceholder) roadmapPlaceholder.classList.add('d-none'); // Hide placeholder on manual start
      debouncedAutoSave(); // Save the initial state
    });
  } else {
    console.error("Manual 'Start New Roadmap' button element not found.");
  }

  // Add Milestone Button
  if (addMilestoneBtn) {
    addMilestoneBtn.addEventListener('click', () => {
      addMilestoneSection(); // Call UI function to add a new milestone
      debouncedAutoSave(); // Save after adding
    });
  } else {
    console.error("Add Milestone button element not found.");
  }

  // Export Buttons
  if (exportPdfButton) exportPdfButton.addEventListener('click', exportToPdf);
  if (exportWordButton) exportWordButton.addEventListener('click', exportToWord);
  if (exportPptButton) exportPptButton.addEventListener('click', exportToPpt);

  // Delegated listeners for interactions within the main content area (#exportable-content)
  if (exportableContentDiv) {
    // roadmapUi.js's handleRoadmapInteraction is responsible for identifying the specific
    // interaction (add item, delete item, edit text, change status, etc.)
    // and triggering debouncedAutoSave when necessary.
    exportableContentDiv.addEventListener('click', handleRoadmapInteraction);
    exportableContentDiv.addEventListener('change', handleRoadmapInteraction);
    exportableContentDiv.addEventListener('input', handleRoadmapInteraction);

    // Use capture phase for blur to catch events on elements that might lose focus
    // before the event bubbles up (like contenteditable).
    // handleRoadmapInteraction in roadmapUi.js needs to check event.target
    // to determine if the blur occurred on a relevant element (title, date input).
    exportableContentDiv.addEventListener('blur', handleRoadmapInteraction, true); // Use capture phase

  } else {
    console.error("Exportable content container element (#exportable-content) not found.");
  }

  // Listeners for the editable status legend
  if (editableStatusListDiv) {
    editableStatusListDiv.addEventListener('input', handleStatusLegendChange); // Handles name changes
    editableStatusListDiv.addEventListener('click', handleLegendClick);      // Handles emoji/remove clicks
  } else {
    console.error("Editable status list container element not found.");
  }

  // Listener for the "Add Status" button
  if (addStatusBtn) {
    addStatusBtn.addEventListener('click', handleAddStatusClick);
  } else {
    console.error("Add status button element not found.");
  }

  // Listener to close emoji popup on outside click (capture phase recommended)
  document.addEventListener('click', closeEmojiPopupOnClickOutside, true);

  // Save/Load Buttons
  if (saveButton) saveButton.addEventListener('click', handleManualSaveClick);
  if (loadButton) loadButton.addEventListener('click', loadRoadmapState);

  // Listener for roadmap name changes to trigger autosave
  if (roadmapNameInput) {
      roadmapNameInput.addEventListener('input', debouncedAutoSave);
  }

  // Listener for AI Generate Button
  if (generateAiButton) {
      generateAiButton.addEventListener('click', handleGenerateAiRoadmap);
  } else {
      console.error("Generate AI button element not found.");
  }

  // Attempt to auto-load saved state AFTER setting up listeners
  attemptAutoLoad();

  // Final check for placeholder visibility after load attempt
  if (roadmapPlaceholder && roadmapOutputDiv && roadmapOutputDiv.children.length === 0) {
      roadmapPlaceholder.classList.remove('d-none');
  } else if (roadmapPlaceholder) {
      roadmapPlaceholder.classList.add('d-none');
  }

}

// --- Start the App ---
// Ensure the DOM is fully loaded before initializing the app
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});
