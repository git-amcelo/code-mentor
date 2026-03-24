'use client';

import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import remarkGfm from 'remark-gfm';
import {
  Code2,
  Activity,
  Cpu,
  FileDown,
  ChevronRight,
  Network,
  Copy,
  Check,
  Settings2
} from 'lucide-react';
import gsap from 'gsap';
import { exportChatAsPdf } from '@/utils/exportPdf';
import { cn } from '@/lib/utils';

// Interfaces
interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  metadata?: {
    pdgGenerated?: boolean;
    z3Invoked?: boolean;
  };
}

// ─── Code Block Component with Copy Button ─────────────────
function CodeBlock({ language, codeString }: { language: string, codeString: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(codeString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group bg-blackish! m-0! border border-blackish/20 shadow-[4px_4px_0px_#E63B2E]">
      <div className="absolute top-0 left-0 w-full h-8 bg-blackish/50 border-b border-blackish/40 flex items-center justify-between px-3 z-10">
        <span className="font-data text-[10px] text-offwhite/50 uppercase tracking-widest">{language}</span>
        <button
          onClick={handleCopy}
          className="text-offwhite/50 hover:text-signal transition-colors flex items-center gap-1 font-data text-[10px] uppercase"
          title="Copy to clipboard"
        >
          {copied ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <SyntaxHighlighter
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        style={vscDarkPlus as any}
        language={language}
        PreTag="div"
        className="bg-transparent! m-0! p-4! pt-10!"
        customStyle={{ margin: 0, background: 'transparent' }}
      >
        {codeString}
      </SyntaxHighlighter>
    </div>
  );
}

export default function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [ollamaStatus, setOllamaStatus] = useState('OPERATIONAL');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // GSAP Initial Load Animation
  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from('.anim-fade-up', {
        y: 20,
        opacity: 0,
        stagger: 0.1,
        duration: 0.8,
        ease: 'power3.out',
      });
    }, containerRef);
    return () => ctx.revert();
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { role: 'user', content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setOllamaStatus('PROCESSING TRACES...');

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            {
              role: 'system',
              content: 'You are CodeMentor, a neuro-symbolic local AI debugger. Analyze the code, build a PDG (Program Dependence Graph), utilize the Z3 symbolic execution engine to trace constraints, and identify precise fault localizations based on anomalous state configurations. You run natively on a local edge device to ensure absolute code privacy. IMPORTANT INSTRUCTION: You must respond ONLY with the corrected code block. Do not provide any explanations, comments, or conversational text. Output the raw Markdown code block exclusively.'
            },
            ...messages,
            userMessage
          ],
          model: 'qwen2.5-coder:7b',
        }),
        signal: abortController.signal,
      });

      if (!response.ok) throw new Error('API Sync Failed');
      if (!response.body) throw new Error('No Data Stream');

      // Append empty assistant message with metadata flags
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: '', metadata: { pdgGenerated: true, z3Invoked: true } }
      ]);

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let assistantContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n').filter(line => line.trim() !== '');

        for (const line of lines) {
          try {
            const json = JSON.parse(line);
            const content = json.message?.content || json.response;

            if (content) {
              assistantContent += content;
              setMessages((prev) => {
                const newMsgs = [...prev];
                const lastMsg = newMsgs[newMsgs.length - 1];
                if (lastMsg.role === 'assistant') lastMsg.content = assistantContent;
                return newMsgs;
              });
            }
            if (json.done) {
              setIsLoading(false);
              setOllamaStatus('OPERATIONAL');
            }
          } catch (e) {
            console.error('Stream parsing error:', e);
          }
        }
      }
    } catch (error: unknown) {
      if (error instanceof Error && error.name !== 'AbortError') {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: '**SYS_ERR:** Failed to map execution trace. Ensure Ollama core processes are running locally.' }
        ]);
      }
    } finally {
      setIsLoading(false);
      setOllamaStatus('OPERATIONAL');
      abortControllerRef.current = null;
    }
  };

  const handleExportPdf = async () => {
    setIsExporting(true);
    await new Promise(r => setTimeout(r, 600));
    exportChatAsPdf(messages.filter(m => m.role !== 'system'));
    setIsExporting(false);
  };

  return (
    <div ref={containerRef} className="flex h-screen bg-offwhite text-blackish overflow-hidden font-heading">
      <div className="noise-overlay" />

      {/* LEFT PANEL: Diagnostic Dashboard */}
      <div className="hidden lg:flex flex-col w-[340px] border-r border-blackish/20 bg-paper/50 p-6 z-10 shrink-0 relative">
        <div className="flex flex-col gap-6 anim-fade-up">
          {/* Brand */}
          <div>
            <h1 className="text-2xl font-bold uppercase tracking-tighter flex items-center gap-2">
              <img src="/logo.svg" alt="CodeMentor Logo" className="w-8 h-8" />
              CodeMentor
            </h1>
            <p className="text-xs font-data mt-1 bg-blackish text-offwhite px-2 py-1 inline-block uppercase tracking-widest">
              Local Neuro-Symbolic AI
            </p>
          </div>

          <div className="h-px w-full bg-blackish/20 my-2" />

          {/* Nav / Controls */}
          <div className="flex flex-col gap-3">
            <button
              onClick={() => setMessages([])}
              className="flex items-center gap-3 w-full p-3 border border-blackish/30 hover:bg-blackish hover:text-offwhite transition-all duration-300 font-medium uppercase text-sm tracking-wider group"
            >
              <Activity size={18} className="group-hover:text-signal transition-colors" />
              Reset Environment
            </button>
            <button
              onClick={handleExportPdf}
              disabled={messages.length === 0 || isExporting}
              className="flex items-center gap-3 w-full p-3 border border-blackish/30 hover:bg-blackish hover:text-offwhite transition-all duration-300 font-medium uppercase text-sm tracking-wider disabled:opacity-50 disabled:cursor-not-allowed group"
            >
              <FileDown size={18} className={isExporting ? 'animate-spin' : 'group-hover:text-signal transition-colors'} />
              {isExporting ? 'Compiling PDF...' : 'Export Audit Log'}
            </button>
          </div>

          {/* System Telemetry Module */}
          <div className="mt-8 border border-blackish/20 p-4 bg-offwhite/50">
            <h3 className="text-xs font-bold uppercase tracking-widest mb-4 flex items-center justify-between">
              Telemetry
              <span className={cn(
                "w-2 h-2 rounded-full",
                ollamaStatus === 'OPERATIONAL' ? "bg-green-500 animate-pulse" : "bg-signal animate-pulse"
              )} />
            </h3>
            
            <ul className="space-y-4 font-data text-xs flex flex-col">
              <li className="flex flex-col gap-1">
                <span className="text-blackish/60 uppercase">Qwen Controller</span>
                <span className="font-bold flex items-center gap-2">
                  <Cpu size={14} /> {ollamaStatus}
                </span>
              </li>
              <li className="flex flex-col gap-1">
                <span className="text-blackish/60 uppercase">Z3 Inference Engine</span>
                <span className="font-bold flex items-center gap-2 text-signal">
                  <Settings2 size={14} /> ACTIVE (SYMBOLIC)
                </span>
              </li>
              <li className="flex flex-col gap-1">
                <span className="text-blackish/60 uppercase">Dynamic PDG Graph</span>
                <span className="font-bold flex items-center gap-2">
                  <Network size={14} /> STANDBY
                </span>
              </li>
              <li className="flex flex-col gap-1 mt-4 pt-4 border-t border-blackish/20">
                <span className="text-blackish/60 uppercase">Data Security Level</span>
                <span className="font-bold border border-blackish px-2 py-1 text-center bg-blackish text-white tracking-widest mt-1">
                  100% LOCALIZED
                </span>
              </li>
            </ul>
          </div>
        </div>
        
        {/* Decorative corner accents */}
        <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-blackish" />
        <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-blackish" />
      </div>

      {/* RIGHT PANEL: Terminal Output Stream */}
      <div className="flex-1 flex flex-col relative z-10 bg-offwhite">
        
        {/* Mobile Header */}
        <div className="lg:hidden flex items-center justify-between p-4 border-b border-blackish/20 bg-paper/90 backdrop-blur-sm sticky top-0 z-20">
          <h1 className="font-bold text-lg uppercase flex items-center gap-2">
             <img src="/logo.svg" alt="CodeMentor Logo" className="w-6 h-6" />
             CodeMentor
          </h1>
          <button onClick={handleExportPdf} className="p-2 border border-blackish/30 rounded-sm">
             <FileDown size={18} />
          </button>
        </div>

        {/* Console Log Area */}
        <div className="flex-1 overflow-y-auto p-4 md:p-10 flex flex-col gap-8 scroll-smooth">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center max-w-2xl mx-auto anim-fade-up">
              <div className="w-24 h-24 mb-8 bg-paper border-2 border-blackish flex items-center justify-center relative">
                 <div className="absolute top-0 right-0 w-4 h-[2px] bg-blackish -mr-4" />
                 <div className="absolute bottom-0 left-0 w-[2px] h-4 bg-blackish -mb-4" />
                 <img src="/logo.svg" alt="CodeMentor" className="w-16 h-16" />
              </div>
              <h2 className="text-4xl md:text-5xl font-drama italic tracking-tight mb-4">
                Execute. Inspect. Resolve.
              </h2>
              <p className="text-blackish/70 md:text-lg mb-8 max-w-lg font-medium">
                Pioneer precise fault localization with pure information density. Powered by LLM context and symbolic reasoning constraints.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2 font-data text-xs uppercase tracking-wider text-blackish/50">
                <span className="border border-blackish/20 px-3 py-1 bg-paper/50">Privacy Intact</span>
                <span>/</span>
                <span className="border border-blackish/20 px-3 py-1 bg-paper/50">Z3 Solver</span>
                <span>/</span>
                <span className="border border-blackish/20 px-3 py-1 bg-paper/50">PDG Generation</span>
              </div>
            </div>
          ) : (
            messages.map((msg, idx) => (
              <div 
                key={idx} 
                className={cn(
                  "anim-fade-up flex flex-col max-w-4xl w-full",
                  msg.role === 'user' ? "ml-auto" : ""
                )}
              >
                {/* Protocol Header */}
                <div className="flex items-center gap-2 font-data text-[10px] md:text-xs uppercase mb-2">
                  <span className={cn(
                    "px-2 py-[2px] font-bold border",
                    msg.role === 'user' 
                      ? "bg-blackish text-offwhite border-blackish" 
                      : "bg-signal text-white border-signal"
                  )}>
                    {msg.role === 'user' ? 'GUEST_INPUT' : 'CODEMENTOR_PROCESS'}
                  </span>
                  <span className="text-blackish/50 hidden md:block border border-blackish/20 px-2 py-[2px] bg-paper">
                     ID: TS-{Date.now().toString().slice(-6)}-{idx}
                  </span>
                  {msg.role === 'assistant' && msg.metadata && (
                     <div className="flex gap-1 ml-auto">
                        <span className="text-signal border border-signal/30 px-1 py-px flex items-center gap-1 object-contain"><Network size={10}/> PDG BUILT</span>
                        <span className="text-signal border border-signal/30 px-1 py-px flex items-center gap-1"><Settings2 size={10}/> Z3 TRACE</span>
                     </div>
                  )}
                </div>

                {/* Content Block */}
                <div className={cn(
                  "p-5 md:p-6 border-2 font-medium relative",
                  msg.role === 'user' 
                    ? "bg-paper border-blackish/20" 
                    : "bg-offwhite border-blackish shadow-[4px_4px_0px_#111111]"
                )}>
                  {msg.role === 'assistant' && !msg.content && isLoading && idx === messages.length - 1 ? (
                    <div className="flex items-center gap-2 text-signal font-data text-sm uppercase">
                      <div className="w-2 h-4 bg-signal animate-pulse" /> Analying System Trace...
                    </div>
                  ) : (
                    <div className="prose prose-sm md:prose-base max-w-none! text-blackish prose-pre:bg-blackish prose-pre:text-offwhite prose-pre:border-none prose-pre:rounded-none prose-pre:shadow-[4px_4px_0px_#E63B2E] prose-code:font-data prose-code:text-signal prose-h1:font-drama prose-h2:font-drama prose-headings:text-blackish prose-p:leading-relaxed prose-a:text-signal prose-a:font-bold prose-strong:text-blackish">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                          code({ inline, className, children, ...props }: React.ComponentPropsWithoutRef<'code'> & { inline?: boolean }) {
                            const match = /language-(\w+)/.exec(className || '');
                            return !inline && match ? (
                              <CodeBlock 
                                language={match[1]} 
                                codeString={String(children).replace(/\n$/, '')} 
                              />
                            ) : (
                              <code className={cn("px-1.5 py-0.5 bg-paper border border-blackish/10 mx-0.5", className)} {...props}>
                                {children}
                              </code>
                            );
                          }
                        }}
                      >
                        {msg.content}
                      </ReactMarkdown>
                    </div>
                  )}
                  {msg.role === 'assistant' && (
                     <div className="absolute top-0 right-0 w-2 h-2 bg-signal translate-x-1/2 -translate-y-1/2" />
                  )}
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} className="h-4" />
        </div>

        {/* Code Execution Input */}
        <div className="p-4 md:p-8 border-t-2 border-blackish bg-paper relative">
           {/* Terminal header decoration */}
           <div className="absolute top-0 left-0 w-full h-[6px] bg-blackish/5 flex items-center px-2 gap-1 gap-x-1">
              {Array.from({length: 20}).map((_, i) => (
                 <div key={i} className="h-[2px] w-[2px] bg-blackish/20" />
              ))}
           </div>
           
           <form 
              onSubmit={handleSubmit}
              className="mt-2 flex flex-col md:flex-row items-end md:items-center gap-4 max-w-5xl mx-auto"
           >
              <div className="flex-1 w-full flex items-center bg-offwhite border-2 border-blackish focus-within:ring-2 ring-signal/50 focus-within:shadow-[4px_4px_0px_#E63B2E] transition-all relative group">
                 <div className="absolute left-4 top-1/2 -translate-y-1/2 text-blackish/40 font-data">
                    <ChevronRight size={18} />
                 </div>
                 <input
                    type="text"
                    className="w-full bg-transparent border-none outline-none py-4 pl-12 pr-4 font-heading text-lg placeholder:text-blackish/30"
                    placeholder="Enter failing code block or command sequence..."
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    disabled={isLoading}
                 />
              </div>
              
              <button
                 type="submit"
                 disabled={isLoading || !input.trim()}
                 className="w-full md:w-auto flex items-center justify-center gap-2 bg-signal text-white font-bold uppercase tracking-wider px-8 py-4 border-2 border-blackish hover:bg-blackish transition-colors group disabled:opacity-50 shadow-[4px_4px_0px_#111111] hover:shadow-[2px_2px_0px_#111111] hover:translate-x-[2px] hover:translate-y-[2px]"
              >
                 {isLoading ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                 ) : (
                    <Code2 size={20} className="group-hover:scale-110 transition-transform" />
                 )}
                 Debug Code
              </button>
           </form>
           
           <div className="text-center mt-4">
              <span className="font-data text-[10px] text-blackish/40 uppercase tracking-widest">
                 System: Ready &bull; Encryption: None (Local Environment) &bull; Port: 11434
              </span>
           </div>
        </div>
      </div>
    </div>
  );
}
