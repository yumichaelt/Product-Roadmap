// statusManager.js
// Manages status definitions, persistence, and legend UI, including Emoji selection.

import { DEFAULT_STATUSES, AVAILABLE_EMOJIS } from './config.js'; // Added AVAILABLE_EMOJIS import
// Import the function needed to update the UI when statuses change
import { updateRoadmapDropdowns, updateChecklistItemIcons } from './roadmapUi.js';

// --- DOM Element References ---
const editableStatusListDiv = document.getElementById('editable-status-list');
const emojiSelectPopup = document.getElementById('emoji-select-popup'); // Added reference for the new popup

// --- Status Persistence & State ---

/**
 * Loads statuses from localStorage or returns defaults.
 * @returns {Array<object>} The array of status objects.
 */
function loadStatuses() {
    const storedStatuses = localStorage.getItem('roadmapStatuses');
    try {
        if (storedStatuses) {
            const parsed = JSON.parse(storedStatuses);
            // Basic validation: Check if it's an array and items have name/icon
            if (Array.isArray(parsed) && parsed.length > 0 && parsed.every(s => s && typeof s.name === 'string' && typeof s.icon === 'string')) { // Ensure not empty, check for 'icon'
                 console.log("Loaded statuses from localStorage");
                return parsed; // Return the parsed array if valid
            } else {
                console.warn("Stored statuses format invalid or empty, using defaults.");
            }
        }
    } catch (e) {
        console.error("Error parsing statuses from localStorage", e);
    }
    console.log("Using default statuses");
    // Return a deep copy of defaults to avoid modifying the original constant
    return JSON.parse(JSON.stringify(DEFAULT_STATUSES));
}

// Load statuses initially - Use 'let' as it will be modified
let STATUSES = loadStatuses();

/**
 * Saves the current STATUSES array to localStorage.
 */
function saveStatuses() {
    try {
        // Ensure we don't save an empty array if something went wrong
        if (STATUSES && STATUSES.length > 0) {
            localStorage.setItem('roadmapStatuses', JSON.stringify(STATUSES));
            console.log("Statuses saved to localStorage");
        } else {
            console.error("Attempted to save empty or invalid STATUSES array. Saving aborted.");
            // Optionally reload defaults here if state becomes invalid
            // STATUSES = loadStatuses();
            // renderStatusLegend();
        }
    } catch (e) {
        console.error("Error saving statuses to localStorage", e);
    }
}

/**
 * Getter function for the current statuses.
 * @returns {Array<object>} A copy of the current status objects.
 */
export function getStatuses() {
    // Return a copy to prevent external modification of the internal array
    return JSON.parse(JSON.stringify(STATUSES));
}

// --- Status Legend Editing ---

/**
 * Renders the editable status legend based on the global STATUSES array.
 */
export function renderStatusLegend() {
    if (!editableStatusListDiv) return;
    editableStatusListDiv.innerHTML = ''; // Clear previous legend

    STATUSES.forEach((status, index) => {
        const itemDiv = document.createElement('div');
        // Add data-index to easily find which status was edited
        itemDiv.classList.add('status-definition-item', 'flex', 'items-center', 'mb-1', 'space-x-2');
        itemDiv.dataset.index = index;

        // Emoji Icon Button (opens popup)
        const emojiButton = document.createElement('button');
        emojiButton.type = 'button';
        emojiButton.classList.add('status-emoji-button', 'border', 'border-gray-500', 'rounded', 'p-1', 'w-8', 'h-8', 'flex', 'items-center', 'justify-center', 'hover:bg-gray-600', 'focus:outline-none', 'focus:ring-1', 'focus:ring-indigo-600'); // Basic styling
        emojiButton.dataset.index = index; // Link button to status index
        emojiButton.setAttribute('aria-label', `Change icon for ${status.name}`);

        const emojiDisplaySpan = document.createElement('span');
        emojiDisplaySpan.textContent = status.icon || '❓'; // Display current emoji
        emojiDisplaySpan.classList.add('text-lg'); // Make emoji slightly larger
        emojiButton.appendChild(emojiDisplaySpan);

        // Input for Name
        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.value = status.name;
        // Set dark as default
        nameInput.classList.add('status-name-input', 'border', 'border-gray-500', 'bg-gray-600', 'text-gray-100', 'rounded', 'p-1', 'flex-grow', 'text-sm');

        // Remove Button for this status
        const removeButton = document.createElement('button');
        removeButton.type = 'button';
        removeButton.innerHTML = '&times;'; // 'X' symbol
        removeButton.title = 'Remove Status';
        // Set dark as default
        removeButton.classList.add('remove-status-button', 'ml-2', 'text-red-400', 'hover:text-red-300', 'font-bold');

        // Disable removing if it's the last status
        if (STATUSES.length <= 1) {
            removeButton.disabled = true;
            removeButton.classList.add('opacity-50', 'cursor-not-allowed');
        }

        itemDiv.appendChild(emojiButton); // Add emoji button
        itemDiv.appendChild(nameInput);
        itemDiv.appendChild(removeButton); // Append remove button
        editableStatusListDiv.appendChild(itemDiv);
    });
}

