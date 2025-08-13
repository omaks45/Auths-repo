
const express = require('express');
const router = express.Router();

// Import controllers
const AuthController = require('../controllers/authController');

// Import middleware
const { protect } = require('../middleware/auth');
const {
    validateUserRegistration,
    validateUserLogin,
    validateMobileOTP
} = require('../middleware/validation');

// Public routes
router.post('/register', validateUserRegistration, AuthController.register);
router.post('/login', validateUserLogin, AuthController.login);

// Protected routes (require authentication)
router.get('/profile', protect, AuthController.getProfile);
router.put('/profile', protect, AuthController.updateProfile);
router.get('/verification-status', protect, AuthController.getVerificationStatus);

// Email verification routes
router.post('/send-email-verification', protect, AuthController.sendEmailVerification);
router.get('/verify-email/:token', AuthController.verifyEmail); // This will be called from email link

// Mobile verification routes
router.post('/send-mobile-otp', protect, AuthController.sendMobileOTP);
router.post('/verify-mobile-otp', protect, validateMobileOTP, AuthController.verifyMobileOTP);

// Password management
router.post('/change-password', protect, AuthController.changePassword);
router.post('/forgot-password', AuthController.forgotPassword);
router.post('/reset-password', AuthController.resetPassword);

// Account management
router.delete('/delete-account', protect, AuthController.deleteAccount);

// Health check for auth service
router.get('/health', (req, res) => {
    res.json({ 
        service: 'auth',
        status: 'OK', 
        timestamp: new Date().toISOString() 
    });
});

module.exports = router;