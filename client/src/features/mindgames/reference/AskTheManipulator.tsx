import { useState, useRef, useCallback, useEffect } from 'react';
import { Card } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Textarea } from '../../../components/ui/textarea';
import { Loader2, MessageSquare, Send, AlertTriangle, RotateCcw } from 'lucide-react';
import { FeaturePanelHeader } from '../common';
import { API_BASE } from '../../../config';
import { useLlm } from '../../../contexts/LlmContext';

interface Persona {
  id: string;
  name: string;
  icon: string;
  greeting: string;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  personaName?: string;
  personaIcon?: string;
}

export function AskTheManipulator() {
  const selectedLlm = useLlm();
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [selectedPersona, setSelectedPersona] = useState<Persona | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const abortRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`${API_BASE}/manipulator/personas`)
      .then(r => r.json())
      .then(setPersonas)
      .catch(() => setError('Failed to load personas. Please refresh.'));
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const selectPersona = (persona: Persona) => {
    setSelectedPersona(persona);
    setMessages([{
      role: 'assistant',
      content: persona.greeting,
      personaName: persona.name,
      personaIcon: persona.icon,
    }]);
    setError('');
  };

  const send = useCallback(async () => {
    if (!input.trim() || !selectedPersona || loading) return;
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    const userMsg: Message = { role: 'user', content: input.trim() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    setError('');

    try {
      const res = await fetch(`${API_BASE}/manipulator/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          personaId: selectedPersona.id,
          message: userMsg.content,
          provider: selectedLlm,
        }),
        signal: ctrl.signal,
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed');
      const data = await res.json();
      if (!ctrl.signal.aborted) {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: data.response,
          personaName: data.personaName,
          personaIcon: data.personaIcon,
        }]);
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      setError(err instanceof Error ? err.message : 'Failed to send');
    } finally {
      if (!ctrl.signal.aborted) setLoading(false);
    }
  }, [input, selectedPersona, selectedLlm, loading]);

  const reset = () => {
    setSelectedPersona(null);
    setMessages([]);
    setInput('');
    setError('');
    abortRef.current?.abort();
  };

  return (
    <Card className="p-5 md:p-6 flex flex-col gap-4">
      <FeaturePanelHeader
        icon={<MessageSquare size={20} className="text-outrage shrink-0" />}
        title="Ask the Manipulator"
        infoTitle="Ask the Manipulator"
        researcher="Renee DiResta · Joan Donovan"
        summary="What would a professional influence operator see when they look at your social media profile? Chat with three personas who represent different corners of the disinformation ecosystem."
        sections={[
          { heading: 'The Personas', items: [
            'Influence Analyst — studied state-sponsored ops for 15 years',
            'Troll Farm Operator — reformed ex-operator who ran 200+ fake accounts',
            'Cognitive Bias Coach — behavioral psychologist who maps your vulnerabilities',
          ]},
          { heading: 'How To Use', content: 'Pick a persona and ask questions. They\'ll explain how they\'d target you — what hooks they\'d use, which platforms, what emotional levers. This is purely educational.' },
        ]}
      />

      {error && (
        <div className="p-3 bg-red-50 rounded-lg text-sm text-red-700 border border-red-200 flex items-center gap-2">
          <AlertTriangle size={14} /> {error}
        </div>
      )}

      {/* Persona selection */}
      {!selectedPersona && (
        <div className="grid grid-cols-1 gap-3">
          {personas.map(p => (
            <button
              key={p.id}
              onClick={() => selectPersona(p)}
              className="text-left p-4 rounded-lg border border-rule hover:border-ink hover:shadow-sm transition-all cursor-pointer"
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">{p.icon}</span>
                <span className="text-sm font-semibold text-ink">{p.name}</span>
              </div>
              <p className="text-xs text-ink-muted">{p.greeting}</p>
            </button>
          ))}
        </div>
      )}

      {/* Chat UI */}
      {selectedPersona && (
        <>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-lg">{selectedPersona.icon}</span>
              <span className="text-sm font-semibold text-ink">{selectedPersona.name}</span>
            </div>
            <Button onClick={reset} variant="ghost" size="sm" className="gap-1.5 text-xs text-ink-muted">
              <RotateCcw size={12} /> Switch persona
            </Button>
          </div>

          <div className="flex flex-col gap-3 min-h-[200px] max-h-[400px] overflow-y-auto">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-lg px-4 py-3 text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-ink text-paper'
                    : 'bg-paper-dark border border-rule text-ink'
                }`}>
                  {msg.role === 'assistant' && (
                    <p className="text-[10px] text-ink-muted mb-1 font-semibold">
                      {msg.personaIcon} {msg.personaName}
                    </p>
                  )}
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-paper-dark border border-rule rounded-lg px-4 py-3 text-sm text-ink-muted flex items-center gap-2">
                  <Loader2 size={14} className="animate-spin" /> Thinking...
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="flex gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask a question..."
              className="text-sm min-h-[44px] max-h-[100px] resize-none"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
            />
            <Button onClick={send} disabled={loading || !input.trim()} className="shrink-0 h-11 px-4">
              <Send size={16} />
            </Button>
          </div>
        </>
      )}
    </Card>
  );
}
