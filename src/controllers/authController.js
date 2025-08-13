// src/controllers/authController.js
const UserService = require('../services/userService');
const { catchAsync, sendSuccess, sendError } = require('../utils/errorHandler');

class AuthController {
    // Register new user
    static register = catchAsync(async (req, res) => {
        // Use database functions from middleware
        const { query, getClient } = req.db;
        const result = await UserService.registerUser(req.body, { query, getClient });
        
        sendSuccess(res, result, 'User registered successfully. Please verify your email and mobile number.', 201);
    });

    // Login user
    static login = catchAsync(async (req, res) => {
        const { email, password } = req.body;
        const { query, getClient } = req.db;
        const result = await UserService.loginUser(email, password, { query, getClient });
        
        // Set token in cookie (optional)
        res.cookie('token', result.token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 90 * 24 * 60 * 60 * 1000 // 90 days
        });
        
        sendSuccess(res, result, 'Login successful');
    });

    // Get user profile
    static getProfile = catchAsync(async (req, res) => {
        const { query, getClient } = req.db;
        const user = await UserService.getUserProfile(req.user.id, { query, getClient });
        sendSuccess(res, { user }, 'Profile retrieved successfully');
    });

    // Update user profile
    static updateProfile = catchAsync(async (req, res) => {
        const { query, getClient } = req.db;
        const updatedUser = await UserService.updateUserProfile(req.user.id, req.body, { query, getClient });
        sendSuccess(res, { user: updatedUser }, 'Profile updated successfully');
    });

    // Get verification status
    static getVerificationStatus = catchAsync(async (req, res) => {
        const { query, getClient } = req.db;
        const status = await UserService.getVerificationStatus(req.user.id, { query, getClient });
        sendSuccess(res, status, 'Verification status retrieved');
    });

    // Send email verification
    static sendEmailVerification = catchAsync(async (req, res) => {
        const { query, getClient } = req.db;
        const result = await UserService.sendEmailVerification(req.user.id, { query, getClient });
        sendSuccess(res, result, 'Verification email sent successfully');
    });

    // Verify email (called from email link)
    static verifyEmail = catchAsync(async (req, res) => {
        const { token } = req.params;
        
        if (!token) {
            return sendError(res, 'Invalid verification link', 400);
        }
        
        try {
            // Use database functions from middleware
            const { query, getClient } = req.db;
            
            // Use direct database query for token verification
            const tokenResult = await query(
                'SELECT user_id, expires_at FROM email_verification_tokens WHERE token = $1 AND used = false',
                [token]
            );
            
            if (tokenResult.rows.length === 0) {
                return res.redirect(`${process.env.FRONTEND_URL}/verify-email-error?error=invalid_token`);
            }
            
            const tokenData = tokenResult.rows[0];
            
            // Check if token is expired
            if (new Date() > new Date(tokenData.expires_at)) {
                return res.redirect(`${process.env.FRONTEND_URL}/verify-email-error?error=expired_token`);
            }
            
            // Start transaction for email verification
            const client = await getClient();
            try {
                await client.query('BEGIN');
                
                // Mark email as verified
                await client.query(
                    'UPDATE users SET email_verified = true, email_verified_at = NOW() WHERE id = $1',
                    [tokenData.user_id]
                );
                
                // Mark token as used
                await client.query(
                    'UPDATE email_verification_tokens SET used = true, used_at = NOW() WHERE token = $1',
                    [token]
                );
                
                await client.query('COMMIT');
                
                res.redirect(`${process.env.FRONTEND_URL}/verify-email-success?verified=true`);
            } catch (error) {
                await client.query('ROLLBACK');
                throw error;
            } finally {
                client.release();
            }
            
        } catch (error) {
            console.error('Email verification error:', error);
            res.redirect(`${process.env.FRONTEND_URL}/verify-email-error?error=server_error`);
        }
    });

    // Send mobile OTP
    static sendMobileOTP = catchAsync(async (req, res) => {
        const { query, getClient } = req.db;
        const result = await UserService.sendMobileOTP(req.user.id, { query, getClient });
        sendSuccess(res, result, 'OTP sent to your mobile number');
    });

    // Verify mobile OTP
    static verifyMobileOTP = catchAsync(async (req, res) => {
        const { otp, verification_id } = req.body;
        const { query, getClient } = req.db;
        const result = await UserService.verifyMobileOTP(req.user.id, otp, verification_id, { query, getClient });
        sendSuccess(res, result, 'Mobile number verified successfully');
    });

    // Change password
    static changePassword = catchAsync(async (req, res) => {
        const { current_password, new_password } = req.body;
        
        if (!current_password || !new_password) {
            return sendError(res, 'Current password and new password are required', 400);
        }

        if (new_password.length < 8) {
            return sendError(res, 'New password must be at least 8 characters long', 400);
        }

        const { query, getClient } = req.db;
        const result = await UserService.changePassword(req.user.id, current_password, new_password, { query, getClient });
        sendSuccess(res, result, 'Password changed successfully');
    });

    // Forgot password (initiate reset)
    static forgotPassword = catchAsync(async (req, res) => {
        const { email } = req.body;
        
        if (!email) {
            return sendError(res, 'Email is required', 400);
        }

        const { query, getClient } = req.db;

        // Check if user exists
        const userResult = await query('SELECT id, email FROM users WHERE email = $1', [email]);
        
        if (userResult.rows.length === 0) {
            // Don't reveal if user exists or not for security
            return sendSuccess(res, 
                { 
                    message: 'If an account with this email exists, a password reset link has been sent.',
                    email 
                },
                'Password reset initiated'
            );
        }

        // Generate reset token and send email (implement based on your needs)
        const result = await UserService.initiatePasswordReset(email, { query, getClient });
        sendSuccess(res, 
            { 
                message: 'If an account with this email exists, a password reset link has been sent.',
                email 
            },
            'Password reset initiated'
        );
    });

    // Reset password (with token from email)
    static resetPassword = catchAsync(async (req, res) => {
        const { token, new_password } = req.body;
        
        if (!token || !new_password) {
            return sendError(res, 'Reset token and new password are required', 400);
        }

        if (new_password.length < 8) {
            return sendError(res, 'New password must be at least 8 characters long', 400);
        }

        const { query, getClient } = req.db;
        const result = await UserService.resetPassword(token, new_password, { query, getClient });
        sendSuccess(res, 
            { message: 'Password reset successfully' },
            'Password reset completed'
        );
    });

    // Delete account
    static deleteAccount = catchAsync(async (req, res) => {
        const { password } = req.body;
        
        if (!password) {
            return sendError(res, 'Password is required to delete account', 400);
        }

        const { query, getClient } = req.db;

        // Verify password before deletion using direct DB query
        const userResult = await query('SELECT password FROM users WHERE id = $1', [req.user.id]);
        
        if (userResult.rows.length === 0) {
            return sendError(res, 'User not found', 404);
        }

        const bcrypt = require('bcryptjs');
        const isPasswordValid = await bcrypt.compare(password, userResult.rows[0].password);
        
        if (!isPasswordValid) {
            return sendError(res, 'Incorrect password', 401);
        }

        const result = await UserService.deleteAccount(req.user.id, { query, getClient });
        
        // Clear cookie
        res.clearCookie('token');
        
        sendSuccess(res, result, 'Account deleted successfully');
    });

    // Logout (clear token)
    static logout = catchAsync(async (req, res) => {
        // Optionally blacklist token in database
        if (req.user && req.user.jti) {
            try {
                const { query } = req.db;
                await query(
                    'INSERT INTO token_blacklist (jti, user_id, blacklisted_at) VALUES ($1, $2, NOW())',
                    [req.user.jti, req.user.id]
                );
            } catch (error) {
                console.error('Error blacklisting token:', error);
                // Don't fail logout if blacklisting fails
            }
        }
        
        res.clearCookie('token');
        sendSuccess(res, null, 'Logged out successfully');
    });

    // Additional utility method to check database connectivity
    static healthCheck = catchAsync(async (req, res) => {
        try {
            const { query } = req.db;
            const result = await query('SELECT NOW() as current_time, version() as db_version');
            const userCount = await query('SELECT COUNT(*) as total_users FROM users');
            
            sendSuccess(res, {
                database: 'connected',
                current_time: result.rows[0].current_time,
                db_version: result.rows[0].db_version,
                total_users: parseInt(userCount.rows[0].total_users),
                service: 'auth-controller'
            }, 'Auth service is healthy');
        } catch (error) {
            sendError(res, 'Database connection failed', 500);
        }
    });
}

module.exports = AuthController;