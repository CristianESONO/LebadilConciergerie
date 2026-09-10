// =========================================================================
// VERCEL SERVERLESS ENTRYPOINT
// =========================================================================
// Fix: In Vercel, __dirname inside api/ points to /var/task/api/
// We need to set the root path correctly before loading the server
process.env.APP_ROOT = require('path').join(__dirname, '..');

const app = require('../server');

module.exports = app;
