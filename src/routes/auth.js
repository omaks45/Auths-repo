const express = require('express');
const router = express.Router();

// Safely import database configuration with error handling
let dbConfig = null;
try {
    console.log('About to import database config...');
    dbConfig = require('../config/database');
    console.log('✅ Database config imported successfully');
    console.log('Database config type:', typeof dbConfig);
    console.log('Available properties:', Object.keys(dbConfig));
    console.log('query function:', typeof dbConfig.query);
} catch (error) {
    console.error('❌ Failed to import database config:', error.message);
}

// Import controllers
const AuthController = require('../controllers/authController');

// Import middleware
const { protect } = require('../middleware/auth');
const {
    validateUserRegistration,
    validateUserLogin,
    validateMobileOTP
} = require('../middleware/validation');

// Make database functions available to controllers if database config was loaded
if (dbConfig && dbConfig.query && dbConfig.getClient && dbConfig.pool) {
    router.use((req, res, next) => {
        req.db = {
            query: dbConfig.query,
            getClient: dbConfig.getClient,
            pool: dbConfig.pool
        };
        next();
    });
    console.log('✅ Database middleware added to auth routes');
} else {
    console.warn('⚠️ Database config incomplete, skipping database middleware');
}

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
router.get('/health', async (req, res) => {
    if (dbConfig && dbConfig.query) {
        try {
            // Test database connection in health check
            const dbResult = await dbConfig.query('SELECT NOW() as current_time');
            
            res.json({ 
                service: 'auth',
                status: 'OK', 
                database: 'connected',
                timestamp: new Date().toISOString(),
                db_time: dbResult.rows[0].current_time
            });
        } catch (error) {
            res.status(500).json({
                service: 'auth',
                status: 'ERROR',
                database: 'disconnected',
                error: error.message,
                timestamp: new Date().toISOString()
            });
        }
    } else {
        res.json({ 
            service: 'auth',
            status: 'OK (DB disabled)', 
            database: 'not_configured',
            timestamp: new Date().toISOString()
        });
    }
});

module.exports = router;