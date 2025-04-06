const express = require('express');
const router = express.Router();
const path = require('path');
const UserModel = require('../models/userModel');
const { isAuthenticated } = require('./auth');

const ADMIN_TELEGRAM_ID = '1066887572';

// Middleware to check if user is admin
const isAdmin = (req, res, next) => {
    if (req.session.user && req.session.user.isAdmin) {
        next();
    } else {
        res.status(403).json({ error: 'Admin access required' });
    }
};

// Admin dashboard route
router.get('/dashboard', isAuthenticated, isAdmin, (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'views', 'admin_dashboard.html'));
});

// Get all users
router.get('/users', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const result = await UserModel.getAllUsers();
        
        if (!result.success) {
            return res.status(500).json({ error: 'Failed to fetch users' });
        }

        // Format users data
        const users = result.users.map(user => ({
            keyId: user.key_id,
            telegramId: user.telegram_id,
            username: user.username || 'No username',
            status: user.status,
            createdAt: user.created_at
        }));

        res.json({ success: true, users });
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Activate user
router.post('/activate', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const { keyId } = req.body;
        
        if (!keyId) {
            return res.status(400).json({ error: 'Key ID is required' });
        }

        // Check if user exists
        const userResult = await UserModel.getUserByKeyId(keyId);
        
        if (!userResult.success) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Don't allow modifying admin account
        if (userResult.user.telegram_id === ADMIN_TELEGRAM_ID) {
            return res.status(403).json({ error: 'Cannot modify admin account' });
        }

        // Update user status to active
        const result = await UserModel.updateUserStatus(keyId, 'active');
        
        if (!result.success) {
            return res.status(500).json({ error: 'Failed to activate user' });
        }

        res.json({ success: true, message: 'User activated successfully' });
    } catch (error) {
        console.error('Error activating user:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Ban user
router.post('/ban', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const { keyId } = req.body;
        
        if (!keyId) {
            return res.status(400).json({ error: 'Key ID is required' });
        }

        // Check if user exists
        const userResult = await UserModel.getUserByKeyId(keyId);
        
        if (!userResult.success) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Don't allow modifying admin account
        if (userResult.user.telegram_id === ADMIN_TELEGRAM_ID) {
            return res.status(403).json({ error: 'Cannot modify admin account' });
        }

        // Update user status to banned
        const result = await UserModel.updateUserStatus(keyId, 'banned');
        
        if (!result.success) {
            return res.status(500).json({ error: 'Failed to ban user' });
        }

        res.json({ success: true, message: 'User banned successfully' });
    } catch (error) {
        console.error('Error banning user:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get admin dashboard stats
router.get('/stats', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const result = await UserModel.getAllUsers();
        
        if (!result.success) {
            return res.status(500).json({ error: 'Failed to fetch stats' });
        }

        const stats = {
            total: result.users.length,
            pending: result.users.filter(u => u.status === 'pending').length,
            active: result.users.filter(u => u.status === 'active').length,
            banned: result.users.filter(u => u.status === 'banned').length
        };

        res.json({ success: true, stats });
    } catch (error) {
        console.error('Error fetching stats:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;