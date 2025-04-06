const express = require('express');
const router = express.Router();
const axios = require('axios');
const path = require('path');
const UserModel = require('../models/userModel');
const { isAuthenticated } = require('./auth');

const BOT_TOKEN = '7642959676:AAGT5DBFXsPDy7Ox9FPyGV0-VXfUQltUDz8';

// Fetch user profile from Telegram
async function fetchTelegramProfile(telegramId) {
    try {
        // First get chat info
        const chatResponse = await axios.get(`https://api.telegram.org/bot${BOT_TOKEN}/getChat`, {
            params: {
                chat_id: telegramId
            }
        });

        if (!chatResponse.data.ok) {
            console.error('Failed to get chat:', chatResponse.data);
            return { success: false };
        }

        const chat = chatResponse.data.result;
        let profilePicUrl = null;

        // If user has a profile photo, get the file path
        if (chat.photo) {
            // Get file path for the photo
            const fileResponse = await axios.get(`https://api.telegram.org/bot${BOT_TOKEN}/getFile`, {
                params: {
                    file_id: chat.photo.small_file_id
                }
            });

            if (fileResponse.data.ok) {
                const filePath = fileResponse.data.result.file_path;
                profilePicUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${filePath}`;
                console.log('Profile picture URL:', profilePicUrl);
            }
        }

        // If no profile picture, generate a random one using DiceBear API
        if (!profilePicUrl) {
            const seed = telegramId; // Use telegram ID as seed for consistent avatar
            const username = chat.username || 'User';
            profilePicUrl = `https://api.dicebear.com/7.x/initials/svg?seed=${username}&backgroundColor=2563eb&chars=2`;
            console.log('Using generated profile picture:', profilePicUrl);
        }

        return {
            success: true,
            username: chat.username || 'No username',
            profilePicUrl
        };
    } catch (error) {
        console.error('Error fetching Telegram profile:', error.response?.data || error.message);
        return { success: false };
    }
}

// Middleware to check if user is not admin
const isNotAdmin = (req, res, next) => {
    if (req.session.user && !req.session.user.isAdmin) {
        next();
    } else {
        res.status(403).json({ error: 'Access denied' });
    }
};

// Serve pending page
router.get('/pending', isAuthenticated, isNotAdmin, (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'views', 'pending.html'));
});

// Serve banned page
router.get('/banned', isAuthenticated, isNotAdmin, (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'views', 'banned.html'));
});

// User dashboard route
router.get('/dashboard', isAuthenticated, isNotAdmin, async (req, res) => {
    try {
        const userResult = await UserModel.getUserByTelegramId(req.session.user.telegramId);
        
        if (!userResult.success) {
            return res.status(404).json({ error: 'User not found' });
        }

        const user = userResult.user;

        // Check user status and redirect to appropriate page
        if (user.status === 'pending') {
            return res.redirect('/user/pending');
        }
        if (user.status === 'banned') {
            return res.redirect('/user/banned');
        }

        // For active users, fetch latest profile from Telegram
        const telegramProfile = await fetchTelegramProfile(user.telegram_id);
        
        if (telegramProfile.success) {
            // Update user profile in database
            await UserModel.updateUserProfile(
                user.telegram_id,
                telegramProfile.username,
                telegramProfile.profilePicUrl
            );
        }

        // Send user dashboard page
        res.sendFile(path.join(__dirname, '..', 'views', 'user_dashboard.html'));
    } catch (error) {
        console.error('Dashboard error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// BIN lookup page route
router.get('/bin-lookup', isAuthenticated, isNotAdmin, async (req, res) => {
    try {
        const userResult = await UserModel.getUserByTelegramId(req.session.user.telegramId);
        
        if (!userResult.success) {
            return res.status(404).json({ error: 'User not found' });
        }

        const user = userResult.user;

        // Check user status
        if (user.status === 'pending') {
            return res.redirect('/user/pending');
        }
        if (user.status === 'banned') {
            return res.redirect('/user/banned');
        }

        // Send BIN lookup page
        res.sendFile(path.join(__dirname, '..', 'views', 'bin_lookup.html'));
    } catch (error) {
        console.error('BIN lookup page error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// BIN lookup API route
router.post('/bin-lookup', isAuthenticated, isNotAdmin, async (req, res) => {
    try {
        const { bin } = req.body;

        // Validate BIN format
        if (!bin || !/^\d{6}$/.test(bin)) {
            return res.status(400).json({ error: 'Invalid BIN format. Must be 6 digits.' });
        }

        // Fetch BIN info from binlist.net API
        const response = await axios.get(`https://lookup.binlist.net/${bin}`);
        
        res.json({
            success: true,
            data: {
                scheme: response.data.scheme,
                type: response.data.type,
                brand: response.data.brand,
                country: response.data.country,
                bank: response.data.bank
            }
        });
    } catch (error) {
        console.error('BIN lookup error:', error);
        if (error.response?.status === 404) {
            return res.status(404).json({ error: 'BIN not found' });
        }
        res.status(500).json({ error: 'Failed to lookup BIN' });
    }
});

// Get user profile data
router.get('/profile', isAuthenticated, isNotAdmin, async (req, res) => {
    try {
        const userResult = await UserModel.getUserByTelegramId(req.session.user.telegramId);
        
        if (!userResult.success) {
            return res.status(404).json({ error: 'User not found' });
        }

        const user = userResult.user;
        res.json({
            keyId: user.key_id,
            telegramId: user.telegram_id,
            username: user.username,
            profilePicUrl: user.profile_pic_url,
            status: user.status,
            createdAt: user.created_at
        });
    } catch (error) {
        console.error('Profile fetch error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Refresh user profile from Telegram
router.post('/refresh-profile', isAuthenticated, isNotAdmin, async (req, res) => {
    try {
        const telegramProfile = await fetchTelegramProfile(req.session.user.telegramId);
        
        if (!telegramProfile.success) {
            return res.status(500).json({ error: 'Failed to fetch Telegram profile' });
        }

        await UserModel.updateUserProfile(
            req.session.user.telegramId,
            telegramProfile.username,
            telegramProfile.profilePicUrl
        );

        res.json({
            success: true,
            username: telegramProfile.username,
            profilePicUrl: telegramProfile.profilePicUrl
        });
    } catch (error) {
        console.error('Profile refresh error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;