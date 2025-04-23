// script.js
// Main entry point for the Roadmap Generator application.
// Initializes the app and wires up event listeners using imported modules.

import {
    renderStatusLegend,
    populateEmojiGrid, // Added import for grid population
    handleStatusLegendChange,
    handleLegendClick,
    handleAddStatusClick,
    closeEmojiPopupOnClickOutside, // Added back import for popup closing
    getStatuses                // Added import
} from './statusManager.js';

import {
    generateRoadmap,
    handleRoadmapInteraction,
    createSegmentElement,      // Added import
    createChecklistItemElement // Added import
} from './roadmapUi.js';

import {
    exportToPdf,
    exportToWord,
    exportToPpt
} from './exportManager.js';

// --- DOM Element References (Essential for Initialization/Listeners) ---
const completionDateInput = document.getElementById('completion-date');
const generateButton = document.getElementById('generate-roadmap');
const exportButtonsContainer = document.getElementById('export-buttons-container');
const exportPdfButton = document.getElementById('export-pdf');
const exportWordButton = document.getElementById('export-word');
const exportPptButton = document.getElementById('export-ppt');
const roadmapOutputDiv = document.getElementById('roadmap-output');
const editableStatusListDiv = document.getElementById('editable-status-list');
const addStatusBtn = document.getElementById('add-status-button');
const addIncrementButton = document.getElementById('add-increment-button'); // Added button reference
const exportableContentDiv = document.getElementById('exportable-content'); // Added container reference
const roadmapNameInput = document.getElementById('roadmap-name'); // Added roadmap name input reference
const saveButton = document.getElementById('save-roadmap-button'); // Added save button reference
const loadButton = document.getElementById('load-roadmap-button'); // Added load button reference
const saveLoadStatusSpan = document.getElementById('saveLoadStatus'); // Added status span reference
// const themeToggle = document.getElementById('theme-toggle'); // Removed theme toggle reference

// --- Theme Switching Logic Removed ---

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

const LOCAL_STORAGE_KEY = 'roadmapGeneratorState';

/**
 * Updates the status message span.
 * @param {string} message - The message to display.
 * @param {boolean} [isError=false] - If true, style as an error.
 * @param {number} [timeout=3000] - Duration before clearing the message.
 */
function updateStatusMessage(message, isError = false, timeout = 3000) {
    if (saveLoadStatusSpan) {
        saveLoadStatusSpan.textContent = message;
        saveLoadStatusSpan.style.color = isError ? '#f87171' : '#9ca3af'; // Use Tailwind red-400 and gray-400
        // Clear the message after the specified timeout
        if (timeout > 0) {
            setTimeout(() => {
                if (saveLoadStatusSpan.textContent === message) { // Only clear if it hasn't changed
                    saveLoadStatusSpan.textContent = '';
                }
            }, timeout);
        }
    } else {
        console.warn("Save/Load status span not found.");
    }
}

/**
 * Reads the current state of the roadmap from the DOM.
 * @returns {object | null} A serializable object representing the roadmap state, or null if essential elements are missing.
 */
function getCurrentRoadmapState() {
    console.log("Getting current roadmap state...");
    if (!roadmapNameInput || !roadmapOutputDiv) {
        console.error("Cannot get state: Roadmap name input or output div not found.");
        return null;
    }

    const state = {
        roadmapName: roadmapNameInput.value || '',
        nextSegmentStartDate: roadmapOutputDiv.dataset.nextSegmentStartDate || null,
        incrementType: roadmapOutputDiv.dataset.incrementType || null,
        periods: []
    };

    const periodElements = roadmapOutputDiv.querySelectorAll('.p-4.mb-4'); // Selector for period containers

    periodElements.forEach(periodEl => {
        const header = periodEl.querySelector('.period-header');
        const segmentNameEl = header?.querySelector('h2');
        const customTitleInput = header?.querySelector('.period-custom-title');
        const itemsContainer = periodEl.querySelector('.items-container');

        if (!segmentNameEl || !customTitleInput || !itemsContainer) {
            console.warn("Skipping period due to missing elements:", periodEl);
            return; // Skip this period if essential parts are missing
        }

        const periodData = {
            segmentName: segmentNameEl.textContent,
            // Use dataset value if available (from load), otherwise input value
            customTitle: periodEl.dataset.customTitle || customTitleInput.value || '',
            items: []
        };

        const itemElements = itemsContainer.querySelectorAll('.checklist-item');
        itemElements.forEach(itemEl => {
            const descriptionInput = itemEl.querySelector('.item-description');
            const status = itemEl.dataset.status; // Get status from data attribute

            if (!descriptionInput || !status) {
                console.warn("Skipping item due to missing elements:", itemEl);
                return; // Skip this item
            }

            periodData.items.push({
                description: descriptionInput.value || '',
                status: status
            });
        });

        state.periods.push(periodData);
    });

    console.log("Current state captured:", state);
    return state;
}

