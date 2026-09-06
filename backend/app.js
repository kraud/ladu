const express = require('express')
const cors = require('cors')
const { errorHandler } = require('./middleware/errorMiddleware')

const app = express()

const corsOptions = {
    origin: '*', 
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
}

app.use(cors(corsOptions))
app.use(express.json())
app.use(express.urlencoded({extended: false}))

app.get('/', (req, res) => res.status(200).json({ message: 'Hello world!' }))

// Routes
app.use('/api/words', require('./routes/wordRoutes'))
app.use('/api/users', require('./routes/userRoutes'))
app.use('/api/notifications', require('./routes/notificationRoutes'))
app.use('/api/friendships', require('./routes/friendshipRoutes'))
app.use('/api/tags', require('./routes/tagRoutes'))
app.use('/api/autocompleteTranslations', require('./routes/autocompleteTranslationRoutes'))
app.use('/api/exercises', require('./routes/exerciseRoutes'))

app.use(errorHandler)

module.exports = app
