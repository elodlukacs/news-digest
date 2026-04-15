import { useLogs } from '../../hooks/useLogs';

function LogsRoute() {
  const { logs, loading, error, refetch } = useLogs(3);

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8 font-widget">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-zinc-200 dark:bg-zinc-700 rounded w-32" />
          <div className="h-96 bg-zinc-200 dark:bg-zinc-700 rounded" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded">
          Error: {error}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 font-widget">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-serif text-ink dark:text-paper">LLM Usage Logs</h1>
        <button
          onClick={refetch}
          className="px-4 py-2 bg-paper dark:bg-ink text-ink dark:text-paper border border-ink dark:border-paper rounded hover:bg-parchment dark:hover:bg-zinc-800 transition-colors"
        >
          Refresh
        </button>
      </div>

      <div className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
        Showing {logs.length} log entries (last 3 days)
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-zinc-300 dark:border-zinc-600">
              <th className="text-left py-3 px-2 font-semibold text-ink dark:text-paper">Time</th>
              <th className="text-left py-3 px-2 font-semibold text-ink dark:text-paper">Purpose</th>
              <th className="text-left py-3 px-2 font-semibold text-ink dark:text-paper">Provider</th>
              <th className="text-left py-3 px-2 font-semibold text-ink dark:text-paper">Model</th>
              <th className="text-right py-3 px-2 font-semibold text-ink dark:text-paper">Prompt</th>
              <th className="text-right py-3 px-2 font-semibold text-ink dark:text-paper">Completion</th>
              <th className="text-right py-3 px-2 font-semibold text-ink dark:text-paper">Total</th>
              <th className="text-right py-3 px-2 font-semibold text-ink dark:text-paper">Latency</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr
                key={log.id}
                className="border-b border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
              >
                <td className="py-2 px-2 text-zinc-600 dark:text-zinc-300 font-mono text-xs">
                  {log.created_at.replace('T', ' ').slice(0, 19)}
                </td>
                <td className="py-2 px-2 text-ink dark:text-paper">{log.purpose}</td>
                <td className="py-2 px-2 text-zinc-600 dark:text-zinc-300">{log.provider}</td>
                <td className="py-2 px-2 text-zinc-600 dark:text-zinc-300 font-mono text-xs">
                  {log.model}
                </td>
                <td className="py-2 px-2 text-right text-zinc-600 dark:text-zinc-300">
                  {log.prompt_tokens.toLocaleString()}
                </td>
                <td className="py-2 px-2 text-right text-zinc-600 dark:text-zinc-300">
                  {log.completion_tokens.toLocaleString()}
                </td>
                <td className="py-2 px-2 text-right text-ink dark:text-paper font-medium">
                  {log.total_tokens.toLocaleString()}
                </td>
                <td className="py-2 px-2 text-right text-zinc-600 dark:text-zinc-300">
                  {log.latency_ms}ms
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {logs.length === 0 && (
        <div className="text-center py-12 text-zinc-500 dark:text-zinc-400">
          No logs found in the last 3 days.
        </div>
      )}
    </div>
  );
}

export { LogsRoute };