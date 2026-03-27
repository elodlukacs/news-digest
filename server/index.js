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
app.use('/api/stats', require('./routes/stats'));
app.use('/api/widgets', require('./routes/widgets'));
app.use('/api/homepage', require('./routes/homepage'));
app.use('/api/telegram', require('./routes/telegram'));
app.use('/api/jobs', require('./routes/jobs'));

app.listen(PORT, () => {
  console.log(`News Reader API running on http://localhost:${PORT}`);
});
