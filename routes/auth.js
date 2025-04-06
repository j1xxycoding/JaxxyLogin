const express = require('express');
const router = express.Router();
const axios = require('axios');
const path = require('path');
const UserModel = require('../models/userModel');

const BOT_TOKEN = '7642959676:AAGT5DBFXsPDy7Ox9FPyGV0-VXfUQltUDz8';
const ADMIN_TELEGRAM_ID = '1066887572';

// Generate 6-digit OTP
function generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

// Send OTP via Telegram Bot
async function sendOTPviaTelegram(chatId, otp) {
    try {
        const message = `Your login OTP is: ${otp}\nThis OTP will expire in 5 minutes.`;
        const response = await axios.get(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
            params: {
                chat_id: chatId,
                text: message
            }
        });
        return response.data.ok;
    } catch (error) {
        console.error('Error sending OTP via Telegram:', error);
        return false;
    }
}

// Login route
router.post('/login', async (req, res) => {
    try {
        const { telegramId } = req.body;
        
        if (!telegramId || isNaN(telegramId)) {
            return res.status(400).json({ error: 'Invalid Telegram ID' });
        }

        // Generate OTP and set expiry time (5 minutes from now)
        const otp = generateOTP();
        const otpExpiry = new Date(Date.now() + 5 * 60 * 1000);

        // Check if user exists
        let userResult = await UserModel.getUserByTelegramId(telegramId);
        
        if (userResult.success) {
            // Update existing user's OTP
            await UserModel.updateUserOTP(telegramId, otp, otpExpiry);
        } else {
            // Create new user
            userResult = await UserModel.createUser(telegramId, otp, otpExpiry);
            if (!userResult.success) {
                return res.status(500).json({ error: 'Error creating user' });
            }
        }

        // Send OTP via Telegram
        const otpSent = await sendOTPviaTelegram(telegramId, otp);
        if (!otpSent) {
            return res.status(500).json({ error: 'Error sending OTP. Please make sure you have started the bot.' });
        }

        // Store telegram ID in session for OTP verification
        req.session.pendingTelegramId = telegramId;
        
        res.json({ success: true, message: 'OTP sent successfully' });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Serve verify page
router.get('/verify', (req, res) => {
    if (!req.session.pendingTelegramId) {
        return res.redirect('/');
    }
    res.sendFile(path.join(__dirname, '..', 'views', 'verify.html'));
});

// OTP verification route
router.post('/verify', async (req, res) => {
    try {
        const { otp } = req.body;
        const telegramId = req.session.pendingTelegramId;

        if (!telegramId || !otp) {
            return res.status(400).json({ error: 'Invalid request' });
        }

        // Verify OTP
        const verificationResult = await UserModel.verifyOTP(telegramId, otp);
        
        if (!verificationResult.success) {
            return res.status(400).json({ error: 'Invalid or expired OTP' });
        }

        // Set session data
        const user = verificationResult.user;
        req.session.user = {
            telegramId: user.telegram_id,
            keyId: user.key_id,
            isAdmin: user.telegram_id === ADMIN_TELEGRAM_ID,
            status: user.status
        };

        // Clear pending telegram ID
        delete req.session.pendingTelegramId;

        // Determine redirect URL based on user role
        const redirectUrl = user.telegram_id === ADMIN_TELEGRAM_ID 
            ? '/admin/dashboard'
            : '/user/dashboard';

        res.json({ success: true, redirectUrl });
    } catch (error) {
        console.error('OTP verification error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Logout route
router.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

// Middleware to check if user is logged in
const isAuthenticated = (req, res, next) => {
    if (req.session.user) {
        next();
    } else {
        res.status(401).json({ error: 'Not authenticated' });
    }
};

module.exports = {
    router,
    isAuthenticated
};