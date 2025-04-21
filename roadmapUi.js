// roadmapUi.js
// Handles roadmap generation, rendering, and interactions within the roadmap display area.

import { getStatuses } from './statusManager.js';

// --- DOM Element References ---
// References needed for generateRoadmap and UI updates within this module
const completionDateInput = document.getElementById('completion-date');
const timeIncrementSelect = document.getElementById('time-increment');
const roadmapOutputDiv = document.getElementById('roadmap-output');
const exportButtonsContainer = document.getElementById('export-buttons-container');
const addIncrementButton = document.getElementById('add-increment-button'); // Added button reference

// --- Core Application Logic ---

/**
 * Orchestrates the roadmap generation process.
 * Exported to be called by the main script's event listener.
 */
export function generateRoadmap() {
    // Ensure button is hidden and state is cleared at the start
    if (addIncrementButton) {
        addIncrementButton.classList.add('hidden');
    }
    // Clear previous state attributes if they exist
    delete roadmapOutputDiv.dataset.nextSegmentStartDate;
    delete roadmapOutputDiv.dataset.incrementType;

    // 1. Get User Input
    const endDateString = completionDateInput.value;
    const increment = timeIncrementSelect.value;

    // 2. Validate Input
    if (!endDateString) {
        alert('Please select a completion date.');
        return;
    }
    const endDate = new Date(endDateString + 'T00:00:00');
    const startDate = new Date();
    startDate.setHours(0, 0, 0, 0); // Normalize start date to beginning of the day

    if (endDate < startDate) {
        alert('Completion date cannot be in the past.');
        return;
    }

    // 3. Clear Previous Output
    roadmapOutputDiv.innerHTML = '';
    exportButtonsContainer.classList.add('hidden'); // Hide buttons until generation

    // 4. Calculate Segments
    const segments = calculateSegments(startDate, endDate, increment);

    // 5. Render Roadmap UI
    renderRoadmap(segments);

    // 6. Show Export Buttons and potentially the "Add Increment" button
    if (segments.length > 0) {
        exportButtonsContainer.classList.remove('hidden');

        // Calculate the start date for the next potential segment
        const lastSegmentDate = new Date(startDate);
        let nextStartDate = new Date(startDate); // Initialize

        // Re-calculate the end date of the *last* generated segment to find the start of the *next* one
        // This logic mirrors the segment calculation loop but just finds the next start date
        let tempCurrentDate = new Date(startDate);
        for (let i = 0; i < segments.length; i++) {
             let tempNextDate = new Date(tempCurrentDate);
             switch (increment) {
                 case 'Quarters':
                     const qYear = tempCurrentDate.getFullYear();
                     const qMonth = tempCurrentDate.getMonth();
                     const nextQMonth = (Math.floor(qMonth / 3) + 1) * 3;
                     tempNextDate.setFullYear(qYear, nextQMonth, 1);
                     break;
                 case 'Months':
                     tempNextDate.setMonth(tempCurrentDate.getMonth() + 1, 1);
                     break;
                 case 'Weeks':
                     tempNextDate.setDate(tempCurrentDate.getDate() - tempCurrentDate.getDay() + 7);
                     break;
             }
             tempCurrentDate = new Date(tempNextDate); // Move to the start of the next segment for the next iteration
        }
        nextStartDate = tempCurrentDate; // The start date of the segment *after* the last one generated

        // Store state and show the button
        roadmapOutputDiv.dataset.nextSegmentStartDate = nextStartDate.toISOString();
        roadmapOutputDiv.dataset.incrementType = increment;
        if (addIncrementButton) {
            addIncrementButton.classList.remove('hidden');
        }

    } else {
        // Ensure add button remains hidden if no segments generated
        if (addIncrementButton) {
            addIncrementButton.classList.add('hidden');
        }
    }
}

/**
 * Calculates the time segments based on start date, end date, and increment.
 * @param {Date} startDate - The starting date.
 * @param {Date} endDate - The ending date.
 * @param {string} increment - The time increment ('Quarters', 'Months', 'Weeks').
 * @returns {string[]} An array of segment name strings.
 */
