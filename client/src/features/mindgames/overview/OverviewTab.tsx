import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Brain, Search, Shield, Microscope, RotateCcw, Trash2, Activity, Target, Heart } from 'lucide-react';
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
      const [forensic, sessions, journal, audits] = await Promise.all([
        fetch(`${API_BASE}/forensics/history?limit=100`).then(r => r.json()).catch(() => []),
        fetch(`${API_BASE}/inoculation/sessions`).then(r => r.json()).catch(() => []),
        fetch(`${API_BASE}/scientist/journal`).then(r => r.json()).catch(() => []),
        fetch(`${API_BASE}/bridge/audits`).then(r => r.json()).catch(() => []),
      ]);

      const levels = ['trolling', 'emotional', 'amplification', 'escalation'];
      const bestLevelIdx = sessions.reduce((best: number, s: { level: string }) => Math.max(best, levels.indexOf(s.level)), 0);

      setStats({
        forensicCount: forensic.length,
        avgBiasScore: forensic.length > 0 ? Math.round((forensic.reduce((s: number, f: { bias_score: number }) => s + (f.bias_score || 0), 0) / forensic.length) * 10) / 10 : 0,
        inoculationSessions: sessions.length,
        bestLevel: levels[bestLevelIdx] || 'trolling',
        journalEntries: journal.length,
        avgShift: journal.length > 0
          ? Math.round(journal.reduce((s: number, j: { initial_confidence: number; final_confidence: number }) => s + Math.abs(j.final_confidence - j.initial_confidence), 0) / journal.length)
          : 0,
        auditCount: audits.length,
        avgSiloScore: audits.length > 0 ? Math.round((audits.reduce((s: number, a: { siloing_score: number }) => s + (a.siloing_score || 0), 0) / audits.length) * 10) / 10 : 0,
      });
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { loadStats(); }, [loadStats]);

  const handleReset = async () => {
    if (!window.confirm('Clear all cognitive training progress? This will delete all forensic analyses, inoculation sessions, debate journals, and bridge audits. This cannot be undone.')) return;
    try {
      await fetch(`${API_BASE}/progress/reset`, { method: 'DELETE' });
      setStats(null);
      loadStats();
    } catch { /* ignore */ }
  };

  return (
    <div className="space-y-6 mt-3">
      <TabHeader
        icon={<Brain size={24} className="text-masthead md:!w-7 md:!h-7" />}
        title="Your Mental Antibody Journey"
        description="Build psychological defenses against misinformation through interactive training, analysis, and reflection exercises."
      />

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <QuickActionCard
          icon={<Activity size={20} className="text-outrage" />}
          title="Stress Check"
          description="Evaluate your cognitive state before reading"
          onClick={() => setStressDiagOpen(true)}
        />
        <QuickActionCard
          icon={<Target size={20} className="text-curiosity" />}
          title="Start Training"
          description="Build mental antibodies"
          onClick={() => navigate('/mindgames/training')}
        />
        <QuickActionCard
          icon={<Search size={20} className="text-observation" />}
          title="Analyze Content"
          description="Deconstruct news and studies"
          onClick={() => navigate('/mindgames/analysis')}
        />
        <QuickActionCard
          icon={<Microscope size={20} className="text-masthead" />}
          title="Reflect"
          description="Examine your beliefs"
          onClick={() => navigate('/mindgames/reflection')}
        />
      </div>

      {/* Stats */}
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
            label="Analyses"
            value={stats?.forensicCount ?? 0}
            sub={stats?.avgBiasScore ? `Avg bias: ${stats.avgBiasScore}/10` : undefined}
          />
          <StatCard
            icon={<Shield size={16} className="text-outrage" />}
            label="Inoculations"
            value={stats?.inoculationSessions ?? 0}
            sub={stats?.bestLevel ? `Best: ${stats.bestLevel}` : undefined}
          />
          <StatCard
            icon={<Microscope size={16} className="text-curiosity" />}
            label="Debates"
            value={stats?.journalEntries ?? 0}
            sub={stats?.avgShift ? `Avg shift: ${stats.avgShift}%` : undefined}
          />
          <StatCard
            icon={<Heart size={16} className="text-masthead" />}
            label="Audits"
            value={stats?.auditCount ?? 0}
            sub={stats?.avgSiloScore ? `Avg silo: ${stats.avgSiloScore}/10` : undefined}
          />
        </div>
      </div>

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

function QuickActionCard({ icon, title, description, onClick }: {
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="p-3 md:p-4 rounded-lg border border-rule bg-paper-dark hover:bg-paper transition-all cursor-pointer text-left group"
    >
      <div className="mb-2">{icon}</div>
      <h4 className="text-[13px] font-serif font-bold text-ink group-hover:text-[color-masthead] transition-colors">{title}</h4>
      <p className="text-[13px] text-ink-muted mt-0.5">{description}</p>
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
    <div className="p-3 md:p-4 rounded-lg border border-rule bg-paper-dark">
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-[11px] uppercase tracking-wider text-ink-muted font-semibold">{label}</span>
      </div>
      <p className="text-2xl font-bold text-ink">{value}</p>
      {sub && <p className="text-[10px] text-ink-muted mt-1">{sub}</p>}
    </div>
  );
}
