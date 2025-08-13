
const express = require('express');
const router = express.Router();

// Import controllers
const CompanyController = require('../controllers/companyController');

// Import middleware
const { protect } = require('../middleware/auth');
const { 
    validateCompanyProfile, 
    validateCompanyProfileUpdate,
    validateImageUpload 
} = require('../middleware/validation');

// All routes are protected (require authentication)
router.use(protect);

// Company profile routes
router.post('/register', validateCompanyProfile, CompanyController.register);
router.get('/profile', CompanyController.getProfile);
router.put('/profile', validateCompanyProfileUpdate, CompanyController.updateProfile);
router.delete('/profile', CompanyController.deleteProfile);

// Image upload routes (we'll implement these with Cloudinary)
router.post('/upload-logo', validateImageUpload, CompanyController.uploadLogo);
router.post('/upload-banner', validateImageUpload, CompanyController.uploadBanner);

// Company search and listing (for admin or public use)
router.get('/search', CompanyController.searchCompanies);
router.get('/stats', CompanyController.getStats);

// Health check
router.get('/health', (req, res) => {
    res.json({ 
        service: 'company',
        status: 'OK', 
        user: req.user.email,
        timestamp: new Date().toISOString() 
    });
});

module.exports = router;