// roadmapUi.js
// Handles milestone creation, rendering, and interactions within the roadmap display area.

import { getStatuses } from './statusManager.js';
import { debouncedAutoSave } from './script.js';

// --- DOM Element References ---
const roadmapOutputDiv = document.getElementById('roadmap-output');
const exportButtonsContainer = document.getElementById('export-buttons-container');
const addMilestoneButton = document.getElementById('add-milestone-btn');
// roadmapNameInput is not directly used here but might be useful contextually if needed later

// --- State ---
let milestoneCounter = 0; // Simple counter for unique milestone IDs

// --- Private Helper Functions ---

/**
 * Updates the visual icons for all checklist items currently set to a specific status within a milestone.
 * Used after loading a milestone from data.
 * @param {HTMLElement} milestoneElement - The milestone container element.
 */
function _updateChecklistItemIconsForMilestone(milestoneElement) {
  const statuses = getStatuses();
  const items = milestoneElement.querySelectorAll('.checklist-item');
  items.forEach(item => {
    const statusName = item.dataset.status;
    const statusObj = statuses.find(s => s.name === statusName) || { icon: '❓', name: 'Unknown' }; // Provide fallback name
    const itemIcon = item.querySelector('.checklist-item-status-icon');
    if (itemIcon) {
      itemIcon.textContent = statusObj.icon;
      itemIcon.setAttribute('aria-label', statusObj.name); // Use status name for label
    }
  });
}

/**
 * Handles adding a new checklist item when the '+ Add Line Item' button is clicked.
 * @param {HTMLElement} target - The clicked button element.
 */
function _handleAddLineItem(target) {
  const milestoneSection = target.closest('.milestone-section');
  const itemsContainer = milestoneSection?.querySelector('.items-container');

  if (itemsContainer) {
    const newItem = createChecklistItemElement(); // Create with default values
    itemsContainer.appendChild(newItem);
    debouncedAutoSave();
  } else {
    console.error("[roadmapUi.js] Could not find items container for adding item.");
  }
}

/**
 * Handles deleting a checklist item when its delete button is clicked.
 * @param {HTMLElement} target - The clicked delete button element.
 */
function _handleDeleteLineItem(target) {
  const checklistItem = target.closest('.checklist-item');
  if (checklistItem) {
    checklistItem.remove();
    debouncedAutoSave();
  }
}

/**
 * Handles input or blur events on a milestone title. Triggers autosave.
 * @param {Event} event - The input or blur event object.
 */
function _handleMilestoneTitleInteraction(event) {
  // Autosave is triggered on input or blur for the title
  debouncedAutoSave();
}

/**
 * Handles the 'change' event on a milestone date input. Triggers autosave.
 * @param {Event} event - The change event object.
 */
function _handleMilestoneDateChange(event) {
  // The 'change' event implies the value has potentially been finalized by the user
  debouncedAutoSave();
}

/**
 * Handles the 'blur' event on a milestone date input.
 * Sets the original date display if it hasn't been set yet and the input has a valid date.
 * Autosave is typically triggered by the 'change' event or the main blur listener calling this handler.
 * @param {Event} event - The blur event object.
 */
