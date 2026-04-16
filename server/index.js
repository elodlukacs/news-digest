require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Routers
app.use('/api/categories', require('./routes/categories'));
app.use('/api/categories', require('./routes/feeds'));
app.use('/api/categories', require('./routes/summaries'));
app.use('/api/feeds', require('./routes/feedDelete'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/discover-feed', require('./routes/discovery'));
app.use('/api/briefing', require('./routes/briefing'));
app.use('/api/chat', require('./routes/chat'));
app.use('/api/tags', require('./routes/tags'));
app.use('/api/stats', require('./routes/stats'));
app.use('/api/models', require('./routes/models'));
app.use('/api/widgets', require('./routes/widgets'));
app.use('/api/homepage', require('./routes/homepage'));
app.use('/api/homepage/surprise', require('./routes/surprise'));
app.use('/api/jobs', require('./routes/jobs'));
app.use('/api/bias-radar/decode', require('./routes/bias-radar/decode'));
app.use('/api/bias-radar/related', require('./routes/bias-radar/related'));
app.use('/api/bias-radar/daily-quiz', require('./routes/bias-radar/daily-quiz'));
app.use('/api/bias-radar/steelman', require('./routes/bias-radar/steelman'));
app.use('/api/bias-radar/rabbit-hole', require('./routes/bias-radar/rabbit-hole'));
app.use('/api/bias-radar/missing-story', require('./routes/bias-radar/missing-story'));
app.use('/api/forensics', require('./routes/forensics'));
app.use('/api/inoculation', require('./routes/inoculation'));
app.use('/api/scientist', require('./routes/scientist'));
app.use('/api/bridge', require('./routes/bridge'));
app.use('/api/cognitive', require('./routes/narrative'));
app.use('/api/cognitive/prompts', require('./routes/prompts'));
app.use('/api/prompts', require('./routes/prompts-manager'));
app.use('/api/cognitive', require('./routes/disinfo'));
app.use('/api/compare', require('./routes/compare'));
app.use('/api/spectrum', require('./routes/spectrum'));
app.use('/api/progress', require('./routes/cognitive'));
app.use('/api/gamification', require('./routes/gamification'));
app.use('/api/fallacy-dojo', require('./routes/fallacy-dojo'));
app.use('/api/conspiracy-anatomy', require('./routes/conspiracy-anatomy'));
app.use('/api/bias-mirror', require('./routes/bias-mirror'));
app.use('/api/source-lab', require('./routes/source-lab'));
app.use('/api/propaganda-timeline', require('./routes/propaganda-timeline'));
app.use('/api/manipulator', require('./routes/manipulator'));
app.use('/api/logs', require('./routes/logs'));

app.listen(PORT, () => {
  console.log(`News Reader API running on http://localhost:${PORT}`);
});
