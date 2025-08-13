const express = require('express');
const multer = require('multer');
const router = express.Router();

// Import database configuration
const { query, getClient, pool } = require('../config/database');

// Import controllers
const CompanyController = require('../controllers/companyController');

// Import middleware
const { protect } = require('../middleware/auth');
const { 
    validateCompanyProfile, 
    validateCompanyProfileUpdate,
    validateImageUpload 
} = require('../middleware/validation');

// Configure multer for memory storage (since we're using Cloudinary)
const storage = multer.memoryStorage();
const upload = multer({
    storage,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB limit
    },
    fileFilter: (req, file, cb) => {
        // Check file type
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed'), false);
        }
    }
});

// Make database functions available to all routes
router.use((req, res, next) => {
    req.db = { query, getClient, pool };
    next();
});

// All routes are protected (require authentication)
router.use(protect);

// Company profile routes
router.post('/register', validateCompanyProfile, CompanyController.register);
router.get('/profile', CompanyController.getProfile);
router.put('/profile', validateCompanyProfileUpdate, CompanyController.updateProfile);
router.delete('/profile', CompanyController.deleteProfile);

// Image upload routes - ADD MULTER MIDDLEWARE
router.post('/upload-logo', 
    upload.single('logo'), // This processes the file upload
    validateImageUpload, 
    CompanyController.uploadLogo
);

router.post('/upload-banner', 
    upload.single('banner'), // This processes the file upload
    validateImageUpload, 
    CompanyController.uploadBanner
);

// Company search and listing (for admin or public use)
router.get('/search', CompanyController.searchCompanies);
router.get('/stats', CompanyController.getStats);

// Health check
router.get('/health', async (req, res) => {
    try {
        // Test database connection in health check
        const dbResult = await query('SELECT NOW() as current_time');
        
        res.json({ 
            service: 'company',
            status: 'OK', 
            user: req.user ? req.user.email : 'unknown',
            database: 'connected',
            timestamp: new Date().toISOString(),
            db_time: dbResult.rows[0].current_time
        });
    } catch (error) {
        res.status(500).json({
            service: 'company',
            status: 'ERROR',
            user: req.user ? req.user.email : 'unknown',
            database: 'disconnected',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

module.exports = router;