function _handleMilestoneDateBlur(event) {
    const dateInput = event.target;
    const milestoneSection = dateInput.closest('.milestone-section');
    const originalDateSpan = milestoneSection?.querySelector('.original-date-display');

    if (originalDateSpan) {
        const currentOriginal = originalDateSpan.dataset.originalDate;
        const finalDateStr = dateInput.value; // Read value on blur

        // Set Original Date ONLY if it's not already set AND the final input value is a valid date
        if (!currentOriginal && finalDateStr) {
            try {
                // Basic validation: Attempt to parse and check if it's a valid date object
                // Adding T00:00:00 helps avoid timezone issues during parsing
                const dateObj = new Date(finalDateStr + 'T00:00:00');
                if (isNaN(dateObj.getTime())) {
                    throw new Error('Invalid date value entered.');
                }
                // Optional: Add stricter validation like checking year range if needed
                // if (dateObj.getFullYear() < 1970 || dateObj.getFullYear() > 2100) {
                //     throw new Error('Date year out of reasonable range.');
                // }

                // --- Set the original date details ---
                originalDateSpan.dataset.originalDate = finalDateStr; // Store raw YYYY-MM-DD

                const options = { year: 'numeric', month: '2-digit', day: '2-digit' };
                originalDateSpan.textContent = `Original: ${dateObj.toLocaleDateString(undefined, options)}`;
                originalDateSpan.classList.remove('hidden');

                // Autosave is handled by the main event listener structure calling this,
                // typically via the 'change' event or the top-level 'blur' listener.
                // No *extra* debouncedAutoSave() call needed here.

            } catch (e) {
                console.error("Error parsing/validating date on blur to set original date:", finalDateStr, e);
                // Optionally clear the input or show an error? For now, just log.
                // If validation fails, we don't set the original date.
            }
        }
        // No action needed if original date was already set or input is empty on blur.
    }
}


/**
 * Handles changing the status of a checklist item via its dropdown.
 * Updates the item's data attribute, icon, and triggers autosave.
 * @param {Event} event - The change event object.
 */
function _handleChangeItemStatus(event) {
  const statusDropdown = event.target;
  const checklistItem = statusDropdown.closest('.checklist-item');
  if (checklistItem) {
    const newStatusName = statusDropdown.value;
    checklistItem.dataset.status = newStatusName; // Update data attribute

    // Update the icon displayed in the row
    const statuses = getStatuses();
    const newStatusObj = statuses.find(s => s.name === newStatusName) || { icon: '❓', name: newStatusName }; // Fallback icon/name
    const itemIcon = checklistItem.querySelector('.checklist-item-status-icon');
    if (itemIcon) {
      itemIcon.textContent = newStatusObj.icon;
      itemIcon.setAttribute('aria-label', newStatusObj.name); // Update aria-label
    }
    debouncedAutoSave();
  }
}

/**
 * Handles input events on a checklist item's description field. Triggers autosave.
 * @param {Event} event - The input event object.
 */
function _handleItemDescriptionInput(event) {
  // Autosave is triggered on input for the description
  debouncedAutoSave();
}


// --- Core Application Logic ---

/**
 * Initializes the roadmap display area. Called when "Generate Roadmap" is clicked.
 * Creates the first default milestone.
 * Exported to be called by the main script's event listener.
 */
export function generateRoadmap() {
  // 1. Clear Previous Output & State
  roadmapOutputDiv.innerHTML = '';
  milestoneCounter = 0; // Reset counter for new roadmap

  // 2. Hide export/add buttons initially (will be shown by addMilestoneSection)
  exportButtonsContainer.classList.add('hidden');
  if (addMilestoneButton) {
    addMilestoneButton.classList.add('hidden');
  }

  // 3. Add the first default milestone
  addMilestoneSection(); // This will also show the necessary buttons
}

/**
 * Adds a new milestone section to the roadmap.
 * Can be called initially by generateRoadmap or by the "Add Milestone" button.
 * Exported for use by script.js event listener.
 * @param {object | null} [milestoneData=null] - Optional data to pre-populate the milestone (used during load).
 */
export function addMilestoneSection(milestoneData = null) {
  milestoneCounter++;
  const milestoneId = milestoneData?.id || `milestone-${milestoneCounter}`;
  // Ensure counter is ahead of any loaded ID numbers
  if (milestoneData?.id) {
    const num = parseInt(milestoneData.id.split('-')[1], 10);
    if (!isNaN(num) && num >= milestoneCounter) { // Use >= to handle potential gaps or reloads
      milestoneCounter = num + 1;
    }
  }

  const milestoneElement = createMilestoneElement(milestoneId, milestoneData);
  roadmapOutputDiv.appendChild(milestoneElement);

  // Ensure buttons are visible now that there's at least one milestone
  exportButtonsContainer.classList.remove('hidden');
  if (addMilestoneButton) {
    addMilestoneButton.classList.remove('hidden');
  }

  // Optional: Scroll the new milestone into view, especially if added manually
  // if (!milestoneData) { // Only scroll if added manually, not during load
  //    milestoneElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  // }
}


