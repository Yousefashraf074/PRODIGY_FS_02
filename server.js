require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { initDB } = require('./database');

const app = express();
const PORT = process.env.PORT || 4200;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Keycloak config endpoint (so frontend knows the Keycloak settings)
app.get('/api/keycloak-config', (req, res) => {
  res.json({
    url: process.env.KEYCLOAK_URL || 'http://localhost:8080',
    realm: process.env.KEYCLOAK_REALM || 'ems-realm',
    clientId: process.env.KEYCLOAK_CLIENT_ID || 'ems-app'
  });
});

// API Routes (all protected by Keycloak token validation in middleware)
app.use('/api/employees', require('./routes/employees'));

// Serve frontend for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server after DB init
initDB().then(() => {
  app.listen(PORT, () => {
    console.log(`\n  Employee Management System running at http://localhost:${PORT}`);
    console.log(`  Keycloak: ${process.env.KEYCLOAK_URL || 'http://localhost:8080'}`);
    console.log(`  Realm:    ${process.env.KEYCLOAK_REALM || 'ems-realm'}\n`);
  });
}).catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
