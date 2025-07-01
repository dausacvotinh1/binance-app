const express = require('express');
const fs = require('fs');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const axios = require('axios');
const cors = require('cors');
const path = require('path');

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

// Middleware kiểm tra token JWT
function authenticateToken(req, res, next) {
  // Token có thể nằm ở header Authorization: Bearer <token>
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    // Nếu request chấp nhận html, redirect về login.html
    if (req.accepts('html')) {
      return res.redirect('/login.html');
    } else {
      return res.status(401).json({ error: 'Bạn chưa đăng nhập' });
    }
  }

  jwt.verify(token, SECRET_KEY, (err, user) => {
    if (err) {
      if (req.accepts('html')) {
        return res.redirect('/login.html');
      } else {
        return res.status(403).json({ error: 'Token không hợp lệ' });
      }
    }
    req.user = user;
    next();
  });
}

// Danh sách đường dẫn không cần kiểm tra token
const publicPaths = [
  '/login.html',
  '/register.html',
  '/api/login',
  '/api/register',
  '/api/ticker',
  '/api/klines'
];

// Áp dụng middleware kiểm tra token cho tất cả request
app.use((req, res, next) => {
  // Nếu request tới đường dẫn công khai, cho qua luôn
  if (publicPaths.includes(req.path)) {
    return next();
  }
  // Nếu request tới thư mục public nhưng không phải file HTML (ví dụ js, css), cho qua
  if (req.path.startsWith('/static') || req.path.match(/\.(js|css|png|jpg|jpeg|gif|svg|ico)$/)) {
    return next();
  }
  // Các trường hợp còn lại kiểm tra token
  authenticateToken(req, res, next);
});

// Phục vụ static file trong thư mục public/
app.use(express.static(path.join(__dirname, 'public')));

// Proxy API lấy ticker 24h từ Binance
app.get('/api/ticker', async (req, res) => {
  try {
    const response = await axios.get('https://fapi.binance.com/fapi/v1/ticker/24hr');
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: 'Lỗi khi gọi API Binance' });
  }
});

// Proxy API lấy dữ liệu nến (klines) từ Binance
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

// Đăng ký người dùng mới
app.post('/api/register', [
  body('username').notEmpty(),
  body('password').isLength({ min: 6 })
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.log('Validation errors:', errors.array());
    return res.status(400).json({ errors: errors.array() });
  }

  const { username, password } = req.body;
  const users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8'));
  console.log('Users trước khi thêm:', users);

  if (users.find(u => u.username === username)) {
    console.log('Username đã tồn tại:', username);
    return res.status(400).json({ error: 'Username đã tồn tại' });
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  users.push({ username, password: hashedPassword });
  console.log('Users sau khi thêm:', users);

  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
  console.log('Ghi users.json thành công');

  res.json({ message: 'Đăng ký thành công' });
});


// Đăng nhập người dùng
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
