import express from 'express'
import mongoose from 'mongoose'
import cors from 'cors'
import path from 'path'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 3000

// Fix __dirname
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Middleware
app.use(express.json())
app.use(cors())

// Routes
import authRoutes from './routes/auth.js'
import usersRoutes from './routes/users.js'
import okrsRoutes from './routes/okrs.js'
import myOkrsRoutes from './routes/my-okrs.js'
import tasksRoutes from './routes/tasks.js'
import reportsRoutes from './routes/reports.js'
import departmentsRoutes from './routes/departments.js'
import kpisRoutes from './routes/kpis.js'
import authMiddleware from './middleware/auth.js'

// MongoDB Atlas
import bcrypt from 'bcryptjs';
import User from './models/User.js';
import config from './config.js';

async function ensureDefaultAdmin() {
  const ADMIN_EMAIL = config.defaultAdmin.email;
  const ADMIN_PASSWORD = config.defaultAdmin.password;
  const ADMIN_NAME = config.defaultAdmin.name;
  try {
    const existing = await User.findOne({ email: ADMIN_EMAIL });
    if (existing) {
      if (existing.role !== 'ADMIN') {
        existing.role = 'ADMIN';
        await existing.save();
        console.log(`🔧 Promoted existing user ${ADMIN_EMAIL} to ADMIN`);
      } else {
        console.log(`✅ Default admin exists: ${ADMIN_EMAIL}`);
      }
      return;
    }

    const hash = await bcrypt.hash(ADMIN_PASSWORD, 10);
    const admin = await User.create({
      name: ADMIN_NAME,
      email: ADMIN_EMAIL,
      password: hash,
      role: 'ADMIN',
      department: 'Ban Giám Đốc',
      avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(ADMIN_NAME)}`
    });
    console.log(`✅ Created default admin user: ${ADMIN_EMAIL}`);
  } catch (err) {
    console.error('❌ Error ensuring default admin user:', err);
  }
}

const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://dongvanict3_db_user:7yC5wXM1niXHGUmz@cluster0.vrlouhe.mongodb.net/';

mongoose.connect(MONGO_URI)
  .then(() => {
    console.log('✅ MongoDB Connected');
    ensureDefaultAdmin();
  })
  .catch(err => console.error('❌ MongoDB connection error:', err))

// API test
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Backend running' })
})

// Mount API routes
app.use('/api/auth', authRoutes)
app.use('/api/users', usersRoutes)
app.use('/api/okrs', okrsRoutes)
app.use('/api/my-okrs', myOkrsRoutes)
app.use('/api/tasks', tasksRoutes)
app.use('/api/reports', reportsRoutes)
app.use('/api/departments', departmentsRoutes)
app.use('/api/kpis', kpisRoutes)

// Useful endpoint for the frontend to check current user
app.get('/api/auth/me', authMiddleware, (req, res) => {
  res.json(req.user)
})

// Serve frontend build
const clientDistPath = path.join(__dirname, 'client/dist')
app.use(express.static(clientDistPath))

// SPA fallback (React Router)
app.get(/.*/, (req, res) => {
  res.sendFile(path.join(clientDistPath, 'index.html'))
})

// Error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ message: 'Server error', error: err.message });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`)
})
