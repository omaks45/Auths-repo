// src/controllers/authController.js
const UserService = require('../services/userService');
const { catchAsync, sendSuccess, sendError } = require('../utils/errorHandler');

class AuthController {
    // Register new user
    static register = catchAsync(async (req, res) => {
        const result = await UserService.registerUser(req.body);
        
        sendSuccess(res, result, 'User registered successfully. Please verify your email and mobile number.', 201);
    });

    // Login user
    static login = catchAsync(async (req, res) => {
        const { email, password } = req.body;
        const result = await UserService.loginUser(email, password);
        
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
        const user = await UserService.getUserProfile(req.user.id);
        sendSuccess(res, { user }, 'Profile retrieved successfully');
    });

    // Update user profile
    static updateProfile = catchAsync(async (req, res) => {
        const updatedUser = await UserService.updateUserProfile(req.user.id, req.body);
        sendSuccess(res, { user: updatedUser }, 'Profile updated successfully');
    });

    // Get verification status
    static getVerificationStatus = catchAsync(async (req, res) => {
        const status = await UserService.getVerificationStatus(req.user.id);
        sendSuccess(res, status, 'Verification status retrieved');
    });

    // Send email verification
    static sendEmailVerification = catchAsync(async (req, res) => {
        const result = await UserService.resendEmailVerification(req.user.id);
        sendSuccess(res, result, 'Email verification link sent');
    });

    // Verify email (called from email link)
    static verifyEmail = catchAsync(async (req, res) => {
        // In a real implementation, you'd decode the token to get user ID
        // For now, we'll expect user_id in query params
        const { user_id } = req.query;
        
        if (!user_id) {
            return sendError(res, 'Invalid verification link', 400);
        }

        const result = await UserService.verifyEmail(parseInt(user_id));
        
        // Redirect to frontend with success message
        res.redirect(`${process.env.FRONTEND_URL}/verify-email-success?verified=true`);
    });

    // Send mobile OTP
    static sendMobileOTP = catchAsync(async (req, res) => {
        const result = await UserService.sendMobileOTP(req.user.id);
        sendSuccess(res, result, 'OTP sent to your mobile number');
    });

    // Verify mobile OTP
    static verifyMobileOTP = catchAsync(async (req, res) => {
        const { otp, verification_id } = req.body;
        const result = await UserService.verifyMobileOTP(req.user.id, otp, verification_id);
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

        const result = await UserService.changePassword(req.user.id, current_password, new_password);
        sendSuccess(res, result, 'Password changed successfully');
    });

    // Forgot password (initiate reset)
    static forgotPassword = catchAsync(async (req, res) => {
        const { email } = req.body;
        
        if (!email) {
            return sendError(res, 'Email is required', 400);
        }

        // For demo purposes, we'll just send success
        // In production, you'd send a reset link via email
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

        // For demo purposes, we'll just send success
        // In production, you'd verify the token and update password
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

        // Verify password before deletion
        const UserModel = require('../models/userModel');
        const user = await UserModel.findById(req.user.id);
        const isPasswordValid = await UserModel.verifyPassword(password, user.password);
        
        if (!isPasswordValid) {
            return sendError(res, 'Incorrect password', 401);
        }

        const result = await UserService.deleteAccount(req.user.id);
        
        // Clear cookie
        res.clearCookie('token');
        
        sendSuccess(res, result, 'Account deleted successfully');
    });

    // Logout (clear token)
    static logout = catchAsync(async (req, res) => {
        res.clearCookie('token');
        sendSuccess(res, null, 'Logged out successfully');
    });
}

module.exports = AuthController;