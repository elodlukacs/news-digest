import React, { useState, useEffect, useCallback, useRef } from 'react';
import { API_BASE } from '../config';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Input } from './ui/input';
import { Alert, AlertDescription } from './ui/alert';
import { Save, Check, Search, ArrowRightLeft, Briefcase, Brain, Newspaper } from 'lucide-react';

interface Prompt {
  id: number;
  slug: string;
  name: string;
  description: string;
  category: string;
  system_message: string;
  user_prompt: string;
  created_at: string;
  updated_at: string;
}

interface PromptForm {
  name: string;
  description: string;
  system_message: string;
  user_prompt: string;
}

const CATEGORY_CONFIG: { id: string; label: string; shortLabel: string; icon: React.ReactNode }[] = [
  { id: 'bias-radar', label: 'Bias Radar', shortLabel: 'Radar', icon: <Search size={18} /> },
  { id: 'bridge', label: 'Bridge', shortLabel: 'Bridge', icon: <ArrowRightLeft size={18} /> },
  { id: 'jobs', label: 'Jobs', shortLabel: 'Jobs', icon: <Briefcase size={18} /> },
  { id: 'mindgames', label: 'MindGames', shortLabel: 'Mind', icon: <Brain size={18} /> },
  { id: 'news', label: 'News', shortLabel: 'News', icon: <Newspaper size={18} /> },
];

export function PromptManager() {
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successSlug, setSuccessSlug] = useState<string | null>(null);
  const [savingSlug, setSavingSlug] = useState<string | null>(null);
  const [forms, setForms] = useState<Record<string, PromptForm>>({});
  const [activeCategory, setActiveCategory] = useState<string>('');
  const abortRef = useRef<AbortController | null>(null);

  const fetchPrompts = useCallback(async () => {
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/prompts`, { signal: controller.signal });
      if (!res.ok) throw new Error('Failed to fetch prompts');
      const data = await res.json();
      if (!controller.signal.aborted) {
        setPrompts(data);
        const formMap: Record<string, PromptForm> = {};
        for (const p of data) {
          formMap[p.slug] = {
            name: p.name,
            description: p.description,
            system_message: p.system_message,
            user_prompt: p.user_prompt,
          };
        }
        setForms(formMap);
        const cats = [...new Set(data.map((p: Prompt) => p.category))];
        if (cats.length > 0 && !activeCategory) setActiveCategory(cats[0] as string);
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return;
      console.error('Failed to fetch prompts', e);
      setError('Failed to load prompts');
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPrompts();
    return () => { if (abortRef.current) abortRef.current.abort(); };
  }, [fetchPrompts]);

  const updateField = (slug: string, field: keyof PromptForm, value: string) => {
    setForms(prev => ({
      ...prev,
      [slug]: { ...prev[slug], [field]: value },
    }));
  };

  const savePrompt = async (slug: string) => {
    const form = forms[slug];
    if (!form) return;
    setSavingSlug(slug);
    setError(null);
    setSuccessSlug(null);
    try {
      const res = await fetch(`${API_BASE}/prompts/${slug}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to save prompt');
      }
      const updated = await res.json();
      setPrompts(prev => prev.map(p => p.slug === slug ? updated : p));
      setSuccessSlug(slug);
      setTimeout(() => setSuccessSlug(null), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSavingSlug(null);
    }
  };

  const categories = [...new Set(prompts.map(p => p.category))];
  const availableTabs = CATEGORY_CONFIG.filter(c => categories.includes(c.id));

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <div className="animate-pulse space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-24 bg-paper-dark rounded" />
          ))}
        </div>
      </div>
    );
  }

  const filteredPrompts = prompts.filter(p => p.category === activeCategory);

  return (
    <>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 pb-24 md:pb-8">
        <div className="mb-8">
          <h2 className="font-serif text-2xl font-bold text-ink tracking-tight">AI Prompt Manager</h2>
          <p className="text-sm text-ink-muted mt-1">
            Edit the prompts used by AI features. Use <code className="bg-paper-dark px-1 rounded text-xs">{'{{variable}}'}</code> placeholders for dynamic content.
          </p>
        </div>

        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Desktop tabs */}
        <div className="hidden md:flex md:justify-center md:mb-6">
          <div className="inline-flex items-center gap-1 p-1.5 bg-paper-dark rounded-xl border border-rule">
            {availableTabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveCategory(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-lg transition-all duration-200 cursor-pointer ${
                  activeCategory === tab.id
                    ? 'bg-paper text-ink shadow-sm border border-rule'
                    : 'text-ink-muted hover:text-ink hover:bg-paper/50'
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          {filteredPrompts.map(prompt => (
            <PromptCard
              key={prompt.slug}
              prompt={prompt}
              form={forms[prompt.slug]}
              onFieldChange={(field, value) => updateField(prompt.slug, field, value)}
              onSave={() => savePrompt(prompt.slug)}
              saving={savingSlug === prompt.slug}
              saved={successSlug === prompt.slug}
            />
          ))}
        </div>
      </div>

      {/* Mobile bottom tab bar */}
      <nav className="fixed bottom-0 inset-x-0 z-30 md:hidden bg-paper border-t border-rule safe-area-pb">
        <div className="flex items-stretch h-16">
          {availableTabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveCategory(tab.id)}
              className={`relative flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-semibold transition-colors cursor-pointer active:bg-paper-dark ${
                activeCategory === tab.id ? 'text-ink' : 'text-ink-muted'
              }`}
            >
              {tab.icon}
              <span>{tab.shortLabel}</span>
              {activeCategory === tab.id && (
                <span className="absolute bottom-1.5 w-1 h-1 rounded-full bg-ink" />
              )}
            </button>
          ))}
        </div>
      </nav>
    </>
  );
}