/**
 * Creates the HTML structure for a single milestone section.
 * @param {string} milestoneId - The unique ID for this milestone (e.g., "milestone-1").
 * @param {object | null} [milestoneData=null] - Optional data for pre-populating (title, dates, items).
 * @returns {HTMLElement} The created milestone container element.
 */
export function createMilestoneElement(milestoneId, milestoneData = null) {
  const milestoneContainer = document.createElement('div');
  milestoneContainer.classList.add('milestone-section', 'p-4', 'bg-gray-700/50', 'rounded', 'border', 'border-gray-600', 'mb-4');
  milestoneContainer.id = milestoneId;

  // --- Milestone Header ---
  const headerDiv = document.createElement('div');
  headerDiv.classList.add('milestone-header', 'mb-3');

  // Editable Title
  const title = document.createElement('h3');
  title.contentEditable = "true";
  title.classList.add('text-lg', 'font-semibold', 'text-gray-100', 'mb-2', 'focus:outline-none', 'focus:ring-1', 'focus:ring-blue-400', 'rounded', 'px-1', '-mx-1');
  title.textContent = milestoneData?.title || `Milestone ${milestoneId.split('-')[1] || milestoneCounter}`; // Use ID num or counter
  title.setAttribute('role', 'textbox');
  title.setAttribute('aria-label', 'Milestone Title');

  // --- Dates Container ---
  const datesContainer = document.createElement('div');
  datesContainer.classList.add('milestone-dates', 'mb-3', 'space-y-1', 'md:flex', 'md:space-y-0', 'md:space-x-4', 'md:items-center');

  // Current Date Input
  const dateLabel = document.createElement('label');
  dateLabel.classList.add('text-sm', 'text-gray-300', 'block', 'md:inline-block');
  dateLabel.textContent = 'Target Date: ';
  const dateInput = document.createElement('input');
  dateInput.type = 'date';
  dateInput.classList.add('milestone-date', 'w-full', 'md:w-auto', 'px-2', 'py-1', 'border', 'rounded', 'bg-gray-600', 'border-gray-500', 'text-gray-100', 'text-sm', 'focus:outline-none', 'focus:ring-1', 'focus:ring-blue-500');
  dateInput.value = milestoneData?.currentCompletionDate || '';
  dateLabel.appendChild(dateInput);

  // Original Date Display
  const originalDateSpan = document.createElement('span');
  originalDateSpan.classList.add('original-date-display', 'text-xs', 'text-gray-400', 'block', 'md:inline-block');
  const originalDateValue = milestoneData?.originalCompletionDate || '';
  originalDateSpan.dataset.originalDate = originalDateValue; // Store raw value

  if (originalDateValue) {
    try {
      // Add T00:00:00 for reliable cross-browser parsing
      const dateObj = new Date(originalDateValue + 'T00:00:00');
      // Stricter Validation
      if (isNaN(dateObj.getTime()) || dateObj.getFullYear() < 1900) {
        throw new Error('Invalid or unreasonable date stored');
      }
      const options = { year: 'numeric', month: '2-digit', day: '2-digit' };
      originalDateSpan.textContent = `Original: ${dateObj.toLocaleDateString(undefined, options)}`;
      originalDateSpan.classList.remove('hidden');
    } catch (e) {
      console.error("Error parsing/formatting stored original date:", originalDateValue, e);
      originalDateSpan.textContent = `Original: (Invalid Date)`;
      originalDateSpan.classList.remove('hidden'); // Show the error state
    }
  } else {
    originalDateSpan.textContent = 'Original: Not Set';
    originalDateSpan.classList.add('hidden'); // Hide if not set
  }

  datesContainer.appendChild(dateLabel);
  datesContainer.appendChild(originalDateSpan);

  // --- Add Line Item Button ---
  const addItemButton = document.createElement('button');
  addItemButton.textContent = '+ Add Line Item';
  addItemButton.classList.add('add-item-btn', 'bg-blue-500', 'hover:bg-blue-600', 'text-white', 'font-bold', 'py-1', 'px-2', 'rounded', 'text-sm', 'focus:outline-none', 'focus:ring-2', 'focus:ring-offset-2', 'focus:ring-blue-600', 'focus:ring-offset-gray-800');

  // --- Line Items Container ---
  const itemsContainer = document.createElement('div');
  itemsContainer.classList.add('items-container', 'mt-2', 'space-y-2');

  // --- Assemble ---
  headerDiv.appendChild(title);
  milestoneContainer.appendChild(headerDiv);
  milestoneContainer.appendChild(datesContainer);
  milestoneContainer.appendChild(addItemButton);
  milestoneContainer.appendChild(itemsContainer);

  // Populate items if loading data
  if (milestoneData?.items && Array.isArray(milestoneData.items)) {
    milestoneData.items.forEach(itemData => {
      const itemElement = createChecklistItemElement(itemData);
      itemsContainer.appendChild(itemElement);
    });
    // Ensure dropdowns and icons reflect loaded state
    _updateChecklistItemIconsForMilestone(milestoneContainer); // Update icons after adding all items
  }

  return milestoneContainer;
}