function calculateSegments(startDate, endDate, increment) {
    const segments = [];
    let currentSegmentDate = new Date(startDate);

    while (currentSegmentDate <= endDate) {
        let segmentName = '';
        let nextSegmentDate = new Date(currentSegmentDate);

        switch (increment) {
            case 'Quarters':
                const year = currentSegmentDate.getFullYear();
                const month = currentSegmentDate.getMonth();
                const quarter = Math.floor(month / 3) + 1;
                segmentName = `Q${quarter} ${year}`;
                const nextQuarterMonth = (Math.floor(month / 3) + 1) * 3;
                nextSegmentDate.setFullYear(year, nextQuarterMonth, 1);
                break;
            case 'Months':
                segmentName = currentSegmentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
                nextSegmentDate.setMonth(currentSegmentDate.getMonth() + 1, 1);
                break;
            case 'Weeks':
                // Calculate the start of the week (Sunday)
                const weekStartDate = new Date(currentSegmentDate);
                weekStartDate.setDate(currentSegmentDate.getDate() - currentSegmentDate.getDay());
                segmentName = `Week of ${weekStartDate.toLocaleDateString('en-CA')}`; // YYYY-MM-DD format
                // Calculate the start of the next week
                nextSegmentDate.setDate(currentSegmentDate.getDate() - currentSegmentDate.getDay() + 7);
                break;
        }

        // Only add the segment if its start date is on or before the end date
        if (currentSegmentDate <= endDate) {
            segments.push(segmentName);
        }

        // Move to the start of the next segment
        currentSegmentDate = new Date(nextSegmentDate);

        // Safety break
        if (segments.length > 1000) {
             console.error("Potential infinite loop detected in segment calculation. Breaking.");
             break;
        }
    }
    return segments;
}


/**
 * Calculates the name and the start date of the *next* period based on a given start date and increment.
 * @param {Date} startDate - The starting date of the *current* segment.
 * @param {string} increment - The time increment ('Quarters', 'Months', 'Weeks').
 * @returns {{segmentName: string, nextPeriodStartDate: Date} | null} An object with the current segment's name and the next period's start date, or null on error.
 */
function calculateNextSegment(startDate, increment) {
    if (!(startDate instanceof Date) || isNaN(startDate)) {
        console.error("Invalid start date provided to calculateNextSegment");
        return null;
    }

    let segmentName = '';
    let nextPeriodStartDate = new Date(startDate); // Start with the current date

    try {
        switch (increment) {
            case 'Quarters':
                const year = startDate.getFullYear();
                const month = startDate.getMonth();
                const quarter = Math.floor(month / 3) + 1;
                segmentName = `Q${quarter} ${year}`;
                const nextQuarterMonth = (Math.floor(month / 3) + 1) * 3;
                nextPeriodStartDate.setFullYear(year, nextQuarterMonth, 1);
                break;
            case 'Months':
                segmentName = startDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
                nextPeriodStartDate.setMonth(startDate.getMonth() + 1, 1);
                break;
            case 'Weeks':
                const weekStartDate = new Date(startDate);
                weekStartDate.setDate(startDate.getDate() - startDate.getDay()); // Start of the current week (Sunday)
                segmentName = `Week of ${weekStartDate.toLocaleDateString('en-CA')}`; // YYYY-MM-DD format
                nextPeriodStartDate.setDate(startDate.getDate() - startDate.getDay() + 7); // Start of the next week
                break;
            default:
                 console.error(`Invalid increment type: ${increment}`);
                 return null; // Indicate error
        }
        return { segmentName, nextPeriodStartDate };
    } catch (error) {
        console.error("Error calculating next segment:", error);
        return null; // Indicate error
    }
}


/**
 * Renders the roadmap UI by creating segment elements for each segment name.
 * @param {string[]} segments - An array of segment name strings.
 */
function renderRoadmap(segments) {
    const fragment = document.createDocumentFragment();
    segments.forEach(segmentName => {
        const periodContainer = createSegmentElement(segmentName);
        fragment.appendChild(periodContainer);
    });
    roadmapOutputDiv.appendChild(fragment);
}

/**
 * Creates the HTML structure for a single time period segment and returns it.
 * @param {string} segmentName - The name of the segment (e.g., "Q2 2025").
 * @returns {HTMLElement} The created period container element.
 */
