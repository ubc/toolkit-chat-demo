// server.js - Backend proxy for the Toolkit Chat Demo

// --- Why this exists? ---
// This Node.js server acts as a intermediary between the browser-based frontend (app.js)
// and the UBC GenAI Toolkit's LLM module. The primary reason for this server is that
// the underlying 'ollama' JavaScript library (used by the toolkit's OllamaProvider)
// contains Node.js-specific code (like using 'node:fs') which cannot run directly
// inside a web browser due to security restrictions.
// By running the LLM module here in Node.js (where it works correctly) and exposing
// a simple API endpoint (/chat), we allow the frontend to interact with the LLM
// without needing to handle Node-specific dependencies in the browser.

// --- Module System Note ---
// This file uses CommonJS module syntax (`require`) because the UBC GenAI Toolkit
// modules (`@ubc-genai-toolkit/core`, `@ubc-genai-toolkit/llm`) are currently built
// using CommonJS. Using `require` here ensures compatibility when loading those modules.
// The frontend (`app.js`) uses ES Modules (`import`), which is handled by the browser.

const express = require('express');
const cors = require('cors');
// Import LLMModule from the LLM toolkit package
const { LLMModule } = require('@ubc-genai-toolkit/llm');
// Import necessary components (Logger, Error classes) from the Core toolkit package
const { ConsoleLogger, ToolkitError } = require('@ubc-genai-toolkit/core');

// --- Configuration ---
// Static configuration for the LLM module.
// In a real application, this might come from environment variables or a config file.
// This was previously in a separate config.js, but moved here for simplicity as
// config.js used ES Module exports, complicating the `require` setup.
const llmConfig = {
    provider: 'ollama',
    endpoint: 'http://localhost:11434', // Ensure your Ollama server is running here
    defaultModel: 'llama3.1', // Ensure this model is available via `ollama list`
};

// --- Express App Setup ---
const app = express();
const port = 3001; // Use a distinct port for the backend API (frontend served separately)

// --- Middleware ---
// Enable Cross-Origin Resource Sharing (CORS) to allow requests from the frontend
// origin (e.g., http://localhost:3000 or the port assigned by `npx serve`)
app.use(cors());
// Enable parsing of JSON request bodies sent from the frontend
app.use(express.json());

// --- LLM Initialization ---
let llmModule;
try {
    // Combine the static config with a logger instance required by the toolkit modules
    const configWithLogger = {
        ...llmConfig,
        logger: new ConsoleLogger('ToolkitChatDemo-Backend'), // Use the Core ConsoleLogger
        debug: false, // Set to true for more verbose toolkit logging
    };
    // Instantiate the main LLMModule from the toolkit
    llmModule = new LLMModule(configWithLogger);
    console.log(`LLM Module Initialized. Provider: ${llmModule.getProviderName()}`);
} catch (error) {
    // If the toolkit fails to initialize (e.g., bad config), log fatally and exit.
    console.error('FATAL: Failed to initialize LLMModule:', error);
    process.exit(1);
}

// --- API Endpoint (/chat) ---
// Handles POST requests from the frontend to conduct a chat turn.
app.post('/chat', async (req, res) => {
    // Extract message history and LLM options from the request body
    const { messages, options } = req.body;

    // Basic validation of the incoming request data
    if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ error: 'Invalid request body: messages array is required.' });
    }

    console.log(`Received /chat request. Messages: ${messages.length}, Options:`, options);

    try {
        // Set necessary HTTP headers for Server-Sent Events (SSE) or chunked streaming
        res.setHeader('Content-Type', 'text/plain; charset=utf-8'); // Indicate plain text stream
        res.setHeader('Cache-Control', 'no-cache'); // Prevent caching of the stream
        res.setHeader('Connection', 'keep-alive'); // Keep the connection open for streaming

        // Call the toolkit's streamConversation method
        await llmModule.streamConversation(
            messages, // Pass the conversation history received from the frontend
            (chunk) => {
                // This callback function is executed by the LLMModule for each chunk of text received from the LLM.
                // We write each chunk directly to the HTTP response stream, sending it to the frontend.
                res.write(chunk);
            },
            options // Pass through options like temperature, maxTokens received from frontend
        );

        // Once the streamConversation method completes, signal the end of the HTTP response stream.
        res.end();

    } catch (error) {
        // Handle errors that occur during the streaming process
        console.error('Error during LLM streamConversation:', error);

        // Check if headers have already been sent. If so, we can't send a JSON error response.
        if (!res.headersSent) {
            let errorMsg = 'An error occurred while processing the chat stream.';
            let statusCode = 500;
            // If the error is a specific ToolkitError, use its message and code
            if (error instanceof ToolkitError) {
                errorMsg = `LLM Error: ${error.message}`;
                // Ensure the error code is a valid HTTP status code range
                statusCode = error.code >= 400 && error.code < 600 ? error.code : 500;
            }
            // Send a JSON error response back to the frontend
             res.status(statusCode).json({ error: errorMsg });
        } else {
            // If headers were already sent (meaning some chunks were likely written),
            // we can only abruptly end the connection.
            console.error('Headers already sent, ending stream abruptly due to error.');
            res.end(); // End the stream without a specific error message body
        }
    }
});

// --- Start Server ---
// Start the Express server and listen for incoming connections on the specified port.
app.listen(port, () => {
    console.log(`Toolkit Chat Demo Backend listening on http://localhost:${port}`);
});