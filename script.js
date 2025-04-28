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

// --- Supabase Setup ---
const SUPABASE_URL = 'https://yqwriqmasqizkabumtpb.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlxd3JpcW1hc3FpemthYnVtdHBiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDU4MjI5MzgsImV4cCI6MjA2MTM5ODkzOH0.c-ezKMFev7anG2HgycTqSyf0DIZdsVU5gJRzVy-YA2o';
const SUPABASE_EDGE_FUNCTION_URL = 'https://yqwriqmasqizkabumtpb.supabase.co/functions/v1/generate-ai-roadmap';

// Check if Supabase is available (it should be from the CDN link)
if (!window.supabase) {
    console.error("Supabase client library not found. Make sure the CDN link is included in index.html.");
    alert("Error: Supabase library failed to load. Application cannot start.");
}
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
console.log("Supabase client initialized.");

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
// const loadButton = document.getElementById('load-roadmap-button'); // Removed old load button reference
// const saveLoadStatusSpan = document.getElementById('saveLoadStatus'); // Removed old general status span reference
// AI Related UI
const aiPromptInput = document.getElementById('ai-prompt-input');
const generateAiButton = document.getElementById('generate-ai-roadmap-btn');
const aiButtonSpinner = document.querySelector('#generate-ai-roadmap-btn .spinner-border'); // More specific selector
const aiStatusMessage = document.getElementById('ai-status-message');
const roadmapPlaceholder = document.getElementById('roadmap-placeholder');
// Auth UI Elements
const authSection = document.getElementById('auth-section');
const authForms = document.getElementById('auth-forms');
const signupForm = document.getElementById('signup-form');
const loginForm = document.getElementById('login-form');
const signupEmailInput = document.getElementById('signup-email');
const signupPasswordInput = document.getElementById('signup-password');
const loginEmailInput = document.getElementById('login-email');
const loginPasswordInput = document.getElementById('login-password');
const userStatusDiv = document.getElementById('user-status');
const userEmailSpan = document.getElementById('user-email');
const logoutButton = document.getElementById('logout-button');
const authStatusMessage = document.getElementById('auth-status-message');
// Load UI Elements
const savedRoadmapsSection = document.getElementById('saved-roadmaps-section');
const savedRoadmapsListDiv = document.getElementById('saved-roadmaps-list');
const loadStatusMessage = document.getElementById('load-status-message');


// --- State Variables ---
let loadedRoadmapId = null; // Track the ID of the currently loaded/saved roadmap from Supabase


// --- Constants ---
// Removed ROADMAP_STORAGE_KEY and BACKEND_API_URL


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
    // <-- EXTRA BRACE REMOVED
}

/**
 * Updates the authentication status message span.
 * @param {string} message - The message to display.
 * @param {boolean} [isError=true] - If true, style as an error (default).
 * @param {number} [timeout=5000] - Duration before clearing the message (0 for persistent).
 */
function updateAuthStatusMessage(message, isError = true, timeout = 5000) {
    if (authStatusMessage) {
        authStatusMessage.textContent = message;
        authStatusMessage.style.color = isError ? '#dc2626' : '#16a34a'; // Tailwind red-600 / green-600
        authStatusMessage.classList.toggle('text-danger', isError);
        authStatusMessage.classList.toggle('text-success', !isError);

        if (timeout > 0) {
            setTimeout(() => {
                if (authStatusMessage.textContent === message) {
                    authStatusMessage.textContent = '';
                    authStatusMessage.classList.remove('text-danger', 'text-success');
                }
            }, timeout);
        }
    } else {
        console.warn("Auth status message element not found.");
    }
    // <-- EXTRA BRACE REMOVED
}

/**
 * Updates the load status message span.
 * @param {string} message - The message to display.
 * @param {boolean} [isError=false] - If true, style as an error.
 * @param {number} [timeout=3000] - Duration before clearing the message (0 for persistent).
 */