function createSegmentElement(segmentName) {
    const periodContainer = document.createElement('div');
    // Set dark as default
    periodContainer.classList.add('p-4', 'bg-gray-700/50', 'rounded', 'border', 'border-gray-600', 'mb-4');

    const headerDiv = document.createElement('div');
    // Apply Flexbox for alignment
    headerDiv.classList.add('period-header', 'flex', 'items-center', 'gap-4'); // Added flex, items-center, gap-4

    const heading = document.createElement('h2');
    heading.textContent = segmentName;
    // Set dark as default
    heading.classList.add('text-lg', 'font-semibold', 'text-gray-100', 'flex-shrink-0');

    // --- Custom Title Input ---
    const customTitleInput = document.createElement('input');
    customTitleInput.type = 'text';
    // Set dark as default
    customTitleInput.classList.add('period-custom-title', 'flex-grow', 'p-1', 'border', 'border-gray-500', 'bg-gray-600', 'rounded', 'text-sm', 'text-gray-200', 'placeholder-gray-400', 'italic');
    customTitleInput.placeholder = 'Add optional title for this period...';
    // --- End Custom Title Input ---

    const addItemButton = document.createElement('button');
    addItemButton.textContent = '+ Add Item';
    // Set dark as default
    addItemButton.classList.add('add-item-button', 'flex-shrink-0', 'bg-blue-500', 'hover:bg-blue-600', 'text-white', 'font-bold', 'py-1', 'px-2', 'rounded', 'text-sm', 'focus:outline-none', 'focus:ring-2', 'focus:ring-offset-2', 'focus:ring-blue-600');

    headerDiv.appendChild(heading);
    headerDiv.appendChild(customTitleInput); // Add the custom title input
    headerDiv.appendChild(addItemButton);

    const itemsContainer = document.createElement('div');
    itemsContainer.classList.add('items-container', 'mt-2'); // Keep class for styling/selection

    periodContainer.appendChild(headerDiv);
    periodContainer.appendChild(itemsContainer);

    return periodContainer;
}

// --- Checklist UI Interaction ---

/**
 * Handles clicks and changes within the **roadmap output area** using event delegation.
 * Exported to be attached as a listener in the main script.
 * @param {Event} event - The click, change, or input event object.
 */
export function handleRoadmapInteraction(event) {
    const target = event.target;

    // --- Handle Add Increment Button Click ---
    if (target.matches('#add-increment-button')) {
        addNextTimeIncrement();
        return; // Prevent further processing in this handler
    }

    // --- Existing Handlers ---
    const statuses = getStatuses(); // Get current statuses

    // --- Handle Custom Title Input ---
    if (event.type === 'input' && target.matches('.period-custom-title')) {
        // Use a more reliable selector for the parent container, independent of background color
        const periodContainer = target.closest('.p-4.mb-4');
        if (periodContainer) {
            periodContainer.dataset.customTitle = target.value;
        }
        return; // Don't process other events if it was just typing in the title
    }

    // --- Handle Status Dropdown Change ---
    if (event.type === 'change' && target.matches('.status-dropdown')) {
        const statusDropdown = target;
        const checklistItem = statusDropdown.closest('.checklist-item');
        if (checklistItem) {
            const newStatusName = statusDropdown.value;
            checklistItem.dataset.status = newStatusName; // Update data attribute

            // Update the icon displayed in the row
            const newStatusObj = statuses.find(s => s.name === newStatusName) || { icon: '❓' }; // Use icon property and default Emoji
            const itemIcon = checklistItem.querySelector('.checklist-item-status-icon'); // Select the span
            if (itemIcon) {
                itemIcon.textContent = newStatusObj.icon; // Update text content with Emoji
                itemIcon.setAttribute('aria-label', newStatusName); // Update accessibility label
            }
        }
        return;
    }

    // --- Handle Click Events ---

    // Check if an "Add Item" button was clicked
    const addButton = target.closest('.add-item-button');
    if (addButton) {
        const itemsContainer = addButton.closest('.period-header').nextElementSibling;
        if (itemsContainer && itemsContainer.classList.contains('items-container')) {
            const newItem = createChecklistItemElement(); // Uses getStatuses() internally
            itemsContainer.appendChild(newItem);
        } else {
            console.error("Could not find items container for the 'Add Item' button.");
        }
        return;
    }

    // Check if a "Delete Item" button was clicked
    const deleteButton = target.closest('.delete-item-button');
    if (deleteButton) {
        const checklistItem = deleteButton.closest('.checklist-item');
        if (checklistItem) {
            checklistItem.remove();
        }
        return;
    }
}


