// config.js
// Contains configuration constants for the roadmap generator.

// AVAILABLE_ICONS removed as per Emoji migration

export const AVAILABLE_EMOJIS = [
    '💡', '🧠', '📝', '⚙️', '🛑', '✋', '⏳', '🐛', '✅', '🚀', '👥', '🔍', '💻', '🚩', '⚠️', '📄', '❓' // Added fallback/default
];

export const DEFAULT_STATUSES = [
    { name: 'Not Started', icon: '📝' }, // Use Emoji
    { name: 'In Progress', icon: '⚙️' }, // Use Emoji
    { name: 'Completed', icon: '✅' }, // Use Emoji
    { name: 'Blocked', icon: '🛑' }, // Use Emoji
    { name: 'At Risk', icon: '⚠️' } // Use Emoji
];

export const API_CONFIG = {
    WORD: { endpoint: 'https://api.example.com/convert/docx', key: 'YOUR_API_KEY' },
    PPT: { endpoint: 'https://api.example.com/convert/pptx', key: 'YOUR_API_KEY' }
};
