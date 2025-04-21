// script.js
// Main entry point for the Roadmap Generator application.
// Initializes the app and wires up event listeners using imported modules.

import {
    renderStatusLegend,
    populateEmojiGrid, // Added import for grid population
    handleStatusLegendChange,
    handleLegendClick,
    handleAddStatusClick,
    closeEmojiPopupOnClickOutside // Added back import for popup closing
} from './statusManager.js';

import {
    generateRoadmap,
    handleRoadmapInteraction
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
// const themeToggle = document.getElementById('theme-toggle'); // Removed theme toggle reference

// --- Theme Switching Logic Removed ---


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
        // Attach listeners to the parent container to capture events from roadmap items AND the add increment button
        exportableContentDiv.addEventListener('click', handleRoadmapInteraction);
        exportableContentDiv.addEventListener('change', handleRoadmapInteraction);
        exportableContentDiv.addEventListener('input', handleRoadmapInteraction);
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


    console.log("Roadmap Generator Initialized (Modular).");

    // Removed applyInitialTheme() call
}

// --- Start the App ---
initializeApp();
