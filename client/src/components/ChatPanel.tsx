import { useState, useRef, useEffect, useCallback } from 'react';
import { MessageCircle, Send, X } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Button } from './ui/button';
import { Input } from './ui/input';
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
  const userScrolledRef = useRef(false);
  const pendingTextRef = useRef<string | null>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (!userScrolledRef.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages]);

  // Clear input only after send completes (transition from sending to not sending)
  useEffect(() => {
    if (!sending && pendingTextRef.current) {
      pendingTextRef.current = null;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setInput('');
    }
  }, [sending]);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    userScrolledRef.current = distFromBottom > 50;
  }, []);

  const handleSend = () => {
    if (!input.trim() || sending) return;
    userScrolledRef.current = false;
    pendingTextRef.current = input.trim();
    onSend(input.trim());
  };

  if (!open) {
    return (
      <Button variant="outline" onClick={() => setOpen(true)} className="mt-8 text-xs uppercase tracking-[0.15em]">
        <MessageCircle size={13} /> Ask about this news
      </Button>
    );
  }

  return (
    <div className="mt-8 border border-rule">
      <div className="flex items-center justify-between px-4 py-3 border-b border-rule bg-paper-dark">
        <div className="flex items-center gap-2">
          <MessageCircle size={14} className="text-masthead" />
          <h4 className="text-[13px] font-serif font-bold text-ink">Ask about this news</h4>
        </div>
        <Button variant="ghost" size="icon" onClick={() => setOpen(false)} className="h-7 w-7">
          <X size={14} />
        </Button>
      </div>

      <div ref={scrollRef} onScroll={handleScroll} className="max-h-80 overflow-y-auto p-4 space-y-4" role="log" aria-live="polite">
        {messages.length === 0 && (
          <p className="text-[13px] text-ink-muted italic text-center py-4">
            Ask a question about the news summary above...
          </p>
        )}
        {messages.map((msg, i) => (
          <div key={`${msg.role}-${msg.created_at}-${i}`} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
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
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Ask a question..."
          className="flex-1"
        />
        <Button variant="outline" size="icon" onClick={handleSend} disabled={!input.trim() || sending} aria-label="Send message">
          <Send size={14} />
        </Button>
      </div>
    </div>
  );
}
