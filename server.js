const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const os = require('os');
const crypto = require('crypto');

const app = express();
const dataFile = path.join(__dirname, 'feedingData.json');
const webhookFile = path.join(__dirname, 'webhooks.json');

app.use(express.json());
app.use(express.static('public'));

// Serve the HTML files
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/webhook', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'indexold.html'));
});

// Get feeding history
app.get('/api/history', async (req, res) => {
  try {
    const data = await fs.readFile(dataFile, 'utf8');
    res.json(JSON.parse(data));
  } catch (error) {
    if (error.code === 'ENOENT') {
      res.json([]);
    } else {
      console.error('Error reading data:', error);
      res.status(500).json({ error: 'Error reading data' });
    }
  }
});

// Add new feeding record
app.post('/api/feed', async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }
    const newRecord = { name, timestamp: new Date().toISOString() };

    let data = [];
    try {
      const fileContent = await fs.readFile(dataFile, 'utf8');
      data = JSON.parse(fileContent);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.error('Error reading file:', error);
        throw error;
      }
    }

    data.unshift(newRecord);
    data = data.slice(0, 10); // Keep only the last 10 records

    await fs.writeFile(dataFile, JSON.stringify(data, null, 2));
    res.status(201).json(newRecord);
  } catch (error) {
    console.error('Error saving data:', error);
    res.status(500).json({ error: 'Error saving data' });
  }
});

// Generate webhook for a family member
app.post('/api/webhook', async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const token = crypto.randomBytes(16).toString('hex');
    const webhook = { name, token };

    let webhooks = [];
    try {
      const fileContent = await fs.readFile(webhookFile, 'utf8');
      webhooks = JSON.parse(fileContent);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.error('Error reading webhooks file:', error);
        throw error;
      }
    }

    webhooks.push(webhook);
    await fs.writeFile(webhookFile, JSON.stringify(webhooks, null, 2));

    res.status(201).json({ webhook: `/api/webhook/${token}` });
  } catch (error) {
    console.error('Error generating webhook:', error);
    res.status(500).json({ error: 'Error generating webhook' });
  }
});

// Handle webhook calls
app.get('/api/webhook/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const webhooks = JSON.parse(await fs.readFile(webhookFile, 'utf8'));
    const webhook = webhooks.find(w => w.token === token);

    if (!webhook) {
      return res.status(404).json({ error: 'Webhook not found' });
    }

    const newRecord = { name: webhook.name, timestamp: new Date().toISOString() };

    let data = [];
    try {
      const fileContent = await fs.readFile(dataFile, 'utf8');
      data = JSON.parse(fileContent);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.error('Error reading file:', error);
        throw error;
      }
    }

    data.unshift(newRecord);
    data = data.slice(0, 10); // Keep only the last 10 records

    await fs.writeFile(dataFile, JSON.stringify(data, null, 2));
    res.status(200).json({ message: 'Feeding recorded successfully' });
  } catch (error) {
    console.error('Error processing webhook:', error);
    res.status(500).json({ error: 'Error processing webhook' });
  }
});

const PORT = 3000;

// Get local IP address
const getLocalIpAddress = () => {
  const interfaces = os.networkInterfaces();
  for (const devName in interfaces) {
    const iface = interfaces[devName];
    for (let i = 0; i < iface.length; i++) {
      const alias = iface[i];
      if (alias.family === 'IPv4' && alias.address !== '127.0.0.1' && !alias.internal) {
        return alias.address;
      }
    }
  }
  return '0.0.0.0';
};

app.listen(PORT, () => {
  const localIpAddress = getLocalIpAddress();
  console.log(`Server running at http://localhost:${PORT}`);
  console.log(`On other devices, use http://${localIpAddress}:${PORT}`);
});