/**
 * Handles click events specifically within the editable status legend.
 * Handles opening the emoji popup AND removing statuses.
 * @param {Event} event - The click event object.
 */
export function handleLegendClick(event) {
    const target = event.target;

    // Check if an emoji selector button was clicked
    const emojiButton = target.closest('.status-emoji-button');
    if (emojiButton) {
        const index = parseInt(emojiButton.dataset.index, 10);
        if (!isNaN(index)) {
            openEmojiPopup(emojiButton, index); // Open the new popup
        }
        return; // Handled emoji button click
    }

    // Check if a remove status button was clicked
    const removeButton = target.closest('.remove-status-button');
    if (removeButton) {
        // Prevent removing the last status
        if (STATUSES.length <= 1) {
            alert("Cannot remove the last status.");
            return;
        }

        const itemDiv = removeButton.closest('.status-definition-item');
        const index = parseInt(itemDiv.dataset.index, 10);

        if (!isNaN(index) && index >= 0 && index < STATUSES.length) {
            const removedStatusName = STATUSES[index].name; // Get name before removing

            if (confirm(`Are you sure you want to remove the status "${removedStatusName}"? Items using this status will be reassigned.`)) {
                STATUSES.splice(index, 1); // Remove status from array
                saveStatuses();
                renderStatusLegend(); // Re-render legend (updates indices and enables/disables remove buttons)
                // Update dropdowns, passing the removed name for reassignment logic
                updateRoadmapDropdowns(null, null, removedStatusName); // Call imported function
            }
        }
        return; // Handled remove button click
    }
}


/**
 * Handles input or change events within the editable status legend (name input, emoji select).
 * Updates the STATUSES array, saves to localStorage, and updates relevant UI parts.
 * Prevents saving empty status names.
 * @param {Event} event - The input or change event object.
 */
export function handleStatusLegendChange(event) { // Renamed parameter for clarity
    const target = event.target;
    const itemDiv = target.closest('.status-definition-item');
    if (!itemDiv) return;

    const index = parseInt(itemDiv.dataset.index, 10);
    if (isNaN(index) || index < 0 || index >= STATUSES.length) {
        console.error("Invalid index found on status item:", itemDiv.dataset.index);
        return;
    }

    // Handle Name Input Change
    if (target.matches('.status-name-input')) {
        const oldName = STATUSES[index].name; // Store old name before change
        const newName = target.value;
        const trimmedNewName = newName.trim(); // Trim whitespace

        // --- BEGIN VALIDATION ---
        if (trimmedNewName === '') {
            alert('Status name cannot be empty.'); // Inform user
            target.value = oldName; // Revert input field to the previous name
            return; // Stop processing this event
        }
        // --- END VALIDATION ---

        // Only proceed if the (trimmed) name actually changed
        if (oldName !== trimmedNewName) {
             // If the user entered spaces, update the input visually
            if (newName !== trimmedNewName) {
                 target.value = trimmedNewName;
            }
            STATUSES[index].name = trimmedNewName; // Use trimmed name for the update
            saveStatuses(); // Save the whole array on name change
            updateRoadmapDropdowns(oldName, trimmedNewName, null); // Update existing dropdowns, passing trimmed name
        }
    }
    // Emoji Select Change logic removed (handled by grid click now)
}


/**
 * Handles clicking the "Add New Status" button.
 */
export function handleAddStatusClick() {
    // Add a new default status to the array
    STATUSES.push({
        name: 'New Status',
        icon: '❓' // Default Emoji icon
    });
    saveStatuses();         // Save changes
    renderStatusLegend();   // Re-render the legend UI (will include the new status and enable remove buttons if needed)
    updateRoadmapDropdowns(null, null, null); // Update dropdowns in the roadmap
}

