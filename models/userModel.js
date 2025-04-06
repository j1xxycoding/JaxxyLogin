const db = require('../db');
const { v4: uuidv4 } = require('uuid');

class UserModel {
    static async createUser(telegramId, otp, otpExpiry) {
        try {
            const keyId = uuidv4();
            const [result] = await db.execute(
                'INSERT INTO users (key_id, telegram_id, status, otp, otp_expiry) VALUES (?, ?, ?, ?, ?)',
                [keyId, telegramId, 'pending', otp, otpExpiry]
            );
            return { keyId, success: true };
        } catch (error) {
            console.error('Error creating user:', error);
            return { success: false, error: error.message };
        }
    }

    static async updateUserOTP(telegramId, otp, otpExpiry) {
        try {
            const [result] = await db.execute(
                'UPDATE users SET otp = ?, otp_expiry = ? WHERE telegram_id = ?',
                [otp, otpExpiry, telegramId]
            );
            return { success: true };
        } catch (error) {
            console.error('Error updating OTP:', error);
            return { success: false, error: error.message };
        }
    }

    static async verifyOTP(telegramId, submittedOTP) {
        try {
            // First, get the user record
            const [rows] = await db.execute(
                'SELECT * FROM users WHERE telegram_id = ?',
                [telegramId]
            );

            if (rows.length === 0) {
                console.log('User not found:', telegramId);
                return { success: false, error: 'User not found' };
            }

            const user = rows[0];
            
            // Log verification attempt details
            console.log('OTP Verification:', {
                submittedOTP,
                storedOTP: user.otp,
                otpExpiry: user.otp_expiry,
                currentTime: new Date()
            });

            // Check if OTP matches
            if (user.otp !== submittedOTP) {
                console.log('OTP mismatch');
                return { success: false, error: 'Invalid OTP' };
            }

            // Check if OTP is expired
            const now = new Date();
            const otpExpiry = new Date(user.otp_expiry);
            
            if (now > otpExpiry) {
                console.log('OTP expired');
                return { success: false, error: 'OTP has expired' };
            }

            // Clear the OTP after successful verification
            await db.execute(
                'UPDATE users SET otp = NULL, otp_expiry = NULL WHERE telegram_id = ?',
                [telegramId]
            );

            console.log('OTP verification successful');
            return { success: true, user };
        } catch (error) {
            console.error('Error verifying OTP:', error);
            return { success: false, error: error.message };
        }
    }

    static async updateUserStatus(keyId, status) {
        try {
            const [result] = await db.execute(
                'UPDATE users SET status = ? WHERE key_id = ?',
                [status, keyId]
            );
            return { success: true };
        } catch (error) {
            console.error('Error updating user status:', error);
            return { success: false, error: error.message };
        }
    }

    static async getUserByTelegramId(telegramId) {
        try {
            const [rows] = await db.execute(
                'SELECT * FROM users WHERE telegram_id = ?',
                [telegramId]
            );
            return rows.length > 0 ? { success: true, user: rows[0] } : { success: false };
        } catch (error) {
            console.error('Error getting user by telegram ID:', error);
            return { success: false, error: error.message };
        }
    }

    static async getUserByKeyId(keyId) {
        try {
            const [rows] = await db.execute(
                'SELECT * FROM users WHERE key_id = ?',
                [keyId]
            );
            return rows.length > 0 ? { success: true, user: rows[0] } : { success: false };
        } catch (error) {
            console.error('Error getting user by key ID:', error);
            return { success: false, error: error.message };
        }
    }

    static async getAllUsers() {
        try {
            const [rows] = await db.execute('SELECT * FROM users');
            return { success: true, users: rows };
        } catch (error) {
            console.error('Error getting all users:', error);
            return { success: false, error: error.message };
        }
    }

    static async updateUserProfile(telegramId, username, profilePicUrl) {
        try {
            const [result] = await db.execute(
                'UPDATE users SET username = ?, profile_pic_url = ? WHERE telegram_id = ?',
                [username, profilePicUrl, telegramId]
            );
            return { success: true };
        } catch (error) {
            console.error('Error updating user profile:', error);
            return { success: false, error: error.message };
        }
    }
}

module.exports = UserModel;