function updateLoadStatusMessage(message, isError = false, timeout = 3000) {
    if (loadStatusMessage) {
        loadStatusMessage.textContent = message;
        loadStatusMessage.style.color = isError ? '#dc2626' : '#6b7280'; // red-600 / gray-500
        loadStatusMessage.classList.toggle('text-danger', isError);

        if (timeout > 0) {
            setTimeout(() => {
                if (loadStatusMessage.textContent === message) {
                    loadStatusMessage.textContent = '';
                    loadStatusMessage.classList.remove('text-danger');
                }
            }, timeout);
        }
    } else {
        console.warn("Load status message element not found.");
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
 * Saves the roadmap configuration to Supabase. Statuses are saved separately by statusManager.
 * @param {boolean} [isAutoSave=false] - Indicates if this is an automatic save.
 */
async function performSave(isAutoSave = false) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
        if (!isAutoSave) { // Only show message on manual save attempt when logged out
             updateStatusMessage("Please log in to save your roadmap.", true);
        }
        console.log("Save aborted: User not logged in.");
        return;
    }
    const userId = session.user.id;

    if (!isAutoSave) {
        updateStatusMessage("Saving to cloud...", false, 0); // Show persistent "Saving..." for manual save
    }

    const currentRoadmapData = getCurrentRoadmapState(); // Gets { roadmapName: '..', milestones: [...] }
    if (!currentRoadmapData || !currentRoadmapData.milestones) {
        updateStatusMessage("Save failed: Could not read roadmap state.", true);
        return; // Don't proceed if state reading failed
    }

    // Extract purpose from the first milestone if available (or adapt as needed)
    // This assumes purpose is stored per-milestone in the UI, but we save one purpose per roadmap.
    // A better approach might be a dedicated purpose input field.
    const firstMilestonePurpose = currentRoadmapData.milestones[0]?.purpose || '';

    const roadmapRecord = {
        user_id: userId,
        title: currentRoadmapData.roadmapName || 'Untitled Roadmap',
        purpose: firstMilestonePurpose, // Adjust if purpose is handled differently
        roadmap_data: currentRoadmapData.milestones // Store the milestones array directly in JSONB
        // created_at and updated_at should be handled by Supabase defaults/triggers
    };

    try {
        let resultData;
        let error;

        if (loadedRoadmapId) {
            // Update existing roadmap
            console.log(`Attempting to update roadmap ID: ${loadedRoadmapId}`);
            const { data, error: updateError } = await supabase
                .from('roadmaps')
                .update({
                    ...roadmapRecord,
                    updated_at: new Date().toISOString() // Explicitly set updated_at
                 })
                .eq('id', loadedRoadmapId)
                .eq('user_id', userId) // RLS should handle this, but good for clarity
                .select('id') // Select the ID to confirm update and keep track
                .single(); // Expecting a single record back

            resultData = data;
            error = updateError;

        } else {
            // Insert new roadmap
            console.log("Attempting to insert new roadmap.");
            const { data, error: insertError } = await supabase
                .from('roadmaps')
                .insert(roadmapRecord)
                .select('id') // Select the ID of the newly inserted record
                .single(); // Expecting a single record back

            resultData = data;
            error = insertError;
        }

        if (error) {
            console.error("Error saving roadmap to Supabase:", error);
            throw error; // Throw to be caught by the outer catch block
        }

        if (resultData && resultData.id) {
             loadedRoadmapId = resultData.id; // Update the loaded ID (important for subsequent saves)
             console.log(`Roadmap saved successfully with ID: ${loadedRoadmapId}`);
             if (!isAutoSave) {
                 updateStatusMessage("Roadmap saved!", false);
             }
        } else {
             // This case might happen if RLS prevents the select after insert/update
             console.warn("Roadmap saved, but could not retrieve ID after operation. RLS might be configured strictly.", resultData);
             if (!loadedRoadmapId && !isAutoSave) { // If it was an insert and we didn't get an ID back
                updateStatusMessage("Roadmap saved (but failed to get new ID).", false);
             } else if (!isAutoSave) {
                updateStatusMessage("Roadmap updated!", false);
             }
             // We might lose track of the ID here if it was a new insert.
             // Consider fetching the latest roadmap by title/timestamp if this happens often.
        }

    } catch (error) {
        console.error("Error saving roadmap:", error);
        const message = isAutoSave ? "Autosave error." : "Error saving roadmap!";
        updateStatusMessage(message, true);
        if (!isAutoSave) {
            alert(`Error saving data: ${error.message}. Please check the console.`);
        }
    }
}


