/**
 * Frontend JavaScript for the Toolkit Chat Demo Application.
 *
 * Handles:
 *  - User interface interactions (settings form, chat input/output).
 *  - Managing local chat message history.
 *  - Communicating with the backend server (server.js) via fetch API.
 *  - Processing streamed responses from the backend.
 *
 * NOTE: This frontend does NOT interact directly with the @ubc-genai-toolkit/llm module.
 * Direct browser usage was prevented by Node.js-specific dependencies within the underlying
 * 'ollama' library used by the toolkit. Instead, server.js acts as a proxy.
 */

// --- DOM Elements (Get references to UI components) ---
const settingsView = document.getElementById('settings-view');
const chatView = document.getElementById('chat-view');
const settingsForm = document.getElementById('settings-form');
const userNameInput = document.getElementById('user-name');
const systemPromptInput = document.getElementById('system-prompt');
const temperatureInput = document.getElementById('temperature');
const maxTokensInput = document.getElementById('max-tokens');

const chatLog = document.getElementById('chat-log');
const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');
const resetBtn = document.getElementById('reset-btn');

// --- State Variables (Store application state) ---
// No longer need llmModule or conversation instances here
let userName = '';
let llmModelName = 'Assistant'; // Static name for the LLM in the UI
let currentTemperature = 0.7; // Default temperature, updated from settings
let currentMaxTokens = 500;   // Default max tokens, updated from settings
let messageHistory = [];      // Array to store message objects { role: 'user'/'assistant'/'system', content: '...' }
let systemPrompt = '';         // System prompt provided by the user

// --- Helper Functions ---

/**
 * Displays a message (user or assistant) in the chat log UI.
 * Handles formatting and ensures the chat log scrolls down.
 * @param {string} sender - Name of the sender (user or LLM).
 * @param {string} text - The message content.
 * @param {'user' | 'assistant'} type - Type of message for styling.
 * @returns {HTMLElement} The created message div element.
 */
function displayMessage(sender, text, type) {
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message', type === 'user' ? 'user-message' : 'assistant-message');

    const senderStrong = document.createElement('strong');
    senderStrong.textContent = `${sender}:`;
    messageDiv.appendChild(senderStrong);

    const textSpan = document.createElement('span');

    // Add class for assistant responses to target for streaming updates
    if (type === 'assistant') {
        textSpan.classList.add('assistant-response');
        if (text) { // Handle initial placeholder text (e.g., "...")
            textSpan.textContent = text;
        }
    } else {
        // Format user messages, handling newlines
        text.split('\n').forEach((line, index, arr) => {
            textSpan.appendChild(document.createTextNode(line));
            if (index < arr.length - 1) {
                textSpan.appendChild(document.createElement('br'));
            }
        });
    }

    messageDiv.appendChild(textSpan);
    chatLog.appendChild(messageDiv);

    // Auto-scroll to the bottom of the chat log
    chatLog.scrollTop = chatLog.scrollHeight;
    return messageDiv;
}

/**
 * Handles the process of sending a user message:
 * 1. Displays the user message in the UI.
 * 2. Adds the message to the local messageHistory.
 * 3. Sends the current messageHistory to the backend (/chat endpoint).
 * 4. Processes the streamed text response from the backend.
 * 5. Displays the streamed response in the UI.
 * 6. Adds the complete assistant response to the local messageHistory.
 * 7. Re-enables the input field.
 */
