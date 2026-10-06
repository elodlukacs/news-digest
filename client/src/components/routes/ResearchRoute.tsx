import { useCallback, useEffect, useRef, useState } from 'react';
import { useOutletContext, useSearchParams } from 'react-router-dom';
import { ArrowLeft, RotateCw } from 'lucide-react';

import { ArticleChatPopup } from '../ArticleChatPopup';
import { Skeleton } from '../ui/skeleton';
import { useTopicResearch, useResearchChat } from '../../hooks/useApi';
import type { AppOutletContext } from '../../types/routing';
import {
  ResearchSearchForm,
  ResearchProgress,
  ResearchArticle,
  RecentResearchList,
} from '@/features/research';

// `?r=<id>` keeps a result addressable, so reload and Back/Forward work.
const RESULT_PARAM = 'r';

export function ResearchRoute() {
  const { selectedLlm, articleFontSize } = useOutletContext<AppOutletContext>();
  const { result, loading, error, recent, research, load, remove, clear } = useTopicResearch(selectedLlm);
  const [searchParams, setSearchParams] = useSearchParams();
  const [pendingTopic, setPendingTopic] = useState('');
  // A new research run gets the step-by-step progress; reopening a saved one is
  // a quick read and only needs a placeholder.
  const [researching, setResearching] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const chat = useResearchChat(result?.id ?? null, selectedLlm);

  const paramId = Number(searchParams.get(RESULT_PARAM)) || null;
  const shownIdRef = useRef<number | null>(null);
  useEffect(() => {
    shownIdRef.current = result?.id ?? null;
  }, [result]);

  // Follow the URL: open the result it names, or go back to the empty page.
  useEffect(() => {
    if (paramId) {
      if (shownIdRef.current !== paramId) load(paramId);
    } else if (shownIdRef.current) {
      clear();
    }
  }, [paramId, load, clear]);

  const submit = useCallback(async (topic: string, fresh = false) => {
    setPendingTopic(topic);
    setChatOpen(false);
    setResearching(true);
    const data = await research(topic, { fresh });
    setResearching(false);
    if (data) {
      shownIdRef.current = data.id;
      setSearchParams({ [RESULT_PARAM]: String(data.id) });
    }
  }, [research, setSearchParams]);

  // Back to the search page with the recent list. Also cancels a research
  // still running, so its result does not pop up afterwards.
  const goBack = useCallback(() => {
    clear();
    setResearching(false);
    setChatOpen(false);
    if (paramId) setSearchParams({});
  }, [clear, paramId, setSearchParams]);

  const empty = !result && !loading && !error;

  return (
    // Same container as the masthead, so the page lines up with the logo and nav.
    <div className="max-w-[1600px] mx-auto px-4 md:px-6 pb-24">
      {empty ? (
        <div className="min-h-[68vh] max-w-[1040px] flex flex-col justify-center pt-10">
          <h1 className="font-serif text-[34px] leading-[1.1] sm:text-[48px] md:text-[60px] xl:text-[68px] font-black text-ink tracking-[-0.025em] max-w-[18ch]">
            What do you want to understand today?
          </h1>
          <p className="mt-5 max-w-[60ch] font-[family-name:var(--font-body)] text-[17px] md:text-[19px] leading-[1.7] text-ink-light">
            Name a story, conflict or crisis. You get the background, what set it off, how it escalated and
            where it stands now, drawn from news outlets around the world.
          </p>
          <div className="mt-10">
            <ResearchSearchForm size="hero" busy={false} onSubmit={(t) => submit(t)} />
          </div>
          <RecentResearchList
            items={recent}
            onOpen={(id) => setSearchParams({ [RESULT_PARAM]: String(id) })}
            onRemove={remove}
          />
        </div>
      ) : (
        <div className="max-w-[1400px]">
          <button
            type="button"
            onClick={goBack}
            className="mt-5 -ml-1.5 inline-flex items-center gap-1 rounded-md px-1.5 py-1 font-[family-name:var(--font-widget)] text-[14px] font-medium text-ink-muted hover:text-ink transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-masthead"
          >
            <ArrowLeft size={16} aria-hidden />
            Back to search
          </button>
          <div className="pt-4">
            <ResearchSearchForm
              key={result?.id ?? pendingTopic}
              size="compact"
              busy={loading}
              initialTopic={result?.topic ?? pendingTopic}
              onSubmit={(t) => submit(t)}
            />
          </div>

          {loading && researching && <ResearchProgress topic={pendingTopic} />}
          {loading && !researching && (
            <div className="pt-10 space-y-4 max-w-[760px]" aria-busy>
              <Skeleton className="w-4/5 h-10" />
              <Skeleton className="w-40 h-3" />
              <Skeleton className="w-full h-4 mt-8" />
              <Skeleton className="w-full h-4" />
              <Skeleton className="w-3/4 h-4" />
            </div>
          )}

          {error && !loading && (
            <div role="alert" className="pt-12 max-w-[60ch]">
              <p className="font-serif text-[22px] font-bold text-ink">The research didn’t finish.</p>
              <p className="mt-2 font-[family-name:var(--font-body)] text-[16px] leading-relaxed text-ink-light">{error}</p>
              {pendingTopic && (
                <button
                  type="button"
                  onClick={() => submit(pendingTopic)}
                  className="mt-5 inline-flex items-center gap-2 rounded-md bg-masthead text-paper px-4 py-2 font-[family-name:var(--font-widget)] text-[14px] font-semibold hover:bg-masthead/90 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-masthead focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
                >
                  <RotateCw size={14} />
                  Try again
                </button>
              )}
            </div>
          )}

          {result && !loading && (
            <ResearchArticle
              research={result}
              fontSize={articleFontSize}
              onAskFollowUp={() => setChatOpen(true)}
              onResearchAgain={() => submit(result.topic, true)}
            />
          )}
        </div>
      )}

      {result && (
        <ArticleChatPopup
          open={chatOpen}
          onOpenChange={setChatOpen}
          headline={result.headline}
          sourceName={`${result.sources.length} sources`}
          messages={chat.messages}
          sending={chat.sending}
          onSend={chat.send}
        />
      )}
    </div>
  );
}
