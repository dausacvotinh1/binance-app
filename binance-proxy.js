const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
const port = 3100;

app.use(cors());

app.get('/api/klines', async (req, res) => {
  const { symbol, interval = '1h', limit = 100 } = req.query;
  try {
    const response = await axios.get('https://fapi.binance.com/fapi/v1/klines', {
      params: { symbol, interval, limit }
    });
    res.json(response.data);
  } catch (error) {
    console.error('Lỗi proxy Binance:', error.message);
    res.status(500).json({ error: 'Lỗi lấy dữ liệu từ Binance' });
  }
});

app.listen(port, () => {
  console.log(`Proxy server running at http://localhost:${port}`);
});