/**
 * Performs the actual save operation to localStorage.
 * Handles feedback and error reporting differently for auto vs manual saves.
 * @param {boolean} [isAutoSave=false] - Indicates if this is an automatic save.
 */
function performSave(isAutoSave = false) {
    if (!isAutoSave) {
        console.log("Performing manual save...");
        updateStatusMessage("Saving...", false, 0); // Show "Saving..." indefinitely until success/error
    } else {
        console.log("Performing autosave...");
        // No "Saving..." message for autosave
    }

    const currentState = getCurrentRoadmapState();

    // Handle potentially empty state - save null or remove key? Saving null is simpler.
    // if (!currentState || (currentState.periods.length === 0 && !currentState.roadmapName)) {
    //     localStorage.removeItem(LOCAL_STORAGE_KEY);
    //     if (!isAutoSave) updateStatusMessage("Roadmap cleared and saved.", false);
    //     else updateStatusMessage("Changes saved.", false, 1500); // Short confirmation for autosave clear
    //     console.log("Roadmap state is empty, cleared localStorage.");
    //     return;
    // }

    try {
        const stateJson = JSON.stringify(currentState); // currentState can be null here if function returned null
        localStorage.setItem(LOCAL_STORAGE_KEY, stateJson);

        if (!isAutoSave) {
            updateStatusMessage("Roadmap saved!", false); // Longer confirmation for manual save
            console.log("Manual save successful.");
        } else {
            updateStatusMessage("Changes saved.", false, 1500); // Shorter confirmation for autosave
            console.log("Autosave successful.");
        }
    } catch (error) {
        console.error("Error saving roadmap state to localStorage:", error);
        if (!isAutoSave) {
            // Only show alert for manual save failure
            alert("Error saving roadmap data. Please check the console for details.");
            updateStatusMessage("Error saving!", true);
        } else {
            // Log error for autosave, maybe show subtle feedback?
            updateStatusMessage("Autosave error.", true, 2000);
        }
    }
}

/**
 * Handles the click event for the manual save button.
 * Includes overwrite confirmation.
 */
function handleManualSaveClick() {
    console.log("Manual save button clicked.");

    // Check for existing data and confirm overwrite
    if (localStorage.getItem(LOCAL_STORAGE_KEY)) {
        if (!confirm("Saved roadmap data already exists. Overwrite?")) {
            updateStatusMessage("Save cancelled.");
            console.log("Save cancelled by user.");
            return; // Stop if user cancels
        }
        console.log("User confirmed overwrite.");
    }

    // Proceed with the save if no existing data or user confirmed overwrite
    performSave(false); // Explicitly call as manual save
}

// --- Debounced Autosave ---
const debouncedAutoSave = debounce(() => {
    performSave(true); // Call performSave indicating it's an autosave
}, 5000); // 5-second debounce delay

// Make it globally accessible for statusManager.js
window.debouncedAutoSave = debouncedAutoSave;

/**
 * Renders the roadmap UI based on loaded data.
 * @param {object} data - The roadmap state object loaded from storage.
 */