/**
 * Adds the next time increment segment to the roadmap based on stored state.
 * This function is called internally by the event handler.
 */
function addNextTimeIncrement() {
    if (!roadmapOutputDiv || !addIncrementButton) {
        console.error("Required elements not found for adding increment.");
        return; // Safety check
    }

    const incrementType = roadmapOutputDiv.dataset.incrementType;
    const startDateString = roadmapOutputDiv.dataset.nextSegmentStartDate;

    if (!incrementType || !startDateString) {
        console.error("Missing state data (incrementType or nextSegmentStartDate) for adding next increment.");
        addIncrementButton.classList.add('hidden'); // Hide button if state is lost
        return;
    }

    try {
        const currentStartDate = new Date(startDateString);
        if (isNaN(currentStartDate)) {
             console.error("Invalid date string stored in dataset:", startDateString);
             addIncrementButton.classList.add('hidden');
             return;
        }

        const result = calculateNextSegment(currentStartDate, incrementType);

        // Check if calculation was successful
        if (!result || !result.segmentName || !result.nextPeriodStartDate) {
            console.error("Failed to calculate next segment details.");
             addIncrementButton.classList.add('hidden'); // Hide on error
            return;
        }

        const { segmentName, nextPeriodStartDate } = result;

        const newSegmentElement = createSegmentElement(segmentName);
        roadmapOutputDiv.appendChild(newSegmentElement);

        // Update the state for the *next* button press
        roadmapOutputDiv.dataset.nextSegmentStartDate = nextPeriodStartDate.toISOString();

        console.log(`Added segment: ${segmentName}. Next starts: ${nextPeriodStartDate.toISOString()}`);

        // Optional: Scroll the new segment into view
        newSegmentElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });


    } catch (error) {
         console.error("Error adding next time increment:", error);
         addIncrementButton.classList.add('hidden'); // Hide button on error
    }
}


/**
 * Creates the HTML structure for a single checklist item.
 * @returns {HTMLElement} The newly created checklist item div.
 */
function createChecklistItemElement() {
    const itemDiv = document.createElement('div');
    // Set dark as default
    itemDiv.classList.add('checklist-item', 'flex', 'items-center', 'mb-2', 'p-2', 'rounded', 'border', 'bg-gray-700', 'border-gray-600');

    const statuses = getStatuses(); // Get current statuses
    const initialStatusName = statuses.length > 0 ? statuses[0].name : 'Not Started';
    itemDiv.dataset.status = initialStatusName;
    const initialStatusObj = statuses.find(s => s.name === initialStatusName) || { icon: '❓' }; // Use icon property and default Emoji
    const initialIcon = initialStatusObj.icon;

    // Icon Element (Span for Emoji)
    const itemIcon = document.createElement('span');
    // Set dark as default (applied to parent or via CSS)
    itemIcon.classList.add('checklist-item-status-icon', 'mr-2'); // Add new class, keep margin
    itemIcon.textContent = initialIcon;
    itemIcon.setAttribute('aria-label', initialStatusName); // Accessibility
    // Removed aria-hidden

    // Status Dropdown
    const statusDropdown = document.createElement('select');
    // Set dark as default
    statusDropdown.classList.add('status-dropdown', 'border', 'border-gray-500', 'bg-gray-600', 'text-gray-100', 'rounded', 'p-1', 'mr-2', 'text-sm');

    statuses.forEach((status) => {
        const option = document.createElement('option');
        option.value = status.name;
        option.textContent = status.name;
        if (status.name === initialStatusName) {
            option.selected = true;
        }
        statusDropdown.appendChild(option);
    });

    // Description Input
    const descriptionInput = document.createElement('input');
    descriptionInput.type = 'text';
    // Set dark as default
    descriptionInput.classList.add('item-description', 'border', 'border-gray-500', 'bg-gray-600', 'text-gray-100', 'placeholder-gray-400', 'rounded', 'p-1', 'flex-grow');
    descriptionInput.placeholder = 'Enter task description...';

    // Delete Button
    const deleteButton = document.createElement('button');
    // Set dark as default
    deleteButton.classList.add('delete-item-button', 'ml-auto', 'text-red-400', 'hover:text-red-300', 'font-bold', 'px-2');
    deleteButton.innerHTML = '&times;';
    deleteButton.title = 'Delete Item';

    itemDiv.appendChild(itemIcon);
    itemDiv.appendChild(statusDropdown);
    itemDiv.appendChild(descriptionInput);
    itemDiv.appendChild(deleteButton);

    return itemDiv;
}

