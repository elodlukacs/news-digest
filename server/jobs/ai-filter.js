const BATCH_SIZE = 100;

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

    const prompt = `You are a job relevance classifier. Given this list of job postings, return ONLY the jobs relevant for a Senior Frontend Developer (JavaScript, TypeScript, React, Vue, Angular, Next.js, CSS, HTML, Web).

Include: senior/lead/staff/principal frontend, UI, or web developer roles.
Exclude: backend-only, DevOps, mobile-native-only, data, ML, design-only, or unrelated roles.

For each matching job, also assess whether it is remote-friendly:
- "yes" = explicitly remote or the source/description strongly implies remote work
- "possible" = not clear, could be remote or hybrid
- "no" = clearly on-site or office-only

Return a JSON array of objects with "id" and "remote" fields, nothing else.
Example: [{"id":"abc","remote":"yes"},{"id":"def","remote":"possible"}]
If none match, return: []

Jobs:
${JSON.stringify(jobSummaries)}`;

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
        allResults.push(...results.map(r => ({
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
