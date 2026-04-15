import { useEffect, useState } from 'react';
import { API_BASE } from '../../config';

interface LogEntry {
  id: number;
  provider: string;
  model: string;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  purpose: string;
  category_id: number | null;
  latency_ms: number;
  created_at: string;
}

function LogsRoute() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState('3');

  const fetchLogs = async () => {
    try {
      const res = await fetch(`${API_BASE}/logs?days=${days}`);
      const data = await res.json();
      setLogs(data);
    } catch {
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === 'r') {
        setLoading(true);
        fetchLogs();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [days]);

  if (loading) {
    return (
      <div className="min-h-screen bg-black p-4">
        <pre className="text-green-500 font-mono text-sm">Loading...</pre>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black p-4">
      <div className="text-green-500 font-mono text-sm mb-2">
       days:{' '}
        <input
          type="text"
          value={days}
          onChange={(e) => setDays(e.target.value)}
          className="bg-black text-green-500 border-none w-12 font-mono text-sm"
        />
      </div>
      {logs.map((log) => (
        <pre key={log.id} className="text-green-500 font-mono text-sm leading-tight">
          {log.created_at} |{' '}
          {(log.purpose + '').padEnd(20)} |{' '}
          {(log.provider + '').padEnd(12)} |{' '}
          {(log.model + '').slice(0, 20).padEnd(20)} |{' '}
          {String(log.prompt_tokens).padStart(5)} +{' '}
          {String(log.completion_tokens).padStart(5)} ={' '}
          {String(log.total_tokens).padStart(5)} |{' '}
          {log.latency_ms}ms
        </pre>
      ))}
      <pre className="text-green-500 font-mono text-sm mt-4">Press Enter or R to refresh</pre>
    </div>
  );
}

export { LogsRoute };