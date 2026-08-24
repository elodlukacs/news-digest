const { getPrompt, renderPrompt } = require('../lib/promptManager');
const { JOB_PROFILE } = require('./profile');

const BATCH_SIZE = 100;

function buildPromptVariables(jobs) {
  return {
    jobs: JSON.stringify(jobs),
    role: JOB_PROFILE.role,
    stack: JOB_PROFILE.stack.join(', '),
    seniority: JOB_PROFILE.seniorityLevels.join('/'),
    excludes: JOB_PROFILE.excludeKeywords.join(', '),
    region: JOB_PROFILE.region,
  };
}

async function filterJobsWithAI(jobs, callLLM, providerId) {
  const allResults = [];

  for (let i = 0; i < jobs.length; i += BATCH_SIZE) {
    const batch = jobs.slice(i, i + BATCH_SIZE);
    const jobSummaries = batch.map(j => ({
      id: j.id,
      title: j.title,
      company: j.company,
      source: j.source,
      country: j.country,
      workType: j.workType,
    }));

    const jobFilterPrompt = getPrompt('job-filter');
    const prompt = renderPrompt(jobFilterPrompt.user_prompt, buildPromptVariables(jobSummaries));

    try {
      const response = await callLLM(
        [{ role: 'user', content: prompt }],
        { purpose: 'job-filter', temperature: 0.1, providerId }
      );

      const text = response.content;
      let cleaned = text.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?\s*```\s*$/i, '').trim();

      let results = null;
      try {
        results = JSON.parse(cleaned);
      } catch {
        // Try to find JSON array in the response
        const jsonMatch = cleaned.match(/(\[[\s\S]*\])/);
        if (jsonMatch) {
          try {
            results = JSON.parse(jsonMatch[1]);
          } catch {}
        }
        if (!results) {
          // Try stripping any leading non-JSON text
          const stripMatch = cleaned.match(/(\[.*\])$/s);
          if (stripMatch) {
            try {
              results = JSON.parse(stripMatch[1]);
            } catch {}
          }
        }
      }

      if (Array.isArray(results)) {
        // Only accept IDs that were actually in the batch. The model
        // occasionally invents them, and `ai_filtered_jobs` has no foreign key,
        // so hallucinated rows persisted and inflated the AI-filtered count
        // while the aiOnly INNER JOIN silently dropped them again.
        const batchIds = new Set(batch.map(j => j.id));
        const accepted = results.filter(r => batchIds.has(r.id));
        const rejected = results.length - accepted.length;
        if (rejected > 0) {
          console.warn(`Batch ${Math.floor(i / BATCH_SIZE) + 1}: discarded ${rejected} result(s) with unknown job IDs`);
        }
        allResults.push(...accepted.map(r => ({
          id: r.id,
          remote: ['yes', 'no', 'possible'].includes(r.remote) ? r.remote : 'possible',
        })));
      } else {
        console.warn(`Batch ${Math.floor(i / BATCH_SIZE) + 1}: Could not parse response as JSON. Content preview: ${text.slice(0, 200)}`);
      }
    } catch (error) {
      console.error(`Failed to parse AI response for batch ${Math.floor(i / BATCH_SIZE) + 1}:`, error.message);
    }
  }

  return allResults;
}

module.exports = { filterJobsWithAI };