function renderRoadmapFromData(data) {
    console.log("Rendering roadmap from data:", data);
    if (!roadmapNameInput || !roadmapOutputDiv || !addIncrementButton || !exportButtonsContainer) {
        console.error("Cannot render from data: Required UI elements not found.");
        return;
    }
    const statuses = getStatuses(); // Get current statuses for validation/icon lookup

    // Clear existing content
    roadmapOutputDiv.innerHTML = '';

    // Restore global state
    roadmapNameInput.value = data.roadmapName || '';
    if (data.nextSegmentStartDate && data.incrementType) {
        roadmapOutputDiv.dataset.nextSegmentStartDate = data.nextSegmentStartDate;
        roadmapOutputDiv.dataset.incrementType = data.incrementType;
        addIncrementButton.classList.remove('hidden');
    } else {
        delete roadmapOutputDiv.dataset.nextSegmentStartDate;
        delete roadmapOutputDiv.dataset.incrementType;
        addIncrementButton.classList.add('hidden');
    }

    // Render periods and items
    const fragment = document.createDocumentFragment();
    data.periods?.forEach(periodData => {
        const periodContainer = createSegmentElement(periodData.segmentName);
        const customTitleInput = periodContainer.querySelector('.period-custom-title');
        const itemsContainer = periodContainer.querySelector('.items-container');

        if (customTitleInput) {
            customTitleInput.value = periodData.customTitle || '';
            periodContainer.dataset.customTitle = periodData.customTitle || ''; // Also set dataset
        }

        if (itemsContainer) {
            periodData.items?.forEach(itemData => {
                const itemElement = createChecklistItemElement(); // Creates with default status/icon
                const descriptionInput = itemElement.querySelector('.item-description');
                const statusDropdown = itemElement.querySelector('.status-dropdown');
                const itemIcon = itemElement.querySelector('.checklist-item-status-icon');

                if (descriptionInput) {
                    descriptionInput.value = itemData.description || '';
                }

                if (statusDropdown && itemIcon) {
                    const loadedStatus = itemData.status;
                    const statusExists = statuses.some(s => s.name === loadedStatus);
                    const statusToSet = statusExists ? loadedStatus : (statuses.length > 0 ? statuses[0].name : 'Not Started'); // Fallback
                    const statusObj = statuses.find(s => s.name === statusToSet) || { icon: '❓' };

                    itemElement.dataset.status = statusToSet;
                    statusDropdown.value = statusToSet;
                    itemIcon.textContent = statusObj.icon;
                    itemIcon.setAttribute('aria-label', statusToSet);

                    if (!statusExists && loadedStatus) {
                        console.warn(`Loaded status "${loadedStatus}" not found in current statuses. Resetting item to "${statusToSet}".`);
                    }
                }
                itemsContainer.appendChild(itemElement);
            });
        }
        fragment.appendChild(periodContainer);
    });

    roadmapOutputDiv.appendChild(fragment);

    // Show export buttons if content was loaded
    if (data.periods && data.periods.length > 0) {
        exportButtonsContainer.classList.remove('hidden');
    } else {
        exportButtonsContainer.classList.add('hidden');
    }

    console.log("Roadmap rendered from data.");
}

/**
 * Loads roadmap state from localStorage and renders it.
 */
function loadRoadmapState() {
    console.log("Attempting to load roadmap state...");
    updateStatusMessage("Loading...");
    const stateJson = localStorage.getItem(LOCAL_STORAGE_KEY);

    if (!stateJson) {
        updateStatusMessage("No saved data found.");
        console.log("No saved roadmap state found in localStorage.");
        return;
    }

    try {
        const loadedState = JSON.parse(stateJson);
        renderRoadmapFromData(loadedState);
        updateStatusMessage("Loaded!");
        console.log("Roadmap state loaded and rendered successfully.");
    } catch (error) {
        updateStatusMessage("Error loading data.", true);
        console.error("Error parsing or rendering roadmap state from localStorage:", error);
        // Optionally clear corrupted data:
        // localStorage.removeItem(LOCAL_STORAGE_KEY);
    }
}

/**
 * Attempts to automatically load saved state on page load.
 */
function attemptAutoLoad() {
    console.log("Attempting auto-load...");
    const stateJson = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (stateJson) {
        console.log("Found saved state, proceeding with auto-load.");
        loadRoadmapState(); // Re-use the main load function (handles parsing, rendering, feedback)
    } else {
        console.log("No saved state found for auto-load.");
    }
}


// --- Initialization & Event Listeners ---

/**
 * Initializes the application: sets up default values and attaches event listeners.
 */
