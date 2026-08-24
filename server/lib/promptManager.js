const db = require('../db');

const stmts = {
  getBySlug: db.prepare('SELECT * FROM prompts WHERE slug = ?'),
  getAll: db.prepare('SELECT * FROM prompts ORDER BY category, name'),
  update: db.prepare("UPDATE prompts SET name = ?, description = ?, system_message = ?, user_prompt = ?, updated_at = datetime('now') WHERE slug = ?"),
};

function getPrompt(slug) {
  const row = stmts.getBySlug.get(slug);
  if (!row) {
    throw new Error(`Prompt not found: ${slug}`);
  }
  return row;
}

function getAllPrompts() {
  return stmts.getAll.all();
}

function updatePrompt(slug, { name, description, system_message, user_prompt }) {
  const existing = stmts.getBySlug.get(slug);
  if (!existing) {
    throw new Error(`Prompt not found: ${slug}`);
  }
  stmts.update.run(
    name ?? existing.name,
    description ?? existing.description,
    system_message ?? existing.system_message,
    user_prompt ?? existing.user_prompt,
    slug
  );
  return stmts.getBySlug.get(slug);
}

function renderPrompt(template, variables) {
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    // Function form, not a string: a string replacement expands $&, $`, $', $1
    // inside the value, so article text or a chat message containing those
    // sequences silently rewrote the prompt.
    result = result.replaceAll(`{{${key}}}`, () => value ?? '');
  }
  return result;
}

function buildMessages(slug, variables, extraSystemContent) {
  const prompt = getPrompt(slug);
  const renderedUser = renderPrompt(prompt.user_prompt, variables);
  const messages = [];

  const sysContent = [prompt.system_message, extraSystemContent].filter(Boolean).join('\n');
  if (sysContent) {
    messages.push({ role: 'system', content: sysContent });
  }

  messages.push({ role: 'user', content: renderedUser });
  return messages;
}

module.exports = { getPrompt, getAllPrompts, updatePrompt, renderPrompt, buildMessages };
