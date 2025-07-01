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
const USERS_FILE = path.join(__dirname, 'users.json'); // ✅ Đường dẫn tuyệt đối
const SECRET_KEY = process.env.SECRET_KEY || 'your-secret-key';

console.log('📁 Ghi/đọc file tại:', USERS_FILE);

app.use(cors());
app.use(express.json());

// Tạo file users.json nếu chưa tồn tại
if (!fs.existsSync(USERS_FILE)) {
  fs.writeFileSync(USERS_FILE, '[]');
  console.log('📄 Đã tạo file users.json mới');
}

// Middleware kiểm tra token JWT
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
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

// Danh sách đường dẫn không cần đăng nhập
const publicPaths = [
  '/login.html',
  '/register.html',
  '/api/login',
  '/api/register',
  '/api/ticker',
  '/api/klines'
];

// Áp dụng kiểm tra token cho các route cần bảo vệ
app.use((req, res, next) => {
  if (publicPaths.includes(req.path)) return next();
  if (req.path.startsWith('/static') || req.path.match(/\.(js|css|png|jpg|jpeg|gif|svg|ico)$/)) return next();
  authenticateToken(req, res, next);
});

// Phục vụ file tĩnh trong thư mục public/
app.use(express.static(path.join(__dirname, 'public')));

// ✅ API proxy lấy ticker
app.get('/api/ticker', async (req, res) => {
  try {
    const response = await axios.get('https://fapi.binance.com/fapi/v1/ticker/24hr');
    res.json(response.data);
  } catch (error) {
    console.error('Lỗi gọi ticker:', error.message);
    res.status(500).json({ error: 'Lỗi khi gọi API Binance' });
  }
});

// ✅ API proxy lấy klines
app.get('/api/klines', async (req, res) => {
  const { symbol, interval = '1h', limit = 100 } = req.query;
  try {
    const response = await axios.get('https://fapi.binance.com/fapi/v1/klines', {
      params: { symbol, interval, limit }
    });
    res.json(response.data);
  } catch (error) {
    console.error('Lỗi gọi klines:', error.message);
    res.status(500).json({ error: 'Lỗi lấy dữ liệu từ Binance' });
  }
});

// ✅ API đăng ký
app.post('/api/register', [
  body('username').notEmpty(),
  body('password').isLength({ min: 6 })
], async (req, res) => {
  console.log('📥 Nhận đăng ký:', req.body);

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.log('❌ Lỗi validate:', errors.array());
    return res.status(400).json({ errors: errors.array() });
  }

  const { username, password } = req.body;
  const users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8'));
  console.log('📋 Trước khi thêm:', users);

  if (users.find(u => u.username === username)) {
    console.log('⚠️ Username đã tồn tại:', username);
    return res.status(400).json({ error: 'Username đã tồn tại' });
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  users.push({ username, password: hashedPassword });

  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
  console.log('✅ Đã ghi user vào file');

  res.json({ message: 'Đăng ký thành công' });
});

// ✅ API đăng nhập
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

// ✅ Khởi động server
app.listen(PORT, () => {
  console.log(`🚀 Server đang chạy tại http://localhost:${PORT}`);
});