function PromptCard({
  prompt,
  form,
  onFieldChange,
  onSave,
  saving,
  saved,
}: {
  prompt: Prompt;
  form: PromptForm | undefined;
  onFieldChange: (field: keyof PromptForm, value: string) => void;
  onSave: () => void;
  saving: boolean;
  saved: boolean;
}) {
  if (!form) return null;

  const hasChanged =
    form.name !== prompt.name ||
    form.description !== prompt.description ||
    form.system_message !== prompt.system_message ||
    form.user_prompt !== prompt.user_prompt;

  return (
    <div className="border border-rule rounded bg-paper p-4 sm:p-5 space-y-4">
      <div className="space-y-3 sm:space-y-0 sm:flex sm:items-center sm:justify-between">
        <div className="flex-1 sm:mr-4">
          <Input
            value={form.name}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => onFieldChange('name', e.target.value)}
            className="text-base font-serif font-bold text-ink border-none shadow-none p-0 h-auto bg-transparent focus-visible:ring-0"
            placeholder="Prompt name"
          />
          <Input
            value={form.description}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => onFieldChange('description', e.target.value)}
            className="text-xs text-ink-muted border-none shadow-none p-0 h-auto mt-0.5 bg-transparent focus-visible:ring-0"
            placeholder="Description"
          />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {saved && (
            <span className="text-xs text-green-600 flex items-center gap-1">
              <Check size={13} /> Saved
            </span>
          )}
          <Button
            size="sm"
            onClick={onSave}
            disabled={saving || !hasChanged}
            className="gap-1.5"
          >
            <Save size={13} />
            {saving ? 'Saving...' : 'Update'}
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-3 text-[10px] text-ink-muted">
        <span className="font-mono">{prompt.slug}</span>
        <span>Updated {new Date(prompt.updated_at).toLocaleDateString()}</span>
      </div>

      {form.system_message !== undefined && form.system_message !== null && (
        <div>
          <label className="text-xs font-medium text-ink-muted uppercase tracking-wider block mb-1">System Message</label>
          <Textarea
            value={form.system_message}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => onFieldChange('system_message', e.target.value)}
            rows={3}
            className="text-sm font-mono resize-y min-h-[60px]"
          />
        </div>
      )}

      <div>
        <label className="text-xs font-medium text-ink-muted uppercase tracking-wider block mb-1">User Prompt Template</label>
        <Textarea
          value={form.user_prompt}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => onFieldChange('user_prompt', e.target.value)}
          rows={10}
          className="text-sm font-mono resize-y min-h-[120px]"
        />
      </div>
    </div>
  );
}