async function handleSendMessage() {
    const messageText = userInput.value.trim();
    if (!messageText) return; // Do nothing if input is empty

    userInput.value = ''; // Clear input field
    sendBtn.disabled = true;
    userInput.disabled = true;

    // Display User Message & Add to Local History
    displayMessage(userName, messageText, 'user');
    messageHistory.push({ role: 'user', content: messageText });

    // Prepare UI for Assistant Response (add placeholder message)
    const assistantMsgDiv = displayMessage(llmModelName, '...', 'assistant');
    const assistantResponseSpan = assistantMsgDiv.querySelector('.assistant-response');

    let fullAssistantResponse = ''; // Accumulate the full response text

    try {
        // Send message history to the backend server
        const response = await fetch('http://localhost:3001/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                messages: messageHistory, // Send the entire history
                options: { // Send current LLM options
                    temperature: currentTemperature,
                    maxTokens: currentMaxTokens,
                },
            }),
        });

        // Handle HTTP errors from the backend
        if (!response.ok) {
            let errorData = await response.json().catch(() => null); // Try to parse backend error
            let errMsg = errorData?.error || `HTTP error! status: ${response.status}`;
            throw new Error(errMsg);
        }

        // Ensure the response body is available for streaming
        if (!response.body) {
            throw new Error('Response body is missing');
        }

        // Process the streamed response body
        const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
        let firstChunk = true;

        while (true) {
            const { value, done } = await reader.read(); // Read chunks from the stream
            if (done) break; // Exit loop when stream is finished

            if (firstChunk) {
                assistantResponseSpan.textContent = ''; // Clear the "..." placeholder
                firstChunk = false;
            }
            // Append the received text chunk to the UI
            assistantResponseSpan.appendChild(document.createTextNode(value));
            fullAssistantResponse += value; // Accumulate the full response
            chatLog.scrollTop = chatLog.scrollHeight; // Keep scrolled down
        }

        // Add the complete assistant response to the local history
        messageHistory.push({ role: 'assistant', content: fullAssistantResponse });

    } catch (error) {
        // Display errors in the UI
        console.error('Error fetching or processing chat stream:', error);
        assistantResponseSpan.textContent = `Error: ${error.message}`;
        assistantResponseSpan.style.color = 'red';
        // Note: The failed assistant message remains in the UI with the error.
        // Consider adding logic to remove it or add the error to messageHistory if needed.
    } finally {
        // Re-enable input fields regardless of success or failure
        sendBtn.disabled = false;
        userInput.disabled = false;
        userInput.focus();
    }
}

// --- Event Handlers ---

/**
 * Handles the submission of the initial settings form.
 * Reads settings, stores them, clears history, adds system prompt to history,
 * hides the settings view, shows the chat view, and attaches chat event listeners.
 * @param {Event} event - The form submission event.
 */
function handleStartChat(event) {
    event.preventDefault(); // Prevent default form submission (page reload)

    // Read and store settings from the form
    userName = userNameInput.value.trim() || 'User';
    systemPrompt = systemPromptInput.value.trim();
    currentTemperature = parseFloat(temperatureInput.value);
    currentMaxTokens = parseInt(maxTokensInput.value, 10);

    // Basic input validation
    if (isNaN(currentTemperature) || isNaN(currentMaxTokens)) {
        alert('Please enter valid numbers for Temperature and Max Tokens.');
        return;
    }

    // Prepare for new chat session
    chatLog.innerHTML = ''; // Clear any previous chat messages
    messageHistory = []; // Reset the local message history

    // Add the system prompt to the message history if provided
    if (systemPrompt) {
        messageHistory.push({ role: 'system', content: systemPrompt });
        // Note: The system prompt is not visually displayed in the chat log in this demo.
    }

    // Switch UI views
    settingsView.style.display = 'none';
    chatView.style.display = 'flex';

    // Attach event listeners for chat interactions
    // Using .onclick/.onkeydown to easily overwrite if handleStartChat were called again (e.g., after reset)
    sendBtn.onclick = handleSendMessage;
    userInput.onkeydown = (e) => {
        // Send message on Enter key (but not Shift+Enter)
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault(); // Prevent newline in input box
            handleSendMessage();
        }
    };
    // Reload the page for a simple reset
    resetBtn.onclick = () => location.reload();

    userInput.focus(); // Set focus to the chat input field
}

// --- Initialization ---

// Setup main event listener once the DOM is ready.
document.addEventListener('DOMContentLoaded', () => {
    // Ensure the settings form exists before attaching listener
    if (settingsForm) {
        settingsForm.addEventListener('submit', handleStartChat);
    } else {
        console.error('Settings form not found!');
    }
    // Ensure the chat view is initially hidden when JS loads
     if (chatView) {
        chatView.style.display = 'none';
    }
});