import { useState, useRef, useEffect, useCallback } from 'react';
import { MessageCircle, Send } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import type { ChatMessage } from '../types';
import { Drawer, DrawerContent, DrawerTitle } from './ui/drawer';
import { Sheet, SheetContent, SheetTitle } from './ui/sheet';
import { useMediaQuery } from '../hooks/useMediaQuery';

interface ArticleChatPopupProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  headline: string;
  sourceName: string;
  messages: ChatMessage[];
  sending: boolean;
  onSend: (text: string) => void;
}

export function ArticleChatPopup({
  open,
  onOpenChange,
  headline,
  sourceName,
  messages,
  sending,
  onSend,
}: ArticleChatPopupProps) {
  const isDesktop = useMediaQuery('(min-width: 768px)');

  const body = (
    <ChatBody
      isDesktop={isDesktop}
      headline={headline}
      sourceName={sourceName}
      messages={messages}
      sending={sending}
      onSend={onSend}
    />
  );

  if (isDesktop) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className="!p-0 sm:!max-w-[480px] w-full flex flex-col bg-paper gap-0"
        >
          {body}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange} repositionInputs={false}>
      <DrawerContent
        className="!max-h-[92dvh] bg-paper"
        style={{ paddingBottom: 'var(--kbd, 0px)' }}
      >
        {body}
      </DrawerContent>
    </Drawer>
  );
}

interface ChatBodyProps {
  isDesktop: boolean;
  headline: string;
  sourceName: string;
  messages: ChatMessage[];
  sending: boolean;
  onSend: (text: string) => void;
}

function ChatBody({ isDesktop, headline, sourceName, messages, sending, onSend }: ChatBodyProps) {
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const userScrolledRef = useRef(false);
  const pendingTextRef = useRef<string | null>(null);
  const Title = isDesktop ? SheetTitle : DrawerTitle;

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (!userScrolledRef.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  useEffect(() => {
    if (!sending && pendingTextRef.current) {
      pendingTextRef.current = null;
      setInput('');
    }
  }, [sending]);

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 150);
    return () => clearTimeout(t);
  }, []);

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

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex items-center gap-2 px-5 py-4 border-b border-rule">
        <MessageCircle size={18} className="text-masthead" />
        <Title className="font-semibold text-ink text-base m-0">
          Ask about this story
        </Title>
      </div>

      <div className="px-5 py-3 border-b border-rule bg-paper-dark">
        <p className="text-[13px] font-serif font-semibold text-ink line-clamp-2 leading-snug">
          {headline}
        </p>
        <p className="text-[11px] text-ink-muted mt-0.5">{sourceName}</p>
      </div>

      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-5 space-y-4"
        role="log"
        aria-live="polite"
      >
        {messages.length === 0 && !sending && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-12 h-12 rounded-full bg-masthead/10 flex items-center justify-center mb-4">
              <MessageCircle size={20} className="text-masthead" />
            </div>
            <p className="text-sm font-serif text-ink-muted italic leading-relaxed max-w-[260px]">
              Ask a question about this article and get an AI-powered answer based on the summary context.
            </p>
            <div className="flex flex-wrap gap-2 mt-5 justify-center">
              {['What are the key takeaways?', 'Who is affected?', 'Why does this matter?'].map((q) => (
                <button
                  key={q}
                  onClick={() => { setInput(q); inputRef.current?.focus(); }}
                  className="px-3 py-1.5 text-[12px] rounded-full border border-rule text-ink-muted hover:text-ink hover:border-ink/30 transition-colors cursor-pointer"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={`${msg.role}-${msg.created_at}-${i}`} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] px-4 py-2.5 text-[13px] leading-relaxed rounded-2xl break-words ${
                msg.role === 'user'
                  ? 'bg-masthead text-white rounded-br-md'
                  : 'bg-paper-dark text-ink border border-rule rounded-bl-md'
              }`}
            >
              {msg.role === 'assistant' ? (
                <ReactMarkdown
                  components={{
                    p: ({ children }) => <p className="text-[13px] leading-relaxed mb-2 last:mb-0">{children}</p>,
                    strong: ({ children }) => <strong className="font-bold">{children}</strong>,
                    ul: ({ children }) => <ul className="list-disc pl-4 mb-2 space-y-1">{children}</ul>,
                    ol: ({ children }) => <ol className="list-decimal pl-4 mb-2 space-y-1">{children}</ol>,
                    li: ({ children }) => <li className="text-[13px] leading-relaxed">{children}</li>,
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
            <div className="px-4 py-2.5 bg-paper-dark border border-rule text-ink-muted text-[13px] rounded-2xl rounded-bl-md">
              <span className="inline-flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-ink-muted animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-ink-muted animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-ink-muted animate-bounce" style={{ animationDelay: '300ms' }} />
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-rule p-4 bg-paper">
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Ask a question..."
            className="flex-1 px-4 py-2.5 text-sm bg-paper-dark border border-rule rounded-full outline-none focus:border-masthead/50 focus:ring-1 focus:ring-masthead/20 transition-colors text-ink placeholder:text-ink-muted"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || sending}
            className="flex items-center justify-center w-10 h-10 rounded-full bg-masthead text-white disabled:opacity-40 hover:opacity-90 transition-opacity shrink-0 cursor-pointer disabled:cursor-not-allowed"
            aria-label="Send message"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
