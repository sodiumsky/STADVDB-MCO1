const path = require('path');
const fs = require('fs');
const express = require('express');
const { config, ping } = require('./db');
const api = require('./routes/api');

const app = express();
app.use(express.json());
app.use('/api', api);

app.use('/api', (req, res) => {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: `No API route for ${req.method} ${req.originalUrl}.` } });
});

// In production the built React app is served from here, so one URL handles pages and API.
const clientDist = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(path.join(clientDist, 'index.html'))) {
  app.use(express.static(clientDist));
  // BrowserRouter paths such as /reports/report1 must load the app, not 404.
  app.use((req, res, next) => {
    if (req.method !== 'GET' || path.extname(req.path)) return next();
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

app.use((err, req, res, next) => {
  const status = err.status || 400;
  res.status(status).json({ error: { code: 'BAD_REQUEST', message: err.message || 'Bad request.' } });
});

const port = Number(process.env.PORT) || 3001;
app.listen(port, async () => {
  console.log(`OLAP API listening on http://localhost:${port}`);
  try {
    const info = await ping();
    console.log(`Connected to MySQL ${info.version} at ${config.host}:${config.port}, database "${info.database}"`);
  } catch (err) {
    console.warn(`Could not reach MySQL at ${config.host}:${config.port} (${err.code || err.message}).`);
    console.warn('The app will keep running and show the problem in the header. Check olap-app/.env.');
  }
});