/**
 * Creates the HTML structure for a single checklist item.
 * @param {object | null} [itemData=null] - Optional data for pre-populating (text, status).
 * @returns {HTMLElement} The newly created checklist item div.
 */
export function createChecklistItemElement(itemData = null) {
  const itemDiv = document.createElement('div');
  itemDiv.classList.add('checklist-item', 'flex', 'items-center', 'mb-2', 'p-2', 'rounded', 'border', 'bg-gray-700/80', 'border-gray-600');

  const statuses = getStatuses();
  // Determine initial status: from itemData, or first status, or default 'Not Started'
  let initialStatusName = 'Not Started'; // Default fallback
  if (itemData?.status && statuses.some(s => s.name === itemData.status)) {
    initialStatusName = itemData.status;
  } else if (statuses.length > 0) {
    initialStatusName = statuses[0].name; // Fallback to the first available status
  }
  itemDiv.dataset.status = initialStatusName; // Store status name in data attribute
  const initialStatusObj = statuses.find(s => s.name === initialStatusName) || { icon: '❓', name: initialStatusName }; // Default icon/name

  // Icon Element (Span for Emoji)
  const itemIcon = document.createElement('span');
  itemIcon.classList.add('checklist-item-status-icon', 'mr-2', 'flex-shrink-0', 'w-5', 'text-center');
  itemIcon.textContent = initialStatusObj.icon;
  itemIcon.setAttribute('aria-label', initialStatusObj.name);

  // Status Dropdown
  const statusDropdown = document.createElement('select');
  statusDropdown.classList.add('status-dropdown', 'border', 'border-gray-500', 'bg-gray-600', 'text-gray-100', 'rounded', 'p-1', 'mr-2', 'text-sm', 'focus:outline-none', 'focus:ring-1', 'focus:ring-blue-500');

  statuses.forEach((status) => {
    const option = document.createElement('option');
    option.value = status.name;
    option.textContent = status.name; // Display name in dropdown
    if (status.name === initialStatusName) {
      option.selected = true;
    }
    statusDropdown.appendChild(option);
  });

  // Description Input
  const descriptionInput = document.createElement('input');
  descriptionInput.type = 'text';
  descriptionInput.classList.add('item-description', 'border', 'border-gray-500', 'bg-gray-600', 'text-gray-100', 'placeholder-gray-400', 'rounded', 'p-1', 'flex-grow', 'focus:outline-none', 'focus:ring-1', 'focus:ring-blue-500');
  descriptionInput.placeholder = 'Enter task description...';
  descriptionInput.value = itemData?.text || ''; // Populate text from itemData

  // Delete Button
  const deleteButton = document.createElement('button');
  deleteButton.classList.add('delete-item-button', 'ml-2', 'text-red-400', 'hover:text-red-300', 'font-bold', 'px-2', 'flex-shrink-0', 'focus:outline-none', 'focus:ring-1', 'focus:ring-red-500', 'rounded');
  deleteButton.innerHTML = '&times;'; // Use HTML entity for 'x'
  deleteButton.title = 'Delete Item';
  deleteButton.setAttribute('aria-label', 'Delete this item');

  itemDiv.appendChild(itemIcon);
  itemDiv.appendChild(statusDropdown);
  itemDiv.appendChild(descriptionInput);
  itemDiv.appendChild(deleteButton);

  return itemDiv;
}