function initializeApp() {
    // Initial UI setup calls from imported modules
    renderStatusLegend();
    populateEmojiGrid(); // Populate the emoji popup grid

    // Set the minimum date for the date picker to today
    const today = new Date().toISOString().split('T')[0];
    if (completionDateInput) {
        completionDateInput.setAttribute('min', today);
    } else {
        console.error("Completion date input element not found.");
    }


    // Ensure export buttons are hidden on initial load
    if (exportButtonsContainer) {
        exportButtonsContainer.classList.add('hidden');
    } else {
         console.error("Export buttons container element not found.");
    }

    // Ensure add increment button is hidden on initial load
    if (addIncrementButton) {
        addIncrementButton.classList.add('hidden');
    } else {
        console.error("Add Increment button element not found.");
    }


    // Attach main event listeners using imported handlers
    if (generateButton) {
        generateButton.addEventListener('click', generateRoadmap);
    } else {
        console.error("Generate roadmap button element not found.");
    }

    if (exportPdfButton) {
        exportPdfButton.addEventListener('click', exportToPdf);
    } else {
        console.error("Export PDF button element not found.");
    }

    if (exportWordButton) {
        exportWordButton.addEventListener('click', exportToWord);
    } else {
        console.error("Export Word button element not found.");
    }

    if (exportPptButton) {
        exportPptButton.addEventListener('click', exportToPpt);
    } else {
        console.error("Export PPT button element not found.");
    }


    // Add delegated event listeners for interactions within the exportable content area
    if (exportableContentDiv) {
        // Existing listener for general UI interactions (add/delete item, etc.)
        exportableContentDiv.addEventListener('click', handleRoadmapInteraction);
        exportableContentDiv.addEventListener('change', handleRoadmapInteraction);
        exportableContentDiv.addEventListener('input', handleRoadmapInteraction);

        // Add specific listeners for AUTOSAVE triggers
        exportableContentDiv.addEventListener('input', (event) => {
            // Trigger on typing in roadmap name, period titles, or item descriptions
            if (event.target.matches('#roadmap-name, .period-custom-title, .item-description')) {
                console.log('Autosave triggered by input event:', event.target.id || event.target.className);
                debouncedAutoSave();
            }
        });
        exportableContentDiv.addEventListener('change', (event) => {
            // Trigger on changing status dropdown
            if (event.target.matches('.status-dropdown')) {
                console.log('Autosave triggered by change event:', event.target.className);
                debouncedAutoSave();
            }
        });
         exportableContentDiv.addEventListener('click', (event) => {
            // Trigger on adding/deleting items or adding increments
            if (event.target.closest('.add-item-button, .delete-item-button, #add-increment-button')) {
                 console.log('Autosave triggered by click event:', event.target.id || event.target.closest('button')?.className);
                 // We might want a shorter debounce or immediate save here, but sticking to 5s for now
                 debouncedAutoSave();
            }
        });

    } else {
        console.error("Exportable content container element (#exportable-content) not found.");
    }


    // Add listeners for the editable status legend
    if (editableStatusListDiv) {
        // Listener for name changes (input event)
        editableStatusListDiv.addEventListener('input', handleStatusLegendChange);
        // Listener for emoji button clicks & remove button clicks (click event)
        editableStatusListDiv.addEventListener('click', handleLegendClick);
        // Removed 'change' listener for select dropdown
    } else {
        console.error("Editable status list container element not found.");
    }

    // Add listener for the "Add Status" button
    if (addStatusBtn) {
        addStatusBtn.addEventListener('click', handleAddStatusClick);
    } else {
        console.error("Add status button element not found.");
    }


    // Add listener to close emoji popup on outside click (using capture phase)
    document.addEventListener('click', closeEmojiPopupOnClickOutside, true); // Added back listener

    // Removed listener for the theme toggle

    // Add listeners for Save/Load buttons
    if (saveButton) {
        saveButton.addEventListener('click', handleManualSaveClick); // Use the new handler
    } else {
        console.error("Save roadmap button element not found.");
    }

    if (loadButton) {
        loadButton.addEventListener('click', loadRoadmapState);
    } else {
        console.error("Load roadmap button element not found.");
    }


    console.log("Roadmap Generator Initialized (Modular).");

    // Removed applyInitialTheme() call

    // Attempt to auto-load saved state after initialization
    attemptAutoLoad();
}

// --- Start the App ---
initializeApp();
