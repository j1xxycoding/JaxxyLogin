const express = require('express');
const session = require('express-session');
const path = require('path');
const fs = require('fs');
const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Session configuration
app.use(session({
    secret: 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false, // Set to true in production with HTTPS
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// Create MySQL tables if they don't exist
const db = require('./db');
async function initializeDatabase() {
    try {
        await db.execute(`
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                key_id VARCHAR(36) NOT NULL UNIQUE,
                telegram_id VARCHAR(20) NOT NULL UNIQUE,
                username VARCHAR(255),
                profile_pic_url TEXT,
                status ENUM('pending', 'active', 'banned') DEFAULT 'pending',
                otp VARCHAR(6),
                otp_expiry DATETIME,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('Database tables initialized');
    } catch (error) {
        console.error('Error initializing database:', error);
        process.exit(1);
    }
}

// Initialize database tables
initializeDatabase();

// Routes
app.use('/auth', require('./routes/auth').router);
app.use('/user', require('./routes/user'));
app.use('/admin', require('./routes/admin'));

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
});

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Serve views directory for HTML files
app.use('/views', express.static(path.join(__dirname, 'views')));

// Serve HTML files
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'login.html'));
});

// Create public directory if it doesn't exist
const publicDir = path.join(__dirname, 'public');
if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir);
}

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

module.exports = app;