import { useState, useEffect, useCallback } from 'react';
import { Search, Copy, Check, BookOpen, Filter, ChevronDown, ChevronRight } from 'lucide-react';
import { FeaturePanelHeader } from '../common';
import { Card, CardContent } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { Input } from '../../../components/ui/input';
import { API_BASE } from '../../../config';

interface Prompt {
  id: string;
  prompt: string;
  whenToUse: string;
  exampleInput: string;
  isCustom?: boolean;
  category: string;
}

interface Category {
  name: string;
  prompts: Prompt[];
}

export function PromptLibrary() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Bias Detection');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedPrompts, setExpandedPrompts] = useState<Set<string>>(new Set());

  useEffect(() => {
    async function loadPrompts() {
      try {
        const res = await fetch(`${API_BASE}/cognitive/prompts`);
        if (res.ok) {
          const data = await res.json();
          setCategories(data);
        }
      } catch { /* ignore */ } finally {
        setLoading(false);
      }
    }
    loadPrompts();
  }, []);

  const allPrompts = categories.flatMap((c) =>
    c.prompts.map((p) => ({ ...p, category: c.name }))
  );

  const filteredPrompts = allPrompts.filter((p) => {
    const matchesSearch =
      !search ||
      p.prompt.toLowerCase().includes(search.toLowerCase()) ||
      p.whenToUse.toLowerCase().includes(search.toLowerCase()) ||
      (p.exampleInput && p.exampleInput.toLowerCase().includes(search.toLowerCase()));
    const matchesCategory = p.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleCopy = useCallback(async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch { /* ignore */ }
  }, []);

  const toggleExpand = useCallback((id: string) => {
    setExpandedPrompts((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const expandAll = useCallback(() => {
    setExpandedPrompts(new Set(filteredPrompts.map((p) => p.id)));
  }, [filteredPrompts]);

  const collapseAll = useCallback(() => {
    setExpandedPrompts(new Set());
  }, []);

  const categoryNames = categories.map((c) => c.name);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-ink-muted text-sm">Loading prompts...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4">
        <FeaturePanelHeader
          icon={<BookOpen size={20} className="text-masthead shrink-0" />}
          title="Prompt Library"
          infoTitle="Prompt Library"
          researcher="Practical critical thinking layer"
          summary="Ready-to-use AI prompts so you can run bias detection, fallacy analysis, and perspective audits on any content — not just what's in this app."
          sections={[
            { heading: 'Why Prompts Matter', content: 'The ability to self-audit content with AI is a transferable skill that works everywhere. These templates let you apply the same analytical frameworks used throughout MindGames to any article, tweet, or speech you encounter.' },
            { heading: 'Prompt Types', items: [
              'Bias Detection — "Identify any elements in this story where there might be bias; assess whether this would feel fair to people with opposing views"',
              'Perspective Taking — "How could this article be rewritten so a specific group could engage with it without triggering reactance?"',
              'Fallacy Search — "Analyse this headline for post hoc reasoning or false dichotomy; explain the flaw in the logic"',
              'Steelmanning — "Present the strongest possible version of the argument you disagree with"',
              'Source Evaluation — "Identify red flags in this source\'s methodology, funding, or framing"',
            ]},
            { heading: 'Works With Any AI', content: 'Copy any prompt and paste it into ChatGPT, Claude, Gemini, or any AI assistant. The skills transfer — you\'re building habits of analytical thinking, not dependence on any single tool.' },
          ]}
        />
        <p className="text-xs text-ink-muted leading-relaxed">
          Templates for bias detection, perspective taking, fallacy search, steelmanning, and source evaluation. Copy any prompt and use it to analyze news or arguments.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
          <Input
            placeholder="Search prompts..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-11 text-sm"
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Filter size={14} className="text-ink-muted" />
          {categoryNames.map((cat) => (
            <Button
              key={cat}
              variant={selectedCategory === cat ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedCategory(cat)}
              className="h-8 text-xs"
            >
              {cat}
            </Button>
          ))}
        </div>
      </div>

      <div className="my-2" />

      {filteredPrompts.length === 0 ? (
        <div className="text-center py-8 text-ink-muted text-sm">
          No prompts match your search.
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-ink-muted pb-2">
            <span>{filteredPrompts.length} prompts</span>
            <div className="flex gap-2">
              <button onClick={expandAll} className="hover:text-ink underline">Expand all</button>
              <span>|</span>
              <button onClick={collapseAll} className="hover:text-ink underline">Collapse all</button>
            </div>
          </div>
          {filteredPrompts.map((prompt) => (
            <PromptCard
              key={prompt.id}
              prompt={prompt}
              isCopied={copiedId === prompt.id}
              onCopy={handleCopy}
              isExpanded={expandedPrompts.has(prompt.id)}
              onToggle={() => toggleExpand(prompt.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function PromptCard({
  prompt,
  isCopied,
  onCopy,
  isExpanded,
  onToggle,
}: {
  prompt: Prompt;
  isCopied: boolean;
  onCopy: (id: string, text: string) => void;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const categoryColor = getCategoryColor(prompt.category);

  return (
    <Card className="border-l-2 overflow-hidden transition-all duration-200" style={{ borderLeftColor: categoryColor }}>
      <CardContent className="p-0">
        <button
          onClick={onToggle}
          className="w-full p-3 flex items-start gap-3 hover:bg-paper-dark/30 transition-colors text-left"
        >
          <div className="mt-0.5 text-ink-muted shrink-0">
            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </div>
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <Badge variant="secondary" className="text-[10px] shrink-0" style={{ backgroundColor: categoryColor + '20', color: categoryColor }}>
                {prompt.category}
              </Badge>
              <span className="text-[10px] text-ink-muted truncate max-w-[60%]">{isExpanded ? 'Click to collapse' : 'Click to expand'}</span>
            </div>
            <p className={`text-sm text-ink leading-relaxed font-medium ${!isExpanded ? 'line-clamp-2' : ''}`}>{prompt.prompt}</p>
          </div>
        </button>
        
        <div className={`overflow-hidden transition-all duration-200 ease-in-out ${isExpanded ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'}`}>
          <div className="px-3 pb-3 pl-7 space-y-3 border-t border-rule/50 mt-0 pt-3">
            {prompt.whenToUse && (
              <div className="space-y-1">
                <p className="text-[10px] uppercase tracking-wider text-ink-muted font-semibold">When to use</p>
                <p className="text-xs text-ink-light leading-relaxed">{prompt.whenToUse}</p>
              </div>
            )}
            {prompt.exampleInput && (
              <div className="space-y-1">
                <p className="text-[10px] uppercase tracking-wider text-ink-muted font-semibold">Example input</p>
                <p className="text-xs text-ink-light leading-relaxed italic bg-paper-dark/50 p-2 rounded border border-rule">
                  {prompt.exampleInput}
                </p>
              </div>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => { e.stopPropagation(); onCopy(prompt.id, prompt.prompt); }}
              className="h-7 px-2 text-xs gap-1.5"
            >
              {isCopied ? (
                <>
                  <Check size={12} className="text-green-600" />
                  <span className="text-green-600">Copied</span>
                </>
              ) : (
                <>
                  <Copy size={12} />
                  <span>Copy prompt</span>
                </>
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function getCategoryColor(category: string): string {
  const colors: Record<string, string> = {
    'Bias Detection': 'var(--color-observation)',
    'Perspective Taking': 'var(--color-curiosity)',
    'Fallacy Search': 'var(--color-outrage)',
    'Steelmanning': 'var(--color-insight)',
    'Source Evaluation': 'var(--color-masthead)',
    'Custom': '#888',
  };
  return colors[category] || '#666';
}
