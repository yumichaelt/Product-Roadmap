// statusManager.js
// Manages status definitions, persistence, and legend UI, including Emoji selection.

import { DEFAULT_STATUSES, AVAILABLE_EMOJIS } from './config.js';
// Import UI update functions from roadmapUi.js
import { updateRoadmapDropdowns, updateChecklistItemIcons } from './roadmapUi.js';
// Import autosave function from script.js (assuming it's globally accessible or passed)
// Note: Accessing window.debouncedAutoSave is a temporary workaround. Dependency injection or a shared event bus would be cleaner.
import { debouncedAutoSave } from './script.js';


// --- DOM Element References ---
const editableStatusListDiv = document.getElementById('editable-status-list');
const emojiSelectPopup = document.getElementById('emoji-select-popup');

// --- Status Persistence & State ---

const STATUS_STORAGE_KEY = 'roadmapStatuses';

/**
 * Loads statuses from localStorage or returns defaults.
 * Includes basic validation.
 * @returns {Array<object>} The array of status objects.
 */
function loadStatuses() {
  const storedStatuses = localStorage.getItem(STATUS_STORAGE_KEY);
  try {
    if (storedStatuses) {
      const parsed = JSON.parse(storedStatuses);
      // Validation: Check if it's a non-empty array and items have name/icon strings
      if (Array.isArray(parsed) && parsed.length > 0 && parsed.every(s => s && typeof s.name === 'string' && typeof s.icon === 'string')) {
        return parsed; // Return the valid parsed array
      } else {
        console.warn("Stored statuses format invalid or empty, using defaults.");
      }
    }
  } catch (e) {
    console.error("Error parsing statuses from localStorage", e);
  }
  // Return a deep copy of defaults if loading failed or no stored data found
  return JSON.parse(JSON.stringify(DEFAULT_STATUSES));
}

// Load statuses initially - Use 'let' as it will be modified by user actions
let STATUSES = loadStatuses();

/**
 * Saves the current STATUSES array to localStorage.
 * Includes validation to prevent saving empty/invalid state.
 */
function saveStatuses() {
  try {
    // Prevent saving an empty array if something went wrong during modification
    if (STATUSES && Array.isArray(STATUSES) && STATUSES.length > 0) {
      localStorage.setItem(STATUS_STORAGE_KEY, JSON.stringify(STATUSES));
    } else {
      console.error("Attempted to save empty or invalid STATUSES array. Saving aborted.");
      // Optional recovery: Reload defaults if state becomes critically invalid
      // STATUSES = JSON.parse(JSON.stringify(DEFAULT_STATUSES));
      // renderStatusLegend(); // Re-render if recovered
    }
  } catch (e) {
    console.error("Error saving statuses to localStorage", e);
  }
}

/**
 * Getter function for the current statuses. Provides a deep copy.
 * @returns {Array<object>} A deep copy of the current status objects.
 */
export function getStatuses() {
  // Return a deep copy to prevent external modification of the internal array
  return JSON.parse(JSON.stringify(STATUSES));
}

// --- Status Legend Editing ---

/**
 * Renders the editable status legend based on the global STATUSES array.
 */
