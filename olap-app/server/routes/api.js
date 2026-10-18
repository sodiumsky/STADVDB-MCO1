const express = require('express');
const { ping } = require('../db');
const { FILTERS, REPORTS } = require('../reports');
const { runReport, runLookup } = require('../lib/reportRunner');
const { describeError } = require('../lib/errors');

const router = express.Router();

// Wraps an async handler so any thrown error goes through describeError.
const handle = (fn) => async (req, res) => {
  try {
    await fn(req, res);
  } catch (err) {
    const { status, error } = describeError(err);
    res.status(status).json({ error });
  }
};

router.get('/health', handle(async (req, res) => {
  res.json({ connected: true, ...(await ping()) });
}));

router.get('/reports', (req, res) => {
  res.json({ filters: FILTERS, reports: REPORTS });
});

router.get('/lookups/:name', handle(async (req, res) => {
  res.json(await runLookup(req.params.name, req.query));
}));

router.post('/reports/:id/run', handle(async (req, res) => {
  const { filters, level, direction } = req.body || {};
  res.json(await runReport(req.params.id, { filters, level, direction }));
}));

module.exports = router;