// --- Load Roadmap List from Supabase ---
/**
 * Fetches the list of saved roadmaps for the current user and populates the UI.
 */
async function loadUserRoadmapsList() {
    if (!savedRoadmapsSection || !savedRoadmapsListDiv) return;

    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
        savedRoadmapsListDiv.innerHTML = '<span class="list-group-item text-muted small">Please log in to see your saved roadmaps.</span>';
        savedRoadmapsSection.classList.add('d-none'); // Hide if logged out
        return;
    }
    const userId = session.user.id;

    savedRoadmapsSection.classList.remove('d-none'); // Show the section
    savedRoadmapsListDiv.innerHTML = '<span class="list-group-item text-muted small">Loading your roadmaps...</span>'; // Loading indicator
    updateLoadStatusMessage(''); // Clear previous load messages

    try {
        const { data: roadmaps, error } = await supabase
            .from('roadmaps')
            .select('id, title, created_at')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (error) {
            console.error("Error fetching roadmap list:", error);
            savedRoadmapsListDiv.innerHTML = '<span class="list-group-item text-danger small">Error loading roadmaps.</span>';
            updateLoadStatusMessage(`Error: ${error.message}`, true);
            return;
        }

        if (!roadmaps || roadmaps.length === 0) {
            savedRoadmapsListDiv.innerHTML = '<span class="list-group-item text-muted small">No saved roadmaps found.</span>';
            return;
        }

        // Populate the list
        savedRoadmapsListDiv.innerHTML = ''; // Clear loading/error message
        roadmaps.forEach(roadmap => {
            const item = document.createElement('button');
            item.type = 'button';
            item.classList.add('list-group-item', 'list-group-item-action', 'd-flex', 'justify-content-between', 'align-items-center');
            item.dataset.roadmapId = roadmap.id; // Store ID for click handler

            const titleSpan = document.createElement('span');
            titleSpan.textContent = roadmap.title || 'Untitled Roadmap';
            titleSpan.classList.add('roadmap-title'); // Add class for potential styling

            const dateSpan = document.createElement('span');
            dateSpan.textContent = new Date(roadmap.created_at).toLocaleDateString();
            dateSpan.classList.add('badge', 'bg-secondary', 'rounded-pill', 'ms-2'); // Style date

            item.appendChild(titleSpan);
            item.appendChild(dateSpan);
            savedRoadmapsListDiv.appendChild(item);
        });

    } catch (error) {
        console.error("Exception fetching roadmap list:", error);
        savedRoadmapsListDiv.innerHTML = '<span class="list-group-item text-danger small">An unexpected error occurred while loading roadmaps.</span>';
        updateLoadStatusMessage("Unexpected error loading list.", true);
    }
}

/**
 * Handles clicks on the saved roadmaps list to load a specific roadmap.
 * @param {Event} event - The click event object.
 */