export function renderStatusLegend() {
  if (!editableStatusListDiv) {
      console.error("Editable status list element not found.");
      return;
  }
  editableStatusListDiv.innerHTML = ''; // Clear previous legend

  STATUSES.forEach((status, index) => {
    const itemDiv = document.createElement('div');
    itemDiv.classList.add('status-definition-item', 'flex', 'items-center', 'mb-1', 'space-x-2');
    itemDiv.dataset.index = index; // Store index for easy reference in event handlers

    // Emoji Icon Button (opens popup)
    const emojiButton = document.createElement('button');
    emojiButton.type = 'button';
    emojiButton.classList.add('status-emoji-button', 'border', 'border-gray-500', 'rounded', 'p-1', 'w-8', 'h-8', 'flex', 'items-center', 'justify-center', 'hover:bg-gray-600', 'focus:outline-none', 'focus:ring-1', 'focus:ring-indigo-600');
    emojiButton.dataset.index = index; // Link button to status index
    emojiButton.setAttribute('aria-label', `Change icon for ${status.name}`);

    const emojiDisplaySpan = document.createElement('span');
    emojiDisplaySpan.textContent = status.icon || '❓'; // Display current emoji or fallback
    emojiDisplaySpan.classList.add('text-lg'); // Make emoji slightly larger
    emojiButton.appendChild(emojiDisplaySpan);

    // Input for Name
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.value = status.name;
    nameInput.classList.add('status-name-input', 'border', 'border-gray-500', 'bg-gray-600', 'text-gray-100', 'rounded', 'p-1', 'flex-grow', 'text-sm', 'focus:outline-none', 'focus:ring-1', 'focus:ring-blue-500');
    nameInput.setAttribute('aria-label', `Edit name for status ${status.name}`);

    // Remove Button for this status
    const removeButton = document.createElement('button');
    removeButton.type = 'button';
    removeButton.innerHTML = '&times;'; // 'X' symbol
    removeButton.title = 'Remove Status';
    removeButton.classList.add('remove-status-button', 'ml-2', 'text-red-400', 'hover:text-red-300', 'font-bold', 'focus:outline-none', 'focus:ring-1', 'focus:ring-red-500', 'rounded');
    removeButton.setAttribute('aria-label', `Remove status ${status.name}`);

    // Disable removing if it's the last status remaining
    if (STATUSES.length <= 1) {
      removeButton.disabled = true;
      removeButton.classList.add('opacity-50', 'cursor-not-allowed');
    }

    itemDiv.appendChild(emojiButton);
    itemDiv.appendChild(nameInput);
    itemDiv.appendChild(removeButton);
    editableStatusListDiv.appendChild(itemDiv);
  });
}

/**
 * Handles click events specifically within the editable status legend.
 * Dispatches clicks on emoji buttons or remove buttons.
 * @param {Event} event - The click event object.
 */
export function handleLegendClick(event) {
  const target = event.target;

  // Check if an emoji selector button was clicked
  const emojiButton = target.closest('.status-emoji-button');
  if (emojiButton) {
    const index = parseInt(emojiButton.dataset.index, 10);
    if (!isNaN(index)) {
      openEmojiPopup(emojiButton, index); // Open the emoji selection popup
    }
    return; // Handled emoji button click
  }

  // Check if a remove status button was clicked
  const removeButton = target.closest('.remove-status-button');
  if (removeButton) {
    // Prevent removing the last status (UI should disable button, but double-check)
    if (STATUSES.length <= 1) {
      alert("Cannot remove the last status.");
      return;
    }

    const itemDiv = removeButton.closest('.status-definition-item');
    const index = parseInt(itemDiv?.dataset.index, 10); // Use optional chaining

    if (itemDiv && !isNaN(index) && index >= 0 && index < STATUSES.length) {
      const removedStatusName = STATUSES[index].name; // Get name before removing

      if (confirm(`Are you sure you want to remove the status "${removedStatusName}"? Items using this status will be reassigned.`)) {
        STATUSES.splice(index, 1); // Remove status from the array
        saveStatuses();
        debouncedAutoSave(); // Trigger autosave of the main roadmap state
        renderStatusLegend(); // Re-render legend (updates indices, enables/disables remove buttons)
        // Update roadmap dropdowns, passing the removed name for reassignment logic
        updateRoadmapDropdowns(null, null, removedStatusName);
      }
    } else {
        console.warn("Could not determine index for status removal.");
    }
    return; // Handled remove button click
  }
}


/**
 * Handles input events within the editable status legend (specifically name input changes).
 * Updates the STATUSES array, saves to localStorage, and updates relevant UI parts.
 * Prevents saving empty status names.
 * @param {Event} event - The input event object.
 */