// --- Event Handling Dispatcher ---

/**
 * Handles clicks, changes, input, and blur events within the roadmap output area using event delegation.
 * Acts as a dispatcher, routing events to specific private helper functions.
 * Exported to be attached as a listener in the main script.
 * @param {Event} event - The event object.
 */
export function handleRoadmapInteraction(event) {
  const target = event.target;

  // --- Click Events ---
  if (event.type === 'click') {
    if (target.matches('.add-item-btn')) {
      _handleAddLineItem(target);
      return; // Handled
    }
    if (target.matches('.delete-item-button')) {
      _handleDeleteLineItem(target);
      return; // Handled
    }
  }

  // --- Change Events ---
  else if (event.type === 'change') {
    if (target.matches('.milestone-date')) {
      _handleMilestoneDateChange(event);
      return; // Handled
    }
    if (target.matches('.status-dropdown')) {
      _handleChangeItemStatus(event);
      return; // Handled
    }
  }

  // --- Input Events ---
  else if (event.type === 'input') {
    if (target.matches('.milestone-section h3[contenteditable="true"]')) {
      _handleMilestoneTitleInteraction(event);
      return; // Handled
    }
    if (target.matches('.item-description')) {
      _handleItemDescriptionInput(event);
      return; // Handled
    }
  }

  // --- Blur Events (using capture in script.js) ---
  else if (event.type === 'blur') {
    if (target.matches('.milestone-section h3[contenteditable="true"]')) {
      _handleMilestoneTitleInteraction(event); // Trigger save on blur too
      return; // Handled
    }
    if (target.matches('.milestone-date')) {
      _handleMilestoneDateBlur(event); // Handle setting original date
      // Note: Autosave for date is primarily triggered by the 'change' event handler
      return; // Handled
    }
  }
}


// --- Status Management Integration ---

/**
 * Updates all status dropdowns in the roadmap items to reflect changes in the global STATUSES array.
 * Exported to be called by statusManager when statuses are added, removed, or renamed.
 * @param {string | null} [oldName=null] - The previous name of the status that might have changed.
 * @param {string | null} [newName=null] - The new name of the status if it changed.
 * @param {string | null} [removedName=null] - The name of a status that was just removed.
 */