async function handleLoadSpecificRoadmap(event) {
    const targetButton = event.target.closest('.list-group-item-action');
    if (!targetButton || !targetButton.dataset.roadmapId) {
        return; // Click wasn't on a loadable item
    }

    const roadmapId = targetButton.dataset.roadmapId;
    console.log(`Load requested for roadmap ID: ${roadmapId}`);
    updateLoadStatusMessage(`Loading roadmap...`, false, 0);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
        updateLoadStatusMessage("Error: Not logged in.", true);
        return;
    }
    const userId = session.user.id;

    try {
        const { data: roadmapData, error } = await supabase
            .from('roadmaps')
            .select('*') // Select all columns for the specific roadmap
            .eq('id', roadmapId)
            .eq('user_id', userId) // Ensure user owns this roadmap (RLS enforces this too)
            .single(); // Expect only one result

        if (error) {
            console.error("Error fetching specific roadmap:", error);
            updateLoadStatusMessage(`Error loading: ${error.message}`, true);
            loadedRoadmapId = null; // Reset loaded ID on error
            return;
        }

        if (!roadmapData) {
            console.error("Roadmap data not found for ID:", roadmapId);
            updateLoadStatusMessage("Error: Roadmap not found.", true);
            loadedRoadmapId = null; // Reset loaded ID
            return;
        }

        console.log("Loaded roadmap data:", roadmapData);

        // Prepare data for rendering function (adapt structure)
        // The database stores milestones in 'roadmap_data' and title in 'title'
        const renderData = {
            roadmapName: roadmapData.title,
            milestones: roadmapData.roadmap_data // Assuming roadmap_data contains the milestones array
        };

        // Confirm before overwriting current work?
        if (roadmapOutputDiv.children.length > 0 && loadedRoadmapId !== roadmapId) { // Only confirm if loading a *different* roadmap
             if (!confirm("Loading this roadmap will replace your current unsaved work. Continue?")) {
                 updateLoadStatusMessage("Load cancelled.", false);
                 return;
             }
        }

        // Clear previous active state
        document.querySelectorAll('#saved-roadmaps-list .list-group-item-action').forEach(btn => btn.classList.remove('active'));

        // Render the loaded data
        const renderSuccess = renderRoadmapFromData(renderData);

        if (renderSuccess) {
            loadedRoadmapId = roadmapId; // IMPORTANT: Track the ID of the loaded roadmap
            updateLoadStatusMessage("Roadmap loaded successfully!", false);
            targetButton.classList.add('active'); // Highlight the loaded item
        } else {
            updateLoadStatusMessage("Failed to display loaded roadmap.", true);
            loadedRoadmapId = null; // Reset if rendering failed
        }

    } catch (error) {
        console.error("Exception loading specific roadmap:", error);
        updateLoadStatusMessage("An unexpected error occurred during load.", true);
        loadedRoadmapId = null; // Reset on error
    }
}
// --- End Load Roadmap List ---


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

    // Check if user is logged in before allowing generation? Optional, but good practice.
    // const { data: { session } } = await supabase.auth.getSession();
    // if (!session) {
    //     updateAiStatusMessage("Please log in to generate a roadmap.", true);
    //     generateAiButton.disabled = false;
    //     aiButtonSpinner.classList.add('d-none');
    //     return;
    // }

    try {
        // 3. Fetch Call to Supabase Edge Function
        console.log(`Calling Supabase Edge Function at: ${SUPABASE_EDGE_FUNCTION_URL}`);
        const response = await fetch(SUPABASE_EDGE_FUNCTION_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}` // Required for Supabase Edge Functions
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

            // Save the new state (will be updated to save to Supabase)
            debouncedAutoSave();

        } else {
            // --- Edge Function Error ---
            let errorMsg = 'Unknown backend error occurred.';
            try {
                const errorData = await response.json();
                errorMsg = errorData.error || `Edge function responded with status ${response.status}`;
                console.error("Edge Function Error Response:", errorData);
            } catch (e) {
                console.error("Could not parse Edge Function error response:", e);
                errorMsg = `Edge function responded with status ${response.status}, but error details couldn't be read.`;
            }
            updateAiStatusMessage(errorMsg, true); // Show Edge function error
        }

    } catch (error) {
        // --- Network/Fetch Error ---
        console.error("Error calling Edge Function:", error);
        updateAiStatusMessage("Network error or function unreachable. Please check console and Supabase function logs.", true);
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

// Removed old localStorage-based loadRoadmapState function
// Removed old localStorage-based attemptAutoLoad function

// --- Authentication Handlers ---
async function handleSignUp(event) {
    event.preventDefault();
    const email = signupEmailInput.value.trim();
    const password = signupPasswordInput.value.trim();

    if (!email || !password) {
        updateAuthStatusMessage("Please enter both email and password to sign up.");
        return;
    }
    if (password.length < 6) {
         updateAuthStatusMessage("Password must be at least 6 characters long.");
         return;
    }

    updateAuthStatusMessage("Signing up...", false, 0); // Persistent message

    try {
        const { data, error } = await supabase.auth.signUp({
            email: email,
            password: password,
        });

        if (error) {
            console.error("Sign up error:", error);
            updateAuthStatusMessage(`Sign up failed: ${error.message}`);
        } else if (data.user && data.user.identities && data.user.identities.length === 0) {
             // This indicates email confirmation might be required
             console.log("Sign up successful, confirmation required:", data);
             updateAuthStatusMessage("Sign up successful! Please check your email to confirm your account.", false, 0); // Persistent
             signupForm.reset(); // Clear form
        } else if (data.user) {
            // User is signed up and potentially automatically logged in (if email confirmation is off)
            console.log("Sign up successful:", data);
            updateAuthStatusMessage("Sign up successful!", false); // onAuthStateChange will handle UI update
            signupForm.reset(); // Clear form
        } else {
             // Unexpected response
             console.error("Unexpected sign up response:", data);
             updateAuthStatusMessage("Sign up failed: Unexpected response from server.");
        }
    } catch (catchError) {
        console.error("Sign up exception:", catchError);
        updateAuthStatusMessage("Sign up failed: An unexpected error occurred.");
    }
}

async function handleLogIn(event) {
    event.preventDefault();
    const email = loginEmailInput.value.trim();
    const password = loginPasswordInput.value.trim();

    if (!email || !password) {
        updateAuthStatusMessage("Please enter both email and password to log in.");
        return;
    }

    updateAuthStatusMessage("Logging in...", false, 0); // Persistent message

    try {
        const { data, error } = await supabase.auth.signInWithPassword({
            email: email,
            password: password,
        });

        if (error) {
            console.error("Log in error:", error);
            updateAuthStatusMessage(`Log in failed: ${error.message}`);
        } else {
            console.log("Log in successful:", data);
            updateAuthStatusMessage("Log in successful!", false); // onAuthStateChange handles UI update
            loginForm.reset(); // Clear form
        }
    } catch (catchError) {
        console.error("Log in exception:", catchError);
        updateAuthStatusMessage("Log in failed: An unexpected error occurred.");
    }
}

async function handleLogOut() {
    updateAuthStatusMessage("Logging out...", false, 0); // Persistent message
    try {
        const { error } = await supabase.auth.signOut();
        if (error) {
            console.error("Log out error:", error);
            updateAuthStatusMessage(`Log out failed: ${error.message}`);
        } else {
            console.log("Log out successful");
            // onAuthStateChange handles UI updates and clearing data
            updateAuthStatusMessage("Logged out successfully.", false);
        }
    } catch (catchError) {
        console.error("Log out exception:", catchError);
        updateAuthStatusMessage("Log out failed: An unexpected error occurred.");
    }
}
// --- End Authentication Handlers ---


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
  // Removed listener for old loadButton

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

  // --- Auth Event Listeners ---
  if (signupForm) {
      signupForm.addEventListener('submit', handleSignUp);
  } else {
      console.error("Sign up form element not found.");
  }

  if (loginForm) {
      loginForm.addEventListener('submit', handleLogIn);
  } else {
      console.error("Log in form element not found.");
  }

  if (logoutButton) {
      logoutButton.addEventListener('click', handleLogOut);
  } else {
      console.error("Log out button element not found.");
  }
  // --- End Auth Event Listeners ---

  // --- Listener for Saved Roadmap List Clicks ---
  if (savedRoadmapsListDiv) {
      savedRoadmapsListDiv.addEventListener('click', handleLoadSpecificRoadmap);
  } else {
      console.error("Saved roadmaps list container not found.");
  }
  // --- End Listener ---


  // --- Supabase Auth State Change Listener ---
  supabase.auth.onAuthStateChange((event, session) => {
    console.log('Auth event:', event, session);
    updateAuthStatusMessage('', false, 0); // Clear any previous auth messages

    if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN') {
      // User is logged in
      if (session && session.user) {
        authForms.classList.add('d-none'); // Hide login/signup forms
        userStatusDiv.classList.remove('d-none'); // Show user status
        userEmailSpan.textContent = session.user.email;

        // Enable Save button
        if (saveButton) saveButton.disabled = false;
        // Removed enabling old loadButton

        // Trigger loading user's roadmaps list
        loadUserRoadmapsList();
        updateAuthStatusMessage('Logged in successfully.', false, 3000);
        console.log("User logged in:", session.user.email);

      } else {
         // This case should ideally not happen if event is SIGNED_IN, but handle defensively
         console.error("Auth state change error: SIGNED_IN event but no session/user.");
         authForms.classList.remove('d-none');
         userStatusDiv.classList.add('d-none');
         userEmailSpan.textContent = '';
         // Disable Save button
         if (saveButton) saveButton.disabled = true;
         // Removed disabling old loadButton
         // Clear roadmap UI and reset state
         roadmapOutputDiv.innerHTML = '';
         roadmapNameInput.value = '';
         loadedRoadmapId = null; // Reset loaded ID
         if (roadmapPlaceholder) roadmapPlaceholder.classList.remove('d-none'); // Show placeholder
         if (savedRoadmapsSection) savedRoadmapsSection.classList.add('d-none'); // Hide saved list section
         if (savedRoadmapsListDiv) savedRoadmapsListDiv.innerHTML = ''; // Clear list content
      }
    } else if (event === 'SIGNED_OUT') {
      // User is logged out
      authForms.classList.remove('d-none'); // Show login/signup forms
      userStatusDiv.classList.add('d-none'); // Hide user status
      userEmailSpan.textContent = '';
      loadedRoadmapId = null; // Reset loaded ID

      // Disable Save button
      if (saveButton) saveButton.disabled = true;
      // Removed disabling old loadButton

      // Clear loaded roadmap data and UI
      roadmapOutputDiv.innerHTML = '';
      roadmapNameInput.value = '';
      if (roadmapPlaceholder) roadmapPlaceholder.classList.remove('d-none'); // Show placeholder
      if (savedRoadmapsSection) savedRoadmapsSection.classList.add('d-none'); // Hide saved list section
      if (savedRoadmapsListDiv) savedRoadmapsListDiv.innerHTML = ''; // Clear list content

      updateAuthStatusMessage('Logged out.', false, 3000);
      console.log("User logged out.");
      // Example: Clear roadmap UI (already done above)
      // roadmapOutputDiv.innerHTML = '';
      // roadmapNameInput.value = '';
      // if (roadmapPlaceholder) roadmapPlaceholder.classList.remove('d-none');

    } else if (event === 'PASSWORD_RECOVERY') {
        updateAuthStatusMessage('Password recovery email sent.', false, 0); // Persistent
    } else if (event === 'USER_UPDATED') {
        // Handle user updates if needed (e.g., email change confirmation)
        if (session && session.user) {
             userEmailSpan.textContent = session.user.email; // Update email display if changed
        }
        console.log("User data updated.");
    }
    // Add handling for other events like TOKEN_REFRESHED if necessary
  });
  // --- End Auth State Change Listener ---


  // Removed call to attemptAutoLoad() - loading is now triggered by onAuthStateChange

  // Initial UI setup based on potential existing session (handled by onAuthStateChange)
  // Final check for placeholder visibility after potential initial load
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