export function handleStatusLegendChange(event) {
  const target = event.target;

  // Handle Name Input Change
  if (target.matches('.status-name-input')) {
    const itemDiv = target.closest('.status-definition-item');
    if (!itemDiv) return;

    const index = parseInt(itemDiv.dataset.index, 10);
    if (isNaN(index) || index < 0 || index >= STATUSES.length) {
      console.error("Invalid index found on status item:", itemDiv.dataset.index);
      return;
    }

    const oldName = STATUSES[index].name;
    const newName = target.value;
    const trimmedNewName = newName.trim(); // Trim whitespace

    // --- Validation: Prevent empty names ---
    if (trimmedNewName === '') {
      alert('Status name cannot be empty.');
      target.value = oldName; // Revert input field to the previous valid name
      return; // Stop processing
    }

    // Only proceed if the (trimmed) name actually changed
    if (oldName !== trimmedNewName) {
      // If the user entered spaces, update the input visually to the trimmed version
      if (newName !== trimmedNewName) {
        target.value = trimmedNewName;
      }
      STATUSES[index].name = trimmedNewName; // Update the name in the array
      saveStatuses(); // Save the updated statuses array
      debouncedAutoSave(); // Trigger autosave of the main roadmap state
      // Update roadmap dropdowns, passing old and new (trimmed) names
      updateRoadmapDropdowns(oldName, trimmedNewName, null);
      // Update aria-labels associated with this status in the legend
      const emojiButton = itemDiv.querySelector('.status-emoji-button');
      const removeButton = itemDiv.querySelector('.remove-status-button');
      if (emojiButton) emojiButton.setAttribute('aria-label', `Change icon for ${trimmedNewName}`);
      if (removeButton) removeButton.setAttribute('aria-label', `Remove status ${trimmedNewName}`);
      target.setAttribute('aria-label', `Edit name for status ${trimmedNewName}`);
    }
  }
  // Note: Emoji changes are handled by handleEmojiGridClick
}


/**
 * Handles clicking the "Add New Status" button.
 */
export function handleAddStatusClick() {
  // Add a new default status object to the array
  // Ensure the default name is unique if 'New Status' already exists
  let defaultName = 'New Status';
  let counter = 1;
  while (STATUSES.some(s => s.name === defaultName)) {
      counter++;
      defaultName = `New Status ${counter}`;
  }

  STATUSES.push({
    name: defaultName,
    icon: '❓' // Default Emoji icon
  });

  saveStatuses();         // Save changes to localStorage
  debouncedAutoSave();    // Trigger autosave of the main roadmap state
  renderStatusLegend();   // Re-render the legend UI
  updateRoadmapDropdowns(); // Update dropdowns in the roadmap (no name changes needed here)
}

// --- Emoji Popup Logic ---

/**
 * Populates the emoji popup grid with available emojis from config.js.
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

  grid.innerHTML = ''; // Clear previous icons

  AVAILABLE_EMOJIS.forEach(emoji => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.classList.add('emoji-choice-btn', 'p-1', 'border', 'border-gray-500', 'rounded', 'hover:bg-gray-600', 'focus:outline-none', 'focus:ring-1', 'focus:ring-indigo-600', 'text-xl');
    btn.dataset.emoji = emoji; // Store emoji value in data attribute
    btn.textContent = emoji;
    btn.setAttribute('aria-label', `Select emoji ${emoji}`);
    grid.appendChild(btn);
  });

  // Add listener to the popup itself for emoji clicks (using delegation)
  // Attach only once to prevent multiple listeners.
  if (!emojiSelectPopup.dataset.listenerAttached) {
    emojiSelectPopup.addEventListener('click', handleEmojiGridClick);
    emojiSelectPopup.dataset.listenerAttached = 'true';
  }
}

/**
 * Opens the emoji popup near the clicked button and stores the index being edited.
 * @param {HTMLElement} buttonElement - The emoji button in the legend that was clicked.
 * @param {number} statusIndex - The index of the status being edited.
 */
