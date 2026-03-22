const express = require('express');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

console.log('--- Starting Frontend Server ---');
console.log(`Port: ${port}`);
console.log(`Directory: ${__dirname}`);

// Serve static files from the 'dist' directory
app.use(express.static(path.join(__dirname, 'dist')));

// Health check endpoint
app.get('/health', (req, res) => {
  console.log('Health check requested at /health');
  res.status(200).send('OK');
});

// Root path handler (Railway often checks this by default)
app.get('/', (req, res) => {
  console.log('Root path requested');
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// Handle SPA routing: serve index.html for any unknown routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(port, '0.0.0.0', () => {
  console.log('====================================');
  console.log(`Frontend server is UP and RUNNING`);
  console.log(`Listening on 0.0.0.0:${port}`);
  console.log('====================================');
});
