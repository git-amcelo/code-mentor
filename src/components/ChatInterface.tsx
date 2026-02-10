
'use client';

import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import remarkGfm from 'remark-gfm';
import { Send, Plus, Code, RefreshCw, Zap, PanelLeft } from 'lucide-react';
import styles from './ChatInterface.module.css';

interface Message {
    role: 'user' | 'assistant';
    content: string;
}

// Custom style for SyntaxHighlighter to include word wrap
const customCodeStyle = {
    ...vscDarkPlus,
    'pre[class*="language-"]': {
        ...vscDarkPlus['pre[class*="language-"]'],
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
    },
};

export default function ChatInterface() {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const abortControllerRef = useRef<AbortController | null>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleStop = () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
            setIsLoading(false);
        }
    };

    const handleSubmit = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!input.trim() || isLoading) return;

        const userMessage: Message = { role: 'user', content: input };
        setMessages((prev) => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);

        // Reset textarea height
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
        }

        const abortController = new AbortController();
        abortControllerRef.current = abortController;

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    messages: [
                        {
                            role: 'system',
                            content: 'You are an expert coding assistant. When asked to fix or write code, you must output ONLY the code in a markdown block. Do not provide any conversational text, explanations, or summaries unless explicitly asked.'
                        },
                        ...messages,
                        userMessage
                    ],
                    model: 'qwen2.5-coder:7b', // Logic to be handled in API or here
                }),
                signal: abortController.signal,
            });

            if (!response.ok) throw new Error('Failed to fetch response');
            if (!response.body) throw new Error('No response body');

            // Create a placeholder for assistant message
            setMessages((prev) => [...prev, { role: 'assistant', content: '' }]);

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let assistantContent = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                // We typically handle this by accumulating buffer if it was raw TCP, but fetch stream usually splits reasonably. 
                // However, we should be robust.
                // The API route passes the raw stream. Ollama sends Newline Delimited JSON.

                const lines = chunk.split('\n').filter(line => line.trim() !== '');

                for (const line of lines) {
                    try {
                        const json = JSON.parse(line);
                        // Check for message content (chat endpoint) or response (generate endpoint)
                        const content = json.message?.content || json.response;

                        if (content) {
                            assistantContent += content;
                            setMessages((prev) => {
                                const newMessages = [...prev];
                                const lastMsg = newMessages[newMessages.length - 1];
                                if (lastMsg.role === 'assistant') {
                                    lastMsg.content = assistantContent;
                                }
                                return newMessages;
                            });
                        }
                        if (json.done) {
                            setIsLoading(false);
                        }
                    } catch (error) {
                        console.error('Error parsing JSON chunk', error);
                    }
                }
            }
        } catch (error: any) {
            if (error.name === 'AbortError') {
                console.log('Generation stopped by user');
            } else {
                console.error('Error:', error);
                setMessages((prev) => [
                    ...prev,
                    { role: 'assistant', content: '**Error:** Failed to communicate with the local model. Ensure Ollama is running and you have `qwen2.5-coder:7b` installed.' },
                ]);
            }
        } finally {
            setIsLoading(false);
            abortControllerRef.current = null;
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
        }
    };



    const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setInput(e.target.value);
        e.target.style.height = 'auto';
        e.target.style.height = `${e.target.scrollHeight}px`;
    };

    return (
        <div className={styles.layout}>
            {/* Sidebar */}
            <div className={`${styles.sidebar} ${!isSidebarOpen ? styles.collapsed : ''}`}>
                <div className={styles.sidebarHeader}>
                    <div className={styles.headerContent}>
                        <span className={styles.logoText}>CodeMentor</span>
                    </div>
                    <button
                        className={styles.collapseBtn}
                        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                        title={isSidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
                    >
                        <PanelLeft size={20} />
                    </button>
                </div>
                <button
                    className={styles.newChatBtn}
                    onClick={() => setMessages([])}
                    title="New Chat"
                >
                    <Plus size={20} />
                    <span className={styles.btnText}>New Chat</span>
                </button>

                {/* We could add history here later */}
            </div>

            {/* Main Chat Area */}
            <div className={styles.main}>


                <div className={styles.messagesContainer}>
                    {messages.length === 0 ? (
                        <div className={styles.emptyState}>
                            <div className={styles.emptyStateIcon}>
                                <Zap size={64} strokeWidth={1.5} />
                            </div>
                            <h1 className={styles.welcomeText}>Welcome to CodeMentor</h1>
                            <p className={styles.subText}>I'm your local neuro-symbolic debugging assistant. Paste your buggy code below or ask me to generate a solution.</p>
                        </div>
                    ) : (
                        messages.map((msg, index) => (
                            <div key={index} className={`${styles.messageWrapper} ${msg.role === 'user' ? styles.userMessage : styles.aiMessage}`}>
                                <div className={styles.messageContent}>
                                    <div className={`${styles.avatar} ${msg.role === 'user' ? styles.userAvatar : styles.aiAvatar}`}>
                                        {msg.role === 'user' ? 'U' : 'AI'}
                                    </div>
                                    <div className={styles.messageBody}>
                                        {msg.role === 'assistant' && !msg.content && isLoading && index === messages.length - 1 ? (
                                            <div className={styles.pulseContainer}>
                                                <div className={styles.pulseDot}></div>
                                                <div className={styles.pulseDot}></div>
                                                <div className={styles.pulseDot}></div>
                                            </div>
                                        ) : (
                                            <ReactMarkdown
                                                remarkPlugins={[remarkGfm]}
                                                components={{
                                                    code({ inline, className, children, ...props }: any) {
                                                        const match = /language-(\w+)/.exec(className || '');
                                                        return !inline && match ? (
                                                            <SyntaxHighlighter
                                                                style={customCodeStyle} // Use custom style here
                                                                language={match[1]}
                                                                PreTag="div"
                                                                {...props}
                                                            >
                                                                {String(children).replace(/\n$/, '')}
                                                            </SyntaxHighlighter>
                                                        ) : (
                                                            <code className={className} {...props}>
                                                                {children}
                                                            </code>
                                                        );
                                                    }
                                                }}
                                            >
                                                {msg.content}
                                            </ReactMarkdown>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                <div className={styles.inputArea}>
                    <div className={styles.inputContainer}>
                        <textarea
                            ref={textareaRef}
                            className={styles.textarea}
                            placeholder="Paste your code to debug..."
                            value={input}
                            onChange={handleInput}
                            onKeyDown={handleKeyDown}
                            rows={1}
                        />
                        <div className={styles.inputActions}>
                            {isLoading ? (
                                <button
                                    className={styles.sendBtn}
                                    onClick={handleStop}
                                    title="Stop generation"
                                    style={{ backgroundColor: '#ef4444' }} // Red for stop
                                >
                                    <div style={{ width: '10px', height: '10px', backgroundColor: 'white', borderRadius: '2px' }} />
                                </button>
                            ) : (
                                <button
                                    className={styles.sendBtn}
                                    onClick={() => handleSubmit()}
                                    disabled={!input.trim()}
                                >
                                    <Send size={18} />
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div >
    );
}