function openEmojiPopup(buttonElement, statusIndex) {
  if (!emojiSelectPopup) return;
  emojiSelectPopup.dataset.editingIndex = statusIndex; // Store which status index we are editing

  // --- Positioning Logic ---
  const rect = buttonElement.getBoundingClientRect();
  const popupHeight = emojiSelectPopup.offsetHeight;
  // Add a small buffer (e.g., 10px)
  const buffer = 10;
  const spaceBelow = window.innerHeight - rect.bottom - buffer;
  const spaceAbove = rect.top - buffer;
  let topPosition;

  // Position below if enough space, otherwise try above.
  if (spaceBelow >= popupHeight || spaceAbove < popupHeight) {
    // Position below (default or if not enough space above)
    topPosition = window.scrollY + rect.bottom + 5; // 5px gap
  } else {
    // Position above
    topPosition = window.scrollY + rect.top - popupHeight - 5; // 5px gap
  }

  // Ensure popup doesn't go off-screen vertically
  topPosition = Math.max(window.scrollY + buffer, topPosition); // Don't go above top buffer
  topPosition = Math.min(window.scrollY + window.innerHeight - popupHeight - buffer, topPosition); // Don't go below bottom buffer

  emojiSelectPopup.style.top = `${topPosition}px`;
  // Position horizontally aligned with the button
  emojiSelectPopup.style.left = `${window.scrollX + rect.left}px`;

  emojiSelectPopup.classList.remove('hidden'); // Show the popup
}

/**
 * Handles clicks within the emoji popup grid (delegated listener).
 * Updates the status icon if an emoji button is clicked.
 * @param {Event} event - The click event object.
 */
function handleEmojiGridClick(event) {
  const target = event.target;
  const choiceButton = target.closest('.emoji-choice-btn');
  const popup = emojiSelectPopup; // Direct reference

  if (choiceButton && popup.dataset.editingIndex !== undefined) {
    const newEmoji = choiceButton.dataset.emoji;
    const index = parseInt(popup.dataset.editingIndex, 10);

    if (!isNaN(index) && index >= 0 && index < STATUSES.length) {
      // 1. Update data only if the icon actually changed
      if (STATUSES[index].icon !== newEmoji) {
        STATUSES[index].icon = newEmoji;

        // 2. Update the emoji button display in the legend visually
        const legendItemDiv = editableStatusListDiv.querySelector(`.status-definition-item[data-index="${index}"]`);
        const emojiDisplay = legendItemDiv?.querySelector('.status-emoji-button span');
        if (emojiDisplay) {
          emojiDisplay.textContent = newEmoji;
        }

        // 3. Save the updated STATUSES array
        saveStatuses();
        debouncedAutoSave(); // Trigger autosave of the main roadmap state

        // 4. Update icons in existing checklist items in the roadmap
        updateChecklistItemIcons(index);
      }

      // 5. Hide Popup regardless of whether the icon changed (user made a selection)
      popup.classList.add('hidden');
      delete popup.dataset.editingIndex; // Clear editing state
    } else {
        console.error("Invalid index stored on emoji popup:", popup.dataset.editingIndex);
        // Hide popup even if index was bad
        popup.classList.add('hidden');
        delete popup.dataset.editingIndex;
    }
  }
  // If click was inside popup but not on a choice button, do nothing (allows scrolling etc.)
}

/**
 * Closes the emoji popup if a click occurs outside of it or its trigger buttons.
 * Uses capture phase for reliability.
 * Exported for use in the main script's event listener.
 * @param {Event} event - The click event object.
 */
export function closeEmojiPopupOnClickOutside(event) {
  if (emojiSelectPopup && !emojiSelectPopup.classList.contains('hidden')) {
    // Close if the click target is NOT the popup itself OR any emoji button in the legend
    if (!emojiSelectPopup.contains(event.target) && !event.target.closest('.status-emoji-button')) {
      emojiSelectPopup.classList.add('hidden');
      delete emojiSelectPopup.dataset.editingIndex; // Clear editing state
    }
  }
}
