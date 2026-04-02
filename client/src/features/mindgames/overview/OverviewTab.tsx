import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Brain, Search, Shield, Microscope, RotateCcw, Trash2, Activity, Target, Zap } from 'lucide-react';
import { StressDiagnostic } from '../reflection/StressDiagnostic';
import { TabHeader } from '../common';
import { API_BASE } from '../../../config';

interface DashboardStats {
  forensicCount: number;
  avgBiasScore: number;
  inoculationSessions: number;
  bestLevel: string;
  journalEntries: number;
  avgShift: number;
  auditCount: number;
  avgSiloScore: number;
}

export function OverviewTab() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [stressDiagOpen, setStressDiagOpen] = useState(false);

  const loadStats = useCallback(async () => {
    try {
      const [forensic, sessionsRes, journal, audits] = await Promise.all([
        fetch(`${API_BASE}/forensics/history?limit=100`).then(r => r.json()).catch(() => []),
        fetch(`${API_BASE}/inoculation/sessions`).then(r => r.json()).catch(() => ({ sessions: [] })),
        fetch(`${API_BASE}/scientist/journal`).then(r => r.json()).catch(() => []),
        fetch(`${API_BASE}/bridge/audits`).then(r => r.json()).catch(() => []),
      ]);

      const sessions = Array.isArray(sessionsRes) ? sessionsRes : (sessionsRes.sessions || []);
      const doseLabels = ['', 'Micro-dose', 'Active', 'Full Virus'];
      const bestDose = sessions.reduce((best: number, s: { level: string }) => {
        const d = parseInt(s.level, 10);
        return (!isNaN(d) && d > best) ? d : best;
      }, 0);

      setStats({
        forensicCount: forensic.length,
        avgBiasScore: forensic.length > 0 ? Math.round((forensic.reduce((s: number, f: { bias_score: number }) => s + (f.bias_score || 0), 0) / forensic.length) * 10) / 10 : 0,
        inoculationSessions: sessions.length,
        bestLevel: bestDose > 0 ? doseLabels[bestDose] : 'Not started',
        journalEntries: journal.length,
        avgShift: journal.length > 0
          ? Math.round(journal.reduce((s: number, j: { initial_confidence: number; final_confidence: number }) => s + Math.abs(j.final_confidence - j.initial_confidence), 0) / journal.length)
          : 0,
        auditCount: audits.length,
        avgSiloScore: audits.length > 0 ? Math.round((audits.reduce((s: number, a: { siloing_score: number }) => s + (a.siloing_score || 0), 0) / audits.length) * 10) / 10 : 0,
      });
    } catch (err) {
      console.error('Failed to load dashboard stats:', err);
    }
  }, []);

  useEffect(() => { loadStats(); }, [loadStats]);

  const handleReset = async () => {
    if (!window.confirm('Clear all cognitive training progress? This will delete all forensic analyses, inoculation sessions, debate journals, and bridge audits. This cannot be undone.')) return;
    try {
      await fetch(`${API_BASE}/progress/reset`, { method: 'DELETE' });
      setStats(null);
      loadStats();
    } catch (err) {
      console.error('Failed to reset cognitive progress:', err);
    }
  };

  const isNewUser = !stats || (
    stats.forensicCount === 0 &&
    stats.inoculationSessions === 0 &&
    stats.journalEntries === 0 &&
    stats.auditCount === 0
  );

  return (
    <div className="space-y-6 mt-3">
      <TabHeader
        icon={<Brain size={26} className="text-masthead md:!w-8 md:!h-8" />}
        title="Getting Harder to Fool"
        description="Practice spotting manipulation, challenge your own beliefs, and see how your thinking changes over time."
      />

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <QuickActionCard
          icon={<Zap size={20} className="text-curiosity" />}
          title="Today's Challenge"
          description="1 headline — spot the trick"
          onClick={() => navigate('/mindgames/quiz')}
          highlight
        />
        <QuickActionCard
          icon={<Activity size={20} className="text-outrage" />}
          title="Reading Mood"
          description="How sharp is your guard today?"
          onClick={() => setStressDiagOpen(true)}
        />
        <QuickActionCard
          icon={<Target size={20} className="text-curiosity" />}
          title="Spot It"
          description="Can you catch the manipulation?"
          onClick={() => navigate('/mindgames/training')}
        />
        <QuickActionCard
          icon={<Search size={20} className="text-observation" />}
          title="Dissect an Article"
          description="Pull apart a piece of writing"
          onClick={() => navigate('/mindgames/analysis')}
        />
        <QuickActionCard
          icon={<Microscope size={20} className="text-masthead" />}
          title="Think Harder"
          description="Debate yourself and find common ground"
          onClick={() => navigate('/mindgames/reflection')}
        />
      </div>

      {/* Stats or Onboarding */}
      {isNewUser ? (
        <div className="rounded-xl border border-rule bg-paper-dark p-6 md:p-8 text-center space-y-4">
          <p className="text-lg md:text-xl font-serif font-bold text-ink">
            Welcome to MindGames
          </p>
          <p className="text-sm md:text-base text-ink-muted max-w-lg mx-auto leading-relaxed">
            Practice spotting manipulation, analyze news critically, and track how your
            thinking evolves over time. Pick a starting point:
          </p>
          <div className="flex flex-wrap justify-center gap-3 pt-3">
            <button
              onClick={() => navigate('/mindgames/quiz')}
              className="px-5 py-2.5 text-sm font-semibold rounded-lg bg-ink text-paper hover:bg-ink/90 transition-colors cursor-pointer"
            >
              Take today's challenge
            </button>
            <button
              onClick={() => setStressDiagOpen(true)}
              className="px-5 py-2.5 text-sm font-semibold rounded-lg border border-rule text-ink hover:bg-paper transition-colors cursor-pointer"
            >
              Check your reading mood
            </button>
            <button
              onClick={() => navigate('/mindgames/training')}
              className="px-5 py-2.5 text-sm font-semibold rounded-lg border border-rule text-ink hover:bg-paper transition-colors cursor-pointer"
            >
              Start training
            </button>
          </div>
        </div>
      ) : (
        <div className="border-t border-rule pt-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[12px] uppercase tracking-wider text-ink-muted font-semibold">Your Progress</h3>
            <div className="flex items-center gap-1">
              <button
                onClick={handleReset}
                className="p-1.5 rounded hover:bg-paper-dark transition-colors cursor-pointer text-ink-muted hover:text-outrage"
                aria-label="Clear all progress"
              >
                <Trash2 size={13} />
              </button>
              <button
                onClick={loadStats}
                className="p-1.5 rounded hover:bg-paper-dark transition-colors cursor-pointer text-ink-muted hover:text-ink"
                aria-label="Refresh statistics"
              >
                <RotateCcw size={13} />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard
              icon={<Search size={16} className="text-observation" />}
              label="Articles dissected"
              value={stats?.forensicCount ?? 0}
              sub={stats?.avgBiasScore ? `Avg bias: ${stats.avgBiasScore}/10` : undefined}
            />
            <StatCard
              icon={<Shield size={16} className="text-outrage" />}
              label="Training rounds"
              value={stats?.inoculationSessions ?? 0}
              sub={stats?.bestLevel ? `Reached: ${stats.bestLevel} level` : undefined}
            />
            <StatCard
              icon={<Microscope size={16} className="text-curiosity" />}
              label="Beliefs challenged"
              value={stats?.journalEntries ?? 0}
              sub={stats?.avgShift ? `Avg mind-shift: ${stats.avgShift}%` : undefined}
            />
            <StatCard
              icon={<Brain size={16} className="text-masthead" />}
              label="Echo chamber checks"
              value={stats?.auditCount ?? 0}
              sub={stats?.avgSiloScore ? `Echo score: ${stats.avgSiloScore}/10` : undefined}
            />
          </div>
        </div>
      )}

      {/* Research Credits */}
      <div className="border-t border-rule pt-6">
        <p className="text-[11px] text-ink-muted text-center">
          Based on research by Van der Linden, Grimes, Ariely, Adam Grant, and Monica Guzman
        </p>
      </div>

      <StressDiagnostic open={stressDiagOpen} onOpenChange={setStressDiagOpen} />
    </div>
  );
}

function QuickActionCard({ icon, title, description, onClick, highlight }: {
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
  highlight?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`p-4 md:p-5 rounded-xl border-2 bg-paper-dark hover:bg-paper hover:shadow-sm transition-all cursor-pointer text-left group ${
        highlight ? 'border-curiosity/50' : 'border-rule'
      }`}
    >
      <div className="mb-2.5">{icon}</div>
      <h4 className="text-sm font-serif font-bold text-ink group-hover:text-masthead transition-colors">{title}</h4>
      <p className="text-sm text-ink-muted mt-1 leading-relaxed">{description}</p>
    </button>
  );
}

function StatCard({ icon, label, value, sub }: {
  icon: React.ReactNode;
  label: string;
  value: number;
  sub?: string;
}) {
  return (
    <div className="p-4 md:p-5 rounded-xl border border-rule bg-paper-dark">
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-xs uppercase tracking-wide text-ink-muted font-semibold">{label}</span>
      </div>
      <p className="text-3xl font-bold text-ink">{value}</p>
      {sub && <p className="text-xs text-ink-muted mt-1.5">{sub}</p>}
    </div>
  );
}
