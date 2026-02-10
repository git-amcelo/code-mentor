# CodeMentor

CodeMentor is a local neuro-symbolic debugging assistant UI, leveraging a local Qwen Coder model via Ollama.

## Prerequisites

1.  **Node.js**: Ensure Node.js is installed.
2.  **Ollama**: Install [Ollama](https://ollama.com).
3.  **Qwen Coder Model**: Pull the model needed for debugging.
    ```bash
    ollama pull qwen-coder
    ```
    *Note: The app defaults to `qwen-coder`. If you use a different tag (e.g., `qwen2.5-coder`), update `src/components/ChatInterface.tsx` or `src/app/api/chat/route.ts`.*

## Getting Started

1.  Install dependencies:
    ```bash
    npm install
    ```

2.  Run the development server:
    ```bash
    npm run dev
    ```

3.  Open [http://localhost:3000](http://localhost:3000) with your browser.

## Features

-   **Claude-like UI**: Clean, focus-driven interface.
-   **Local AI**: Connects to your local Ollama instance (no cloud data leak).
-   **Code Highlighting**: Syntax highlighting for code blocks.
-   **Streaming Responses**: Real-time feedback from the model.

## API Documentation

-   **OpenAPI Spec**: `openapi.yaml`
-   **Postman Collection**: `postman_collection.json`
