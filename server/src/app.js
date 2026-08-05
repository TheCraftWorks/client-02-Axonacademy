const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const errorHandler = require('./middleware/errorHandler');
const compression = require('compression');

const app = express();

// Apply Gzip compression
app.use(compression());

// Trust proxy
app.set('trust proxy', 1);

// Security
app.use(helmet());

// ==================== CORS ====================

// CLIENT_URL accepts a comma-separated list of allowed origins.
// In production on Railway, set this to your Vercel URL(s), e.g.:
//   CLIENT_URL=https://oc-pro.vercel.app,https://oc-pro-git-main-yourteam.vercel.app
// Custom domains: https://www.axonmedacademy.com, etc.
const rawOrigins = process.env.CLIENT_URL || '';

const allowedOrigins = rawOrigins
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);

// Development origins — always allowed outside production
if (process.env.NODE_ENV !== 'production') {
  [
    'http://localhost:3000',
    'http://localhost:5173',
    'http://localhost:8080',
    'http://localhost:8081'
  ].forEach(origin => {
    if (!allowedOrigins.includes(origin)) {
      allowedOrigins.push(origin);
    }
  });
}

console.log('[CORS] Allowed Origins:', allowedOrigins);

const corsOptions = {
  origin: (origin, callback) => {
    // Allow Postman, server-to-server, curl (no Origin header)
    if (!origin) {
      return callback(null, true);
    }

    // Exact match against configured origins
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    // Allow Capacitor/local origins for mobile apps
    if (origin === 'http://localhost' || origin === 'https://localhost' || origin.startsWith('capacitor://')) {
      return callback(null, true);
    }

    // Allow ALL *.vercel.app preview deployments (covers every PR deploy)
    if (/^https:\/\/[a-zA-Z0-9-]+-[a-zA-Z0-9]+-[a-zA-Z0-9]+\.vercel\.app$/.test(origin) ||
      /^https:\/\/[a-zA-Z0-9-]+\.vercel\.app$/.test(origin)) {
      return callback(null, true);
    }

    // Allow custom production domain and its subdomains
    if (/^https:\/\/(www\.)?axonmedacademy\.com$/.test(origin) ||
      /^https:\/\/[a-zA-Z0-9-]+\.axonmedacademy\.com$/.test(origin)) {
      return callback(null, true);
    }

    console.error(`[CORS] BLOCKED: ${origin}`);
    // Return false instead of throwing an error to avoid a 500 being returned by the error handler
    return callback(null, false);
  },

  credentials: true,

  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],

  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'Range',
    'x-dev-user-email',
    'x-dev-user-role',
    'x-dev-user-name'
  ],

  exposedHeaders: ['Content-Range', 'Accept-Ranges', 'Content-Length'],

  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));

// Pre-flight for every route
app.options(/.*/, cors(corsOptions));

// ==================== END CORS ====================

// Logger
app.use(morgan('dev'));

// Body Parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({
  extended: true,
  limit: '10mb'
}));

// Cookies
app.use(cookieParser());

// Static Files
app.use(
  '/uploads',
  express.static(path.join(__dirname, '../uploads'))
);

// Rate Limit
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    const url = req.originalUrl || req.url || '';
    return url.includes('/auth/login') || url.includes('/auth/register');
  },
  message: {
    success: false,
    message:
      'Too many requests from this IP. Please try again later.'
  }
});

app.use('/api', apiLimiter);

// Health Check
app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'API is running',
    timestamp: new Date().toISOString()
  });
});

// Routes
const apiRouter = require('./routes');
app.use('/api/v1', apiRouter);

// Error Handler
app.use(errorHandler);

module.exports = app;