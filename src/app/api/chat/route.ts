
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { messages, model } = body;

        // Default to qwen2.5-coder:7b if not provided. Use the model user has.
        const modelName = model || 'qwen2.5-coder:7b';

        const baseUrl = process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434';
        const response = await fetch(`${baseUrl}/api/chat`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: modelName,
                messages: messages,
                stream: true, // Enable streaming
            }),
        });

        if (!response.ok) {
            return NextResponse.json({ error: 'Ollama Error' }, { status: response.status });
        }

        // Pass the stream directly through
        return new NextResponse(response.body, {
            headers: {
                'Content-Type': 'application/x-ndjson', // Or whatever Ollama sends (it sends JSON objects line by line usually)
            },
        });

    } catch (error) {
        console.error('Error in chat route:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