// --- Emoji Popup Logic ---

/**
 * Populates the emoji popup grid with available emojis.
 * Exported to be called once during initialization.
 */
export function populateEmojiGrid() {
    if (!emojiSelectPopup) {
        console.error("Emoji select popup element not found.");
        return;
    }
    const grid = emojiSelectPopup.querySelector('.emoji-grid');
    if (!grid) {
        console.error("Emoji grid container within popup not found.");
        return;
    }

    grid.innerHTML = ''; // Clear previous icons if any

    AVAILABLE_EMOJIS.forEach(emoji => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.classList.add('emoji-choice-btn', 'p-1', 'border', 'border-gray-500', 'rounded', 'hover:bg-gray-600', 'focus:outline-none', 'focus:ring-1', 'focus:ring-indigo-600', 'text-xl'); // Basic styling
        btn.dataset.emoji = emoji; // Store emoji value
        btn.textContent = emoji;
        grid.appendChild(btn);
    });

     // Add listener to popup for emoji clicks (only once)
     if (!emojiSelectPopup.dataset.listenerAttached) {
        emojiSelectPopup.addEventListener('click', handleEmojiGridClick);
        emojiSelectPopup.dataset.listenerAttached = 'true'; // Mark listener as attached
     }
}

/**
 * Opens the emoji popup near the clicked button.
 * @param {HTMLElement} buttonElement - The button that was clicked to open the popup.
 * @param {number} statusIndex - The index of the status being edited.
 */
function openEmojiPopup(buttonElement, statusIndex) {
    if (!emojiSelectPopup) return;
    emojiSelectPopup.dataset.editingIndex = statusIndex; // Store which status we are editing

    // Position the popup near the buttonElement
    const rect = buttonElement.getBoundingClientRect();
    const popupHeight = emojiSelectPopup.offsetHeight;
    const spaceBelow = window.innerHeight - rect.bottom;
    let topPosition;

    // Position below if space, otherwise above
    if (spaceBelow > popupHeight + 10 || rect.top < popupHeight) { // Prefer below unless no space AND button is low
         topPosition = window.scrollY + rect.bottom + 5;
    } else {
         topPosition = window.scrollY + rect.top - popupHeight - 5;
    }

    emojiSelectPopup.style.top = `${Math.max(0, topPosition)}px`; // Ensure not off-screen top
    emojiSelectPopup.style.left = `${window.scrollX + rect.left}px`;
    emojiSelectPopup.classList.remove('hidden'); // Show the popup
}

/**
 * Handles clicks within the emoji popup grid.
 * @param {Event} event - The click event object.
 */
function handleEmojiGridClick(event) {
    const target = event.target;
    const choiceButton = target.closest('.emoji-choice-btn');
    const popup = emojiSelectPopup; // Use direct reference

    if (choiceButton && popup.dataset.editingIndex !== undefined) {
        const newEmoji = choiceButton.dataset.emoji;
        const index = parseInt(popup.dataset.editingIndex, 10);

        if (!isNaN(index) && index >= 0 && index < STATUSES.length) {
            // 1. Update data if changed
            if (STATUSES[index].icon !== newEmoji) {
                STATUSES[index].icon = newEmoji;

                // 2. Update emoji button display in the legend
                const legendItemDiv = editableStatusListDiv.querySelector(`.status-definition-item[data-index="${index}"]`);
                if (legendItemDiv) {
                     const emojiDisplay = legendItemDiv.querySelector('.status-emoji-button span');
                     if(emojiDisplay) emojiDisplay.textContent = newEmoji; // Update display
                }

                // 3. Save
                saveStatuses();

                // 4. Update icons in existing checklist items
                updateChecklistItemIcons(index); // Call imported function
            }

            // 5. Hide Popup
            popup.classList.add('hidden');
            delete popup.dataset.editingIndex; // Clear editing state
        }
    }
}

/**
 * Closes the emoji popup if a click occurs outside of it.
 * Exported for use in the main script's event listener.
 * @param {Event} event - The click event object.
 */
export function closeEmojiPopupOnClickOutside(event) {
    if (emojiSelectPopup && !emojiSelectPopup.classList.contains('hidden')) {
        // Close if the click is outside the popup AND not on an emoji selector button
        if (!emojiSelectPopup.contains(event.target) && !event.target.closest('.status-emoji-button')) {
             emojiSelectPopup.classList.add('hidden');
             delete emojiSelectPopup.dataset.editingIndex;
        }
    }
}
