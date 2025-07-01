const express = require('express');
const fs = require('fs');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const axios = require('axios');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3001;
const USERS_FILE = './users.json';
const SECRET_KEY = process.env.SECRET_KEY || 'your-secret-key';

app.use(cors());
app.use(express.json());

// Tạo file users.json nếu chưa tồn tại
if (!fs.existsSync(USERS_FILE)) {
  fs.writeFileSync(USERS_FILE, '[]');
}

// Proxy Binance
app.get('/api/ticker', async (req, res) => {
  try {
    const response = await axios.get('https://fapi.binance.com/fapi/v1/ticker/24hr');
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: 'Lỗi khi gọi API Binance' });
  }
});

// Đăng ký
app.post('/api/register', [
  body('username').notEmpty(),
  body('password').isLength({ min: 6 })
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { username, password } = req.body;
  const users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8'));

  if (users.find(u => u.username === username)) {
    return res.status(400).json({ error: 'Username đã tồn tại' });
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  users.push({ username, password: hashedPassword });
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
  res.json({ message: 'Đăng ký thành công' });
});

// Đăng nhập
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  const users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8'));

  const user = users.find(u => u.username === username);
  if (!user) return res.status(401).json({ error: 'Sai tài khoản hoặc mật khẩu' });

  const match = await bcrypt.compare(password, user.password);
  if (!match) return res.status(401).json({ error: 'Sai tài khoản hoặc mật khẩu' });

  const token = jwt.sign({ username }, SECRET_KEY, { expiresIn: '1d' });
  res.json({ message: 'Đăng nhập thành công', token });
});

app.listen(PORT, () => {
  console.log(`Server chạy tại http://localhost:${PORT}`);
});
