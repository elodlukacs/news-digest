const express = require('express');
const db = require('../db');
const { callLLM } = require('../lib/llm');
const { getPrompt } = require('../lib/promptManager');
const { parseJSON } = require('../lib/parseJSON');

const router = express.Router();

// POST /api/cognitive/disinfo-map — get disinfo influencer map data
router.post('/disinfo-map', async (req, res) => {
  const { gatewayFocus, conspiracyFocus, userId } = req.body;

  try {
    const disinfoPrompt = getPrompt('disinfo-map');

    const result = await callLLM(
      [
        { role: 'system', content: disinfoPrompt.user_prompt },
        { role: 'user', content: `Analyze current patterns of health/wellness misinformation gateways and their connections to conspiracy funnels.${gatewayFocus ? `\nFocus areas: ${gatewayFocus}` : ''}${conspiracyFocus ? `\nConspiracy themes to examine: ${conspiracyFocus}` : ''}` }
      ],
      { purpose: 'disinfo_map', temperature: 0.5, response_format: { type: 'json_object' }, db }
    );

    const parsed = parseJSON(result.content);

    const response = {
      gatewayTopics: parsed.gatewayTopics || [],
      bridgeFigures: parsed.bridgeFigures || [],
      conspiracyCores: parsed.conspiracyCores || [],
      pathways: parsed.pathways || [],
      warningBanners: parsed.warningBanners || [],
      provider: result.provider,
      generatedAt: new Date().toISOString(),
    };

    res.json(response);
  } catch (err) {
    console.error('Disinfo map error:', err);
    res.status(500).json({ error: err.message || 'Failed to generate disinfo map' });
  }
});

// GET /api/cognitive/disinfo-map — get static disinfo map data (cached/fallback)
router.get('/disinfo-map', (req, res) => {
  const cached = db.prepare('SELECT * FROM disinfo_maps ORDER BY created_at DESC LIMIT 1').get();
  
  if (cached) {
    try {
      return res.json(JSON.parse(cached.map_data));
    } catch {
      return res.json(cached.map_data);
    }
  }
  
  res.json({
    gatewayTopics: [
      { id: 'antivax', name: 'Anti-Vaccine', description: 'Vaccine hesitancy and disease conspiracy', examples: ['VAXXED', 'Robert F. Kennedy Jr.'], leakageRisk: 'high', commonClaims: ['DNA modification', 'Microchips', 'Population control'] },
      { id: 'wellness', name: 'Wellness/Natural Health', description: 'Alternative health beyond mainstream medicine', examples: ['Raw water', 'Detox myths', 'Essential oils'], leakageRisk: 'medium', commonClaims: ['Big Pharma conspiracy', 'Doctors are corrupt', 'Natural = safe'] },
      { id: 'covid', name: 'COVID Skepticism', description: 'Pandemic denial and treatment misinformation', examples: ['Ivermectin', 'Lab leak theory'], leakageRisk: 'high', commonClaims: ['Plandemic', '5G corona', 'New World Order'] },
      { id: 'detox', name: 'Detox/Cleanse', description: 'Body cleansing misinformation', examples: ['Juice cleanses', 'Parasite cleanses'], leakageRisk: 'low', commonClaims: ['Toxic buildup', 'Colon cleansing'] },
      { id: 'nutritionism', name: 'Nutritionism', description: 'Oversimplified nutrition beliefs', examples: ['Superfoods', 'Sugar addiction'], leakageRisk: 'low', commonClaims: ['Food pyramid lies', 'Supplements needed'] },
    ],
    bridgeFigures: [
      { id: 'rfk', name: 'Robert F. Kennedy Jr.', type: 'celebrity', followers: 'Millions', transitionPattern: 'Environmental lawyer to anti-vaccine activist', gatewayTopics: ['antivax', 'wellness'], targetConspiracies: ['NWO', 'Plandemic'], leakageLevel: 'high' },
      { id: 'mika', name: 'Mikhael (Wellness Mama)', type: 'influencer', followers: '1M+', transitionPattern: 'Natural parenting to political conspiracy', gatewayTopics: ['wellness', 'detox'], targetConspiracies: ['Globalist agenda', 'Population control'], leakageLevel: 'medium' },
      { id: 'bland', name: 'Dr. Robert Young', type: 'doctor', followers: 'Hundreds of thousands', transitionPattern: 'pH miracle to anti-vaccine', gatewayTopics: ['wellness', 'detox'], targetConspiracies: ['Medical mafia', 'Chemtrails'], leakageLevel: 'high' },
      { id: 'mercola', name: 'Dr. Joseph Mercola', type: 'doctor', followers: 'Millions', transitionPattern: 'Natural health to political activism', gatewayTopics: ['antivax', 'wellness', 'nutritionism'], targetConspiracies: ['Big Pharma takeover', 'FDA corruption'], leakageLevel: 'high' },
    ],
    conspiracyCores: [
      { id: 'qanon', name: 'QAnon', description: 'Anonymous government insider conspiracy', coreNarratives: ['Pizzagate', 'Cabinet shutdown', 'Deep state'], connectedGateways: ['antivax', 'covid'], radicalizationPotential: 'high' },
      { id: 'nwogroups', name: 'New World Order', description: 'Global elite conspiracy theory', coreNarratives: ['Illuminati', 'Bilderberg', 'Population control'], connectedGateways: ['antivax', 'wellness'], radicalizationPotential: 'high' },
      { id: 'plandemic', name: 'Plandemic', description: 'Deliberate pandemic conspiracy', coreNarratives: ['Bioweapon', 'Vaccine depopulation', 'Medical tyranny'], connectedGateways: ['antivax', 'covid'], radicalizationPotential: 'high' },
    ],
    pathways: [
      { from: 'antivax', to: 'rfk', mechanism: 'Celebrity amplification of medical conspiracy', warningSigns: ['Focus on freedom/rights', 'Us vs them framing'], leakagePoint: 'Anti-vaccine parents become political activists' },
      { from: 'wellness', to: 'bland', mechanism: 'Credibility bridge through alternative medicine', warningSigns: ['Charismatic authority', 'Expensive protocols'], leakagePoint: 'Health concerns expand to government conspiracy' },
      { from: 'covid', to: 'qanon', mechanism: 'Pandemic panic into political narrative', warningSigns: ['Tracking Bill Gates', '5G connections'], leakagePoint: 'COVID fear becomes election fraud belief' },
      { from: 'rfk', to: 'qanon', mechanism: 'Anti-establishment sentiment', warningSigns: ['Anti-Democratic', 'Pro-Trump'], leakagePoint: 'Kennedy support leads to broader conspiracy' },
    ],
    warningBanners: [
      { type: 'gateway', title: 'Wellness Gateway Pattern', message: 'Health anxieties often start innocently but can escalate when combined with distrust of institutions' },
      { type: 'bridge', title: 'The Influence Trap', message: 'Bridge figures often have genuine credentials that get weaponized to lend credibility to fringe ideas' },
      { type: 'conspiracy', title: 'Radicalization Sign', message: 'Watch for shifts from "something is wrong with vaccines" to "vaccines are deliberate population control"' },
    ],
    generatedAt: new Date().toISOString(),
  });
});

module.exports = router;