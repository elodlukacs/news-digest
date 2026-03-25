import { useState, useRef, useEffect } from 'react';
import { MessageCircle, Send, X } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import type { ChatMessage } from '../types';

interface Props {
  messages: ChatMessage[];
  sending: boolean;
  onSend: (text: string) => void;
}

export function ChatPanel({ messages, sending, onSend }: Props) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const handleSend = () => {
    if (!input.trim() || sending) return;
    onSend(input.trim());
    setInput('');
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mt-8 flex items-center gap-2 px-4 py-2.5 text-xs uppercase tracking-[0.15em] font-medium cursor-pointer transition-all border border-rule text-ink-muted hover:text-ink hover:border-ink"
      >
        <MessageCircle size={13} /> Ask about this news
      </button>
    );
  }

  return (
    <div className="mt-8 border border-rule">
      <div className="flex items-center justify-between px-4 py-3 border-b border-rule bg-paper-dark">
        <div className="flex items-center gap-2">
          <MessageCircle size={14} className="text-masthead" />
          <h4 className="text-[13px] font-serif font-bold text-ink">Ask about this news</h4>
        </div>
        <button onClick={() => setOpen(false)} className="p-1 text-ink-muted hover:text-ink cursor-pointer">
          <X size={14} />
        </button>
      </div>

      <div ref={scrollRef} className="max-h-80 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <p className="text-[13px] text-ink-muted italic text-center py-4">
            Ask a question about the news summary above...
          </p>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[80%] px-3 py-2 text-[13px] leading-relaxed ${
                msg.role === 'user' ? 'bg-masthead/10 text-ink' : 'bg-paper-dark text-ink'
              }`}
            >
              {msg.role === 'assistant' ? (
                <ReactMarkdown
                  components={{
                    p: ({ children }) => <p className="text-[13px] leading-relaxed mb-2 last:mb-0">{children}</p>,
                    strong: ({ children }) => <strong className="font-bold">{children}</strong>,
                  }}
                >
                  {msg.content}
                </ReactMarkdown>
              ) : (
                msg.content
              )}
            </div>
          </div>
        ))}
        {sending && (
          <div className="flex justify-start">
            <div className="px-3 py-2 bg-paper-dark text-ink-muted text-[13px]">
              <span className="animate-pulse">Thinking...</span>
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-2 p-3 border-t border-rule">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Ask a question..."
          className="flex-1 px-3 py-2 text-sm bg-transparent border border-rule text-ink placeholder-ink-muted focus:outline-none focus:border-ink"
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || sending}
          className="px-3 py-2 border border-ink text-ink hover:bg-ink hover:text-paper cursor-pointer transition-all disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <Send size={14} />
        </button>
      </div>
    </div>
  );
}
