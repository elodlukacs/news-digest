const express = require('express');
const router = express.Router();

const PROMPTS = {
  'Bias Detection': [
    {
      id: 'bias-1',
      prompt: 'What are the unstated assumptions in this article?',
      whenToUse: 'When you want to identify hidden premises or beliefs that the author takes for granted without stating explicitly.',
      exampleInput: 'The article claims "Young people are lazy and don\'t want to work." What assumptions underlie this statement?',
    },
    {
      id: 'bias-2',
      prompt: 'What viewpoint is this article not presenting?',
      whenToUse: 'When you want to ensure you\'re getting a balanced perspective and identify potential blind spots.',
      exampleInput: 'An article about climate policy only interviews fossil fuel executives. What perspectives are missing?',
    },
    {
      id: 'bias-3',
      prompt: 'What emotions is this headline trying to provoke, and why might that matter?',
      whenToUse: 'When you notice a headline that seems designed to make you feel angry, afraid, or outraged.',
      exampleInput: 'Headline: "Politician caught in SCANDAL — you won\'t believe what happened next!" What emotional response is this designed to trigger?',
    },
    {
      id: 'bias-4',
      prompt: 'Who benefits from this narrative being believed?',
      whenToUse: 'When you want to trace potential conflicts of interest or ulterior motives behind information.',
      exampleInput: 'A pharmaceutical company funds a study claiming their drug is the most effective. Who benefits if people believe this?',
    },
    {
      id: 'bias-5',
      prompt: 'What facts were left out that might change the interpretation?',
      whenToUse: 'When you sense a story is one-sided or incomplete.',
      exampleInput: 'An article reports crime statistics up 20%. What context might be missing (seasonal trends, reporting changes, population growth)?',
    },
    {
      id: 'bias-6',
      prompt: 'How would this story be framed differently by someone with opposing political views?',
      whenToUse: 'When you want to stress-test your own filters and recognize partisan framing.',
      exampleInput: 'Rewrite a story about a new environmental regulation from a conservative business perspective.',
    },
  ],
  'Perspective Taking': [
    {
      id: 'perspective-1',
      prompt: 'How would a [conservative/liberal/expert/skeptic] read this differently?',
      whenToUse: 'When you want to understand how different worldviews shape interpretation of the same facts.',
      exampleInput: 'How would a conservative read an article about universal healthcare? What would stand out to them?',
    },
    {
      id: 'perspective-2',
      prompt: 'What would need to be true for this claim to be wrong?',
      whenToUse: 'When you catch yourself agreeing with something and want to avoid confirmation bias.',
      exampleInput: 'The claim is "Electric vehicles are better for the environment." What evidence would falsify this?',
    },
    {
      id: 'perspective-3',
      prompt: 'What information would change your mind about this?',
      whenToUse: 'When you realize you\'ve already made up your mind and want to stay intellectually humble.',
      exampleInput: 'What specific evidence would make you vote differently in the next election?',
    },
    {
      id: 'perspective-4',
      prompt: 'If the opposite were true, what would have to be different?',
      whenToUse: 'When you want to test whether your reasoning would work both ways.',
      exampleInput: 'If this news story turned out to be completely false, what would that say about how we consume information?',
    },
    {
      id: 'perspective-5',
      prompt: 'What would this look like if I had the opposite priors?',
      whenToUse: 'When you want to catch yourself in motivated reasoning.',
      exampleInput: 'You\'re skeptical of a claim that aligns with your beliefs. What if you started skeptical of it instead?',
    },
  ],
  'Fallacy Search': [
    {
      id: 'fallacy-1',
      prompt: 'Identify any logical fallacies in this argument.',
      whenToUse: 'When you want a systematic check for common reasoning errors.',
      exampleInput: '"Everyone is doing X, so X must be right." What fallacy is present?',
    },
    {
      id: 'fallacy-2',
      prompt: 'Is this source using appeal to authority appropriately?',
      whenToUse: 'When an authority figure (expert, celebrity, official) is cited as proof.',
      exampleInput: 'A famous actor endorses a political candidate. Is this a valid reason to support them?',
    },
    {
      id: 'fallacy-3',
      prompt: 'What\'s the strongest counterargument to this position?',
      whenToUse: 'When you want to steelman an opposing view before critiquing it.',
      exampleInput: 'What\'s the most compelling argument against raising the minimum wage?',
    },
    {
      id: 'fallacy-4',
      prompt: 'Is this a false dichotomy or a false dilemma?',
      whenToUse: 'When you notice the argument presents only two options when more exist.',
      exampleInput: '"You\'re either with us or against us." What\'s wrong with this framing?',
    },
    {
      id: 'fallacy-5',
      prompt: 'Is correlation being confused with causation?',
      whenToUse: 'When a relationship between two things is presented as one causing the other.',
      exampleInput: 'Ice cream sales and drowning deaths both increase in summer. Does ice cream cause drowning?',
    },
    {
      id: 'fallacy-6',
      prompt: 'What ad hominem attack is being made, if any?',
      whenToUse: 'When the argument targets the person rather than their reasoning.',
      exampleInput: 'A politician\'s policy is criticized based on their personal life rather than the policy itself.',
    },
  ],
  'Steelmanning': [
    {
      id: 'steel-1',
      prompt: 'State the strongest version of the opposing view.',
      whenToUse: 'Before critiquing any position, to ensure you\'re addressing the best argument, not a strawman.',
      exampleInput: 'What is the most compelling argument for limiting free speech on social media platforms?',
    },
    {
      id: 'steel-2',
      prompt: 'What evidence would support the other side?',
      whenToUse: 'When you want to avoid motivated reasoning and genuinely understand opposing viewpoints.',
      exampleInput: 'What evidence would support the claim that stricter gun laws reduce violent crime?',
    },
    {
      id: 'steel-3',
      prompt: 'What do people who hold this view have in common with me?',
      whenToUse: 'When you want to find common ground and avoid othering.',
      exampleInput: 'Both pro-choice and pro-life advocates share what core values?',
    },
    {
      id: 'steel-4',
      prompt: 'If this person were acting in good faith, what might explain their view?',
      whenToUse: 'When you catch yourself attributing malice where incompetence or different values might be the explanation.',
      exampleInput: 'A family member shares what you consider "fake news." What\'s a charitable interpretation of their information diet?',
    },
    {
      id: 'steel-5',
      prompt: 'What would this view sound like in its most reasonable proponents\' own words?',
      whenToUse: 'When you realize you\'ve only encountered a caricature of a position.',
      exampleInput: 'How would a thoughtful conservative describe their own position on climate change, not the strawman version?',
    },
  ],
  'Source Evaluation': [
    {
      id: 'source-1',
      prompt: 'What is this source\'s track record on factual reporting?',
      whenToUse: 'Before sharing or acting on information from an unfamiliar outlet.',
      exampleInput: 'A website claims to be "news" but has no bylines. How would you evaluate its credibility?',
    },
    {
      id: 'source-2',
      prompt: 'What funding sources or conflicts of interest might affect this coverage?',
      whenToUse: 'When you want to identify potential financial or ideological influences.',
      exampleInput: 'A think tank publishes a report about industry deregulation. What funding sources might create bias?',
    },
    {
      id: 'source-3',
      prompt: 'Has this source corrected errors in the past? How?',
      whenToUse: 'When you want to assess whether a source is willing to admit mistakes.',
      exampleInput: 'You find a news article with questionable claims. How would you check if the outlet issues corrections?',
    },
    {
      id: 'source-4',
      prompt: 'Does this source present primary evidence or rely on secondary reporting?',
      whenToUse: 'When you want to assess how close to the original information you are.',
      exampleInput: 'A viral tweet quotes "a source." How much more credible would this be with direct attribution?',
    },
    {
      id: 'source-5',
      prompt: 'What bias might this source\'s typical audience have?',
      whenToUse: 'When you want to understand how a source might tailor its framing to its audience.',
      exampleInput: 'A cable news network\'s evening show — what assumptions does it make about its viewers\' political leanings?',
    },
    {
      id: 'source-6',
      prompt: 'Are there other outlets covering this differently? Why might that be?',
      whenToUse: 'When you notice a story isn\'t being covered elsewhere or is being framed very differently.',
      exampleInput: 'A major story appears only on one outlet. What might that tell you about its significance or reliability?',
    },
  ],
};

router.get('/', (req, res) => {
  const categories = Object.keys(PROMPTS).map((name) => ({
    name,
    prompts: PROMPTS[name],
  }));
  res.json(categories);
});

router.post('/custom', (req, res) => {
  const { category, prompt, whenToUse, exampleInput } = req.body;
  if (!prompt || !prompt.trim()) {
    return res.status(400).json({ error: 'Prompt text is required' });
  }
  res.status(201).json({
    id: `custom-${Date.now()}`,
    prompt: prompt.trim(),
    whenToUse: whenToUse?.trim() || '',
    exampleInput: exampleInput?.trim() || '',
    category: category || 'Custom',
    isCustom: true,
  });
});

module.exports = router;
