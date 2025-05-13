# Toolkit Chat Demo Application

This application serves as a simple browser-based chat interface demonstrating how to use the `@ubc-genai-toolkit/llm` module, specifically for streaming conversations with an LLM like Ollama.

## Architecture

This demo uses a two-part architecture:

1.  **Frontend (`index.html`, `style.css`, `app.js`):**

    -   A plain HTML, CSS, and JavaScript single-page application.
    -   Handles user interface elements (settings form, chat display, input).
    -   Manages local chat history.
    -   Communicates with the backend server via `fetch` API to send messages and receive streamed responses.

2.  **Backend (`server.js`):**
    -   A Node.js server built with Express.
    -   Acts as a proxy between the frontend and the `@ubc-genai-toolkit/llm` module.
    -   This backend is necessary because the `ollama` JavaScript library (a dependency of the toolkit's `OllamaProvider`) includes Node.js-specific code (e.g., usage of `node:fs`) that cannot run directly in a web browser environment.
    -   The LLM module is initialized and used here, where it can operate correctly.

## Prerequisites

1.  **Node.js and npm:** Required to install dependencies and run the servers. (Node.js v16+ recommended).
2.  **UBC GenAI Toolkit (`ubc-genai-toolkit-ts`):**
    -   You need to have the main `ubc-genai-toolkit-ts` repository cloned locally.
    -   The toolkit **must be built** (run `npm install` then `npm run build` in the root of the `ubc-genai-toolkit-ts` directory).
3.  **Ollama Server:**
    -   An Ollama server must be running and accessible.
    -   The model specified in `server.js` (default: `llama3.1`) must be pulled and available on the Ollama server (e.g., `ollama pull llama3.1`).

## Setup

1.  **Directory Structure:**

    -   It's assumed this `toolkit-chat-demo` directory is a sibling to the main `ubc-genai-toolkit-ts` directory. For example:
        ```
        Developer/
        ├── ubc-genai-toolkit-ts/     (The main toolkit repo)
        └── toolkit-chat-demo/        (This application)
        ```
    -   If your structure is different, you'll need to adjust the `file:` paths in `toolkit-chat-demo/package.json` that point to the toolkit modules.

2.  **Install Dependencies:**
    -   Navigate to the `toolkit-chat-demo` directory in your terminal.
    -   Run `npm install`. This will install Express, CORS, and link the local `@ubc-genai-toolkit/core` and `@ubc-genai-toolkit/llm` modules.

## Configuration

-   **LLM Configuration:** The LLM provider, endpoint, and default model are configured directly within `toolkit-chat-demo/server.js` in the `llmConfig` object.
    ```javascript
    const llmConfig = {
    	provider: 'ollama',
    	endpoint: 'http://localhost:11434', // Change if your Ollama server is elsewhere
    	defaultModel: 'llama3.1', // Change to your desired (pulled) model
    };
    ```
-   **Logging & Debugging:** In `server.js`, a `ConsoleLogger` is initialized for the LLM module. The `debug` property in `configWithLogger` can be set to `true` for more verbose logging from the toolkit.
    ```javascript
    const configWithLogger = {
    	// ...
    	logger: new ConsoleLogger('ToolkitChatDemo-Backend'),
    	debug: false, // Set to true for verbose logs
    };
    ```

## Running the Demo

You need to run two separate server processes:

1.  **Start the Backend Server:**

    -   Open a terminal in the `toolkit-chat-demo` directory.
    -   Run the command: `npm run start:server`
    -   This will start the Node.js Express server, typically listening on `http://localhost:3001` (see terminal output).

2.  **Start the Frontend Static File Server:**

    -   Open a _second_ terminal in the `toolkit-chat-demo` directory.
    -   Run the command: `npx serve`
    -   This will start a simple static file server. It will usually pick port `3000` or the next available port if `3000` is in use. Note the URL from the terminal output (e.g., `http://localhost:3000` or `http://localhost:XXXXX`).

3.  **Access the Application:**
    -   Open your web browser and navigate to the URL provided by the `npx serve` command (the frontend server URL).

## Code Structure

-   `index.html`: The main HTML file for the user interface.
-   `style.css`: CSS styles for the application.
-   `app.js`: Frontend JavaScript logic; handles UI, user input, and communication with the backend `/chat` API.
-   `server.js`: Backend Node.js Express server; uses the UBC GenAI Toolkit to interact with the LLM and streams responses to the frontend.
-   `package.json`: Defines project dependencies and scripts.
-   `README.md`: This file.