/**
 * Updates all status dropdowns in the roadmap items to reflect changes in the global STATUSES array.
 * Exported to be called by statusManager when statuses are added, removed, or renamed.
 * @param {string | null} [oldName=null] - The previous name of the status that might have changed.
 * @param {string | null} [newName=null] - The new name of the status if it changed.
 * @param {string | null} [removedName=null] - The name of a status that was just removed.
 */
export function updateRoadmapDropdowns(oldName = null, newName = null, removedName = null) {
    const dropdowns = roadmapOutputDiv.querySelectorAll('.status-dropdown');
    const statuses = getStatuses(); // Get current statuses
    console.log(`Updating ${dropdowns.length} roadmap dropdowns...`);

    dropdowns.forEach(dropdown => {
        const currentChecklistItem = dropdown.closest('.checklist-item');
        if (!currentChecklistItem) return;

        let currentSelectedValue = currentChecklistItem.dataset.status;
        let valueToSelect = currentSelectedValue;

        // If a name change occurred and this item had the old name, update the target value
        if (oldName && newName && oldName !== newName && currentSelectedValue === oldName) {
            valueToSelect = newName;
            console.log(`Item with old status "${oldName}" will be updated to "${newName}"`);
        }

        let valueFoundInNewOptions = false;
        dropdown.innerHTML = ''; // Clear existing options

        // Re-populate with current statuses
        statuses.forEach((status) => {
            const option = document.createElement('option');
            option.value = status.name;
            option.textContent = status.name;
            if (status.name === valueToSelect) {
                option.selected = true;
                valueFoundInNewOptions = true;
            }
            dropdown.appendChild(option);
        });

        // Handle cases where the selected status was removed or doesn't exist anymore
        if (valueFoundInNewOptions) {
             currentChecklistItem.dataset.status = valueToSelect;
             dropdown.value = valueToSelect; // Ensure visual selection matches
        } else {
            const statusWasRemoved = removedName && currentSelectedValue === removedName;
            const firstStatusName = statuses.length > 0 ? statuses[0].name : 'Not Started'; // Fallback
            currentChecklistItem.dataset.status = firstStatusName;
            if (dropdown.options.length > 0) {
                dropdown.value = firstStatusName;
                dropdown.options[0].selected = true;
            }
            if (statusWasRemoved) {
                console.warn(`Status "${currentSelectedValue}" was removed. Reset item to "${firstStatusName}".`);
            } else {
                console.warn(`Status "${currentSelectedValue}" no longer exists or couldn't map. Reset item to "${firstStatusName}".`);
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
    const statuses = getStatuses(); // Get current statuses
    if (updatedStatusIndex < 0 || updatedStatusIndex >= statuses.length) return;

    const updatedStatus = statuses[updatedStatusIndex];
    const updatedStatusName = updatedStatus.name;
    const newIcon = updatedStatus.icon; // Use icon property

    console.log(`Updating icons for status: ${updatedStatusName} to ${newIcon}`); // Update log message

    // Escape the status name for use in the attribute selector
    const escapedStatusName = updatedStatusName.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    const selector = `.checklist-item[data-status="${escapedStatusName}"]`;

    const itemsToUpdate = roadmapOutputDiv.querySelectorAll(selector);

    itemsToUpdate.forEach(item => {
        const itemIcon = item.querySelector('.checklist-item-status-icon'); // Select the span
        if (itemIcon) {
            itemIcon.textContent = newIcon; // Update text content with Emoji
            itemIcon.setAttribute('aria-label', updatedStatusName); // Update accessibility label
        }
    });
}
