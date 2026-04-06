import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { FocusTrap } from 'focus-trap-react';
import { MessageCircle, Send, X } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import type { ChatMessage } from '../types';

interface ArticleChatPopupProps {
  headline: string;
  sourceName: string;
  messages: ChatMessage[];
  sending: boolean;
  onSend: (text: string) => void;
  onClose: () => void;
}

const DISMISS_THRESHOLD = 120;

export function ArticleChatPopup({
  headline,
  sourceName,
  messages,
  sending,
  onSend,
  onClose,
}: ArticleChatPopupProps) {
  const [input, setInput] = useState('');
  const [dragY, setDragY] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<HTMLDivElement>(null);
  const touchState = useRef({ active: false, startY: 0 });
  const userScrolledRef = useRef(false);
  const pendingTextRef = useRef<string | null>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (!userScrolledRef.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages]);

  // Clear input after send completes
  useEffect(() => {
    if (!sending && pendingTextRef.current) {
      pendingTextRef.current = null;
      setInput('');
    }
  }, [sending]);

  // Focus input on mount
  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  // Lock body scroll
  useEffect(() => {
    const scrollY = window.scrollY;
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.left = '0';
    document.body.style.right = '0';
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.left = '';
      document.body.style.right = '';
      document.body.style.overflow = '';
      window.scrollTo(0, scrollY);
    };
  }, []);

  // Mobile swipe-to-dismiss
  useEffect(() => {
    const panel = panelRef.current;
    const handle = handleRef.current;
    if (!panel || !handle) return;

    function onTouchStart(e: TouchEvent) {
      touchState.current = { active: true, startY: e.touches[0].clientY };
    }
    function onTouchMove(e: TouchEvent) {
      if (!touchState.current.active) return;
      const diff = e.touches[0].clientY - touchState.current.startY;
      if (diff < 0) { setDragY(null); return; }
      e.preventDefault();
      setDragY(diff);
    }
    function onTouchEnd() {
      touchState.current.active = false;
      setDragY((prev) => {
        if (prev !== null && prev > DISMISS_THRESHOLD) onClose();
        return null;
      });
    }

    handle.addEventListener('touchstart', onTouchStart, { passive: true });
    handle.addEventListener('touchmove', onTouchMove, { passive: false });
    handle.addEventListener('touchend', onTouchEnd, { passive: true });
    return () => {
      handle.removeEventListener('touchstart', onTouchStart);
      handle.removeEventListener('touchmove', onTouchMove);
      handle.removeEventListener('touchend', onTouchEnd);
    };
  }, [onClose]);

  // Escape to close
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

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

  const panelTransform = dragY !== null ? `translateY(${dragY}px)` : undefined;
  const panelOpacity = dragY !== null ? Math.max(0, 1 - dragY / 400) : undefined;
  const backdropOpacity = dragY !== null ? Math.max(0, 0.3 - dragY / 1000) : undefined;

  return createPortal(
    <>
      <div
        className="fixed inset-0 bg-black/30 z-40"
        onClick={onClose}
        aria-hidden="true"
        style={backdropOpacity !== undefined ? { opacity: backdropOpacity } : undefined}
      />

      <FocusTrap focusTrapOptions={{ allowOutsideClick: true, returnFocusOnDeactivate: true }}>
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-label="Chat about article"
          className={`fixed z-50 bg-paper shadow-2xl flex flex-col border-rule panel-slide-in
            inset-0 rounded-t-2xl border-t
            md:inset-y-0 md:right-0 md:left-auto md:rounded-none
            md:w-full md:max-w-[480px] md:border-l md:border-t-0
          `}
          style={{
            transform: panelTransform,
            opacity: panelOpacity,
            transition: dragY !== null ? 'none' : undefined,
          }}
        >
          {/* Mobile drag handle */}
          <div ref={handleRef} className="md:hidden flex justify-center pt-3 pb-1 cursor-grab">
            <div className="w-10 h-1 rounded-full bg-rule" />
          </div>

          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-rule">
            <div className="flex items-center gap-2">
              <MessageCircle size={18} className="text-masthead" />
              <span className="font-semibold text-ink">Ask about this story</span>
            </div>
            <button
              onClick={onClose}
              className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-paper-dark transition-colors cursor-pointer"
              aria-label="Close chat"
            >
              <X size={16} className="text-ink-muted" />
            </button>
          </div>

          {/* Article context bar */}
          <div className="px-5 py-3 border-b border-rule bg-paper-dark">
            <p className="text-[13px] font-serif font-semibold text-ink line-clamp-2 leading-snug">
              {headline}
            </p>
            <p className="text-[11px] text-ink-muted mt-0.5">{sourceName}</p>
          </div>

          {/* Messages area */}
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

          {/* Input area */}
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
      </FocusTrap>
    </>,
    document.body
  );
}
