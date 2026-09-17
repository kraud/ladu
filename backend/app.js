const express = require('express')
const asyncHandler = require('express-async-handler')
const { errorHandler } = require('./middleware/errorMiddleware')
const { pool } = require('./src/db')

const app = express()

// Behind Cloudflare + the edge Caddy reverse proxy in production (exactly one
// hop inside the Docker network) — trusts X-Forwarded-* from that hop so
// req.ip/req.protocol reflect the real client. Harmless in dev, where no
// proxy sits in front and no X-Forwarded-* header is sent.
app.set('trust proxy', 1)

// FE and BE are served same-origin in production (single project), and local
// dev goes through the Vite proxy, so no CORS is needed by default. For
// cross-origin setups, set CORS_ORIGIN to a comma-separated origin allowlist.
const corsOrigins = (process.env.CORS_ORIGIN || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

if (corsOrigins.length > 0) {
    const cors = require('cors');
    app.use(cors({
        origin: corsOrigins,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization'],
        credentials: true,
    }));
}

app.use(express.json())
app.use(express.urlencoded({extended: false}))

app.get('/', (req, res) => res.status(200).json({ message: 'Hello world!' }))

// Deploy health check (deploy/scripts/deploy.sh polls this until `sha` matches
// the image just deployed). GIT_SHA is set as a Docker build arg in production.
app.get('/api/health', asyncHandler(async (req, res) => {
    const sha = process.env.GIT_SHA || 'unknown'

    try {
        await pool.query('SELECT 1')
    } catch {
        res.status(503).json({ status: 'error', sha })
        return
    }

    res.status(200).json({ status: 'ok', sha })
}))

// Routes
app.use('/api/words', require('./routes/wordRoutes'))
app.use('/api/users', require('./routes/userRoutes'))
app.use('/api/notifications', require('./routes/notificationRoutes'))
app.use('/api/friendships', require('./routes/friendshipRoutes'))
app.use('/api/tags', require('./routes/tagRoutes'))
app.use('/api/tag-shares', require('./routes/tagShareRoutes'))
app.use('/api/autocompleteTranslations', require('./routes/autocompleteTranslationRoutes'))
app.use('/api/exercises', require('./routes/exerciseRoutes'))

app.use(errorHandler)

module.exports = app