export function updateRoadmapDropdowns(oldName = null, newName = null, removedName = null) {
  const dropdowns = roadmapOutputDiv.querySelectorAll('.status-dropdown');
  const statuses = getStatuses();

  dropdowns.forEach(dropdown => {
    const currentChecklistItem = dropdown.closest('.checklist-item');
    if (!currentChecklistItem) return;

    let currentSelectedValue = currentChecklistItem.dataset.status; // Get status from data attribute
    let valueToSelectAfterUpdate = currentSelectedValue;
    let statusIconNeedsUpdate = false;

    // If a name change occurred and this item had the old name, update the target value
    if (oldName && newName && oldName !== newName && currentSelectedValue === oldName) {
      valueToSelectAfterUpdate = newName;
    }

    let valueFoundInNewOptions = false;
    dropdown.innerHTML = ''; // Clear existing options

    // Re-populate with current statuses
    statuses.forEach((status) => {
      const option = document.createElement('option');
      option.value = status.name;
      option.textContent = status.name;
      if (status.name === valueToSelectAfterUpdate) {
        option.selected = true;
        valueFoundInNewOptions = true;
      }
      dropdown.appendChild(option);
    });

    // Handle cases where the selected status was removed or doesn't exist anymore
    if (valueFoundInNewOptions) {
      // If the value changed due to rename, update the data attribute
      if (currentChecklistItem.dataset.status !== valueToSelectAfterUpdate) {
          currentChecklistItem.dataset.status = valueToSelectAfterUpdate;
          // Icon update is handled by updateChecklistItemIcons if only icon changed,
          // but if name changed, we might need to update icon here too if not handled elsewhere.
          // However, statusManager should call updateChecklistItemIcons if icon changes.
          // Let's assume icon is correct unless status was removed/reset.
      }
      dropdown.value = valueToSelectAfterUpdate; // Ensure visual selection matches
    } else {
      // The previously selected status is gone (either removed or renamed and wasn't the 'oldName')
      const firstStatusName = statuses.length > 0 ? statuses[0].name : 'Not Started'; // Fallback
      currentChecklistItem.dataset.status = firstStatusName; // Update data attribute to fallback
      if (dropdown.options.length > 0) {
        dropdown.value = firstStatusName; // Set dropdown to fallback
        dropdown.options[0].selected = true;
      }
      statusIconNeedsUpdate = true; // Icon needs reset to fallback status

      const statusWasRemoved = removedName && currentSelectedValue === removedName;
      if (statusWasRemoved) {
        console.warn(`Status "${currentSelectedValue}" was removed. Item reset to "${firstStatusName}".`);
      } else {
        console.warn(`Status "${currentSelectedValue}" no longer exists or couldn't map. Item reset to "${firstStatusName}".`);
      }
    }

    // Update the icon if it was reset to a fallback status
    if (statusIconNeedsUpdate) {
        const fallbackStatusObj = statuses.find(s => s.name === currentChecklistItem.dataset.status) || { icon: '❓', name: currentChecklistItem.dataset.status };
        const itemIcon = currentChecklistItem.querySelector('.checklist-item-status-icon');
        if (itemIcon) {
            itemIcon.textContent = fallbackStatusObj.icon;
            itemIcon.setAttribute('aria-label', fallbackStatusObj.name);
        }
    }
  });
}

/**
 * Updates the visual icons for all checklist items currently set to a specific status.
 * Exported to be called by statusManager after a status icon has been changed.
 * @param {number} updatedStatusIndex - The index in the STATUSES array of the status whose icon was updated.
 */
export function updateChecklistItemIcons(updatedStatusIndex) {
  const statuses = getStatuses();
  if (updatedStatusIndex < 0 || updatedStatusIndex >= statuses.length) return;

  const updatedStatus = statuses[updatedStatusIndex];
  const updatedStatusName = updatedStatus.name;
  const newIcon = updatedStatus.icon;

  // Escape the status name for use in the attribute selector
  const escapedStatusName = CSS.escape(updatedStatusName);
  const selector = `.checklist-item[data-status="${escapedStatusName}"]`;

  const itemsToUpdate = roadmapOutputDiv.querySelectorAll(selector);

  itemsToUpdate.forEach(item => {
    const itemIcon = item.querySelector('.checklist-item-status-icon');
    if (itemIcon) {
      itemIcon.textContent = newIcon;
      itemIcon.setAttribute('aria-label', updatedStatusName); // Keep aria-label updated
    }
  });
}

// No need for explicit export block if using `export function ...` syntax for all exports.
