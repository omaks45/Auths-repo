const { body, validationResult } = require('express-validator');
const sanitizeHtml = require('sanitize-html');
const { parsePhoneNumber } = require('libphonenumber-js');
const { AppError } = require('../utils/errorHandler');
const multer = require('multer');
const CloudinaryService = require('../services/cloudinaryService');
const createError = require('http-errors');


// Configure multer for memory storage
const storage = multer.memoryStorage();

const upload = multer({
    storage,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB limit
        files: 1 // Only one file at a time
    },
    fileFilter: (req, file, cb) => {
        // Validate file type
        const allowedMimeTypes = [
            'image/jpeg',
            'image/jpg',
            'image/png',
            'image/webp',
            'image/gif'
        ];
        
        if (allowedMimeTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(createError(400, 'Invalid file type. Please upload a valid image file'), false);
        }
    }
}).single('image');


// Handle validation errors
const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        const errorMessages = errors.array().map(error => ({
            field: error.path,
            message: error.msg
        }));
        return next(new AppError('Validation failed', 400, { errors: errorMessages }));
    }
    next();
};

// Sanitize HTML in text fields
const sanitizeInput = (req, res, next) => {
    const sanitizeOptions = {
        allowedTags: [],
        allowedAttributes: {},
        disallowedTagsMode: 'discard'
    };

    // Sanitize string fields in body
    for (const [key, value] of Object.entries(req.body)) {
        if (typeof value === 'string') {
            req.body[key] = sanitizeHtml(value.trim(), sanitizeOptions);
        }
    }

    next();
};

// User registration validation
const validateUserRegistration = [
    body('email')
        .isEmail()
        .normalizeEmail()
        .withMessage('Please provide a valid email address')
        .isLength({ max: 255 })
        .withMessage('Email must not exceed 255 characters'),

    body('password')
        .isLength({ min: 8 })
        .withMessage('Password must be at least 8 characters long')
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
        .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),

    body('full_name')
        .isLength({ min: 2, max: 255 })
        .withMessage('Full name must be between 2 and 255 characters')
        .matches(/^[a-zA-Z\s]+$/)
        .withMessage('Full name can only contain letters and spaces'),

    body('gender')
        .isIn(['m', 'f', 'o'])
        .withMessage('Gender must be m (male), f (female), or o (other)'),

    body('mobile_no')
        .custom((value) => {
            try {
                const phoneNumber = parsePhoneNumber(value);
                if (!phoneNumber || !phoneNumber.isValid()) {
                    throw new Error('Invalid phone number format');
                }
                return true;
            } catch (error) {
                throw new Error('Invalid phone number format');
            }
        }),

    body('signup_type')
        .optional()
        .isIn(['e'])
        .withMessage('Signup type must be e (email)'),

    sanitizeInput,
    handleValidationErrors
];

// User login validation
const validateUserLogin = [
    body('email')
        .isEmail()
        .normalizeEmail()
        .withMessage('Please provide a valid email address'),

    body('password')
        .notEmpty()
        .withMessage('Password is required'),

    sanitizeInput,
    handleValidationErrors
];

/**
 * Company profile validation rules
 */
const validateCompanyProfile = [
    body('company_name')
        .notEmpty()
        .withMessage('Company name is required')
        .isLength({ min: 2, max: 100 })
        .withMessage('Company name must be between 2 and 100 characters')
        .trim()
        .escape(),
    
    body('address')
        .notEmpty()
        .withMessage('Address is required')
        .isLength({ min: 5, max: 200 })
        .withMessage('Address must be between 5 and 200 characters')
        .trim(),
    
    body('city')
        .notEmpty()
        .withMessage('City is required')
        .isLength({ min: 2, max: 50 })
        .withMessage('City must be between 2 and 50 characters')
        .trim()
        .escape(),
    
    body('state')
        .notEmpty()
        .withMessage('State is required')
        .isLength({ min: 2, max: 50 })
        .withMessage('State must be between 2 and 50 characters')
        .trim()
        .escape(),
    
    body('country')
        .notEmpty()
        .withMessage('Country is required')
        .isLength({ min: 2, max: 50 })
        .withMessage('Country must be between 2 and 50 characters')
        .trim()
        .escape(),
    
    body('postal_code')
        .notEmpty()
        .withMessage('Postal code is required')
        .isLength({ min: 3, max: 20 })
        .withMessage('Postal code must be between 3 and 20 characters')
        .trim()
        .escape(),
    
    body('website')
        .optional({ nullable: true, checkFalsy: true })
        .isURL({ 
            protocols: ['http', 'https'],
            require_protocol: true 
        })
        .withMessage('Please provide a valid website URL')
        .normalizeEmail(),
    
    body('industry')
        .notEmpty()
        .withMessage('Industry is required')
        .isLength({ min: 2, max: 50 })
        .withMessage('Industry must be between 2 and 50 characters')
        .trim()
        .escape(),
    
    body('founded_date')
        .optional({ nullable: true, checkFalsy: true })
        .isISO8601()
        .withMessage('Please provide a valid founded date')
        .custom((value) => {
            const foundedDate = new Date(value);
            const currentDate = new Date();
            const minDate = new Date('1800-01-01');
            
            if (foundedDate > currentDate) {
                throw new Error('Founded date cannot be in the future');
            }
            if (foundedDate < minDate) {
                throw new Error('Founded date seems too old');
            }
            return true;
        }),
    
    body('description')
        .optional({ nullable: true, checkFalsy: true })
        .isLength({ max: 1000 })
        .withMessage('Description must not exceed 1000 characters')
        .trim(),
    
    body('social_links')
        .optional({ nullable: true, checkFalsy: true })
        .custom((value) => {
            if (typeof value === 'string') {
                try {
                    value = JSON.parse(value);
                } catch (error) {
                    throw new Error('Social links must be valid JSON');
                }
            }
            
            if (typeof value !== 'object' || Array.isArray(value)) {
                throw new Error('Social links must be an object');
            }
            
            // Validate social media URLs
            const allowedPlatforms = [
                'facebook', 'twitter', 'linkedin', 'instagram', 
                'youtube', 'github', 'website'
            ];
            
            for (const [platform, url] of Object.entries(value)) {
                if (!allowedPlatforms.includes(platform.toLowerCase())) {
                    throw new Error(`Invalid social media platform: ${platform}`);
                }
                
                if (url && typeof url === 'string') {
                    try {
                        new URL(url); // Validate URL format
                    } catch (error) {
                        throw new Error(`Invalid URL for ${platform}: ${url}`);
                    }
                }
            }
            
            return true;
        })
];

/**
 * Company profile update validation rules
 */
const validateCompanyProfileUpdate = [
    body('company_name')
        .optional()
        .isLength({ min: 2, max: 100 })
        .withMessage('Company name must be between 2 and 100 characters')
        .trim()
        .escape(),
    
    body('address')
        .optional()
        .isLength({ min: 5, max: 200 })
        .withMessage('Address must be between 5 and 200 characters')
        .trim(),
    
    body('city')
        .optional()
        .isLength({ min: 2, max: 50 })
        .withMessage('City must be between 2 and 50 characters')
        .trim()
        .escape(),
    
    body('state')
        .optional()
        .isLength({ min: 2, max: 50 })
        .withMessage('State must be between 2 and 50 characters')
        .trim()
        .escape(),
    
    body('country')
        .optional()
        .isLength({ min: 2, max: 50 })
        .withMessage('Country must be between 2 and 50 characters')
        .trim()
        .escape(),
    
    body('postal_code')
        .optional()
        .isLength({ min: 3, max: 20 })
        .withMessage('Postal code must be between 3 and 20 characters')
        .trim()
        .escape(),
    
    body('website')
        .optional({ nullable: true, checkFalsy: true })
        .isURL({ 
            protocols: ['http', 'https'],
            require_protocol: true 
        })
        .withMessage('Please provide a valid website URL'),
    
    body('industry')
        .optional()
        .isLength({ min: 2, max: 50 })
        .withMessage('Industry must be between 2 and 50 characters')
        .trim()
        .escape(),
    
    body('founded_date')
        .optional({ nullable: true, checkFalsy: true })
        .isISO8601()
        .withMessage('Please provide a valid founded date')
        .custom((value) => {
            if (!value) return true;
            
            const foundedDate = new Date(value);
            const currentDate = new Date();
            const minDate = new Date('1800-01-01');
            
            if (foundedDate > currentDate) {
                throw new Error('Founded date cannot be in the future');
            }
            if (foundedDate < minDate) {
                throw new Error('Founded date seems too old');
            }
            return true;
        }),
    
    body('description')
        .optional({ nullable: true, checkFalsy: true })
        .isLength({ max: 1000 })
        .withMessage('Description must not exceed 1000 characters')
        .trim(),
    
    body('social_links')
        .optional({ nullable: true, checkFalsy: true })
        .custom((value) => {
            if (!value) return true;
            
            if (typeof value === 'string') {
                try {
                    value = JSON.parse(value);
                } catch (error) {
                    throw new Error('Social links must be valid JSON');
                }
            }
            
            if (typeof value !== 'object' || Array.isArray(value)) {
                throw new Error('Social links must be an object');
            }
            
            const allowedPlatforms = [
                'facebook', 'twitter', 'linkedin', 'instagram', 
                'youtube', 'github', 'website'
            ];
            
            for (const [platform, url] of Object.entries(value)) {
                if (!allowedPlatforms.includes(platform.toLowerCase())) {
                    throw new Error(`Invalid social media platform: ${platform}`);
                }
                
                if (url && typeof url === 'string') {
                    try {
                        new URL(url);
                    } catch (error) {
                        throw new Error(`Invalid URL for ${platform}: ${url}`);
                    }
                }
            }
            
            return true;
        }),
    
    // Ensure at least one field is being updated
    body()
        .custom((value, { req }) => {
            const updateFields = [
                'company_name', 'address', 'city', 'state', 'country',
                'postal_code', 'website', 'industry', 'founded_date',
                'description', 'social_links'
            ];
            
            const hasUpdateField = updateFields.some(field => 
                req.body.hasOwnProperty(field) && req.body[field] !== undefined
            );
            
            if (!hasUpdateField) {
                throw new Error('At least one field must be provided for update');
            }
            
            return true;
        })
];

/**
 * Image upload validation middleware
 */
const validateImageUpload = (req, res, next) => {
    upload(req, res, (err) => {
        if (err instanceof multer.MulterError) {
            if (err.code === 'LIMIT_FILE_SIZE') {
                return next(createError(400, 'File too large. Maximum size is 5MB'));
            }
            if (err.code === 'LIMIT_FILE_COUNT') {
                return next(createError(400, 'Too many files. Only one file is allowed'));
            }
            return next(createError(400, `Upload error: ${err.message}`));
        } else if (err) {
            return next(err);
        }
        
        // Additional validation using CloudinaryService
        if (req.file) {
            const validation = CloudinaryService.validateImageFile(req.file, {
                maxSize: 5 * 1024 * 1024, // 5MB
                allowedFormats: ['jpg', 'jpeg', 'png', 'webp'],
                minWidth: 100,
                minHeight: 100,
                maxWidth: 4000,
                maxHeight: 4000
            });
            
            if (!validation.isValid) {
                return next(createError(400, validation.errors.join(', ')));
            }
        }
        
        next();
    });
};

/**
 * Search query validation
 */
const validateSearchQuery = [
    query('page')
        .optional()
        .isInt({ min: 1 })
        .withMessage('Page must be a positive integer')
        .toInt(),
    
    query('limit')
        .optional()
        .isInt({ min: 1, max: 50 })
        .withMessage('Limit must be between 1 and 50')
        .toInt(),
    
    query('search')
        .optional()
        .isLength({ max: 100 })
        .withMessage('Search query must not exceed 100 characters')
        .trim(),
    
    query('industry')
        .optional()
        .isLength({ max: 50 })
        .withMessage('Industry filter must not exceed 50 characters')
        .trim(),
    
    query('city')
        .optional()
        .isLength({ max: 50 })
        .withMessage('City filter must not exceed 50 characters')
        .trim(),
    
    query('state')
        .optional()
        .isLength({ max: 50 })
        .withMessage('State filter must not exceed 50 characters')
        .trim(),
    
    query('country')
        .optional()
        .isLength({ max: 50 })
        .withMessage('Country filter must not exceed 50 characters')
        .trim(),
    
    query('sortBy')
        .optional()
        .isIn([
            'company_name', 'city', 'state', 'country', 
            'industry', 'created_at', 'updated_at'
        ])
        .withMessage('Invalid sort field'),
    
    query('sortOrder')
        .optional()
        .isIn(['ASC', 'DESC', 'asc', 'desc'])
        .withMessage('Sort order must be ASC or DESC')
];

/**
 * Sanitize company data middleware
 */
const sanitizeCompanyData = (req, res, next) => {
    if (req.body.social_links && typeof req.body.social_links === 'string') {
        try {
            req.body.social_links = JSON.parse(req.body.social_links);
        } catch (error) {
            // Will be caught by validation
        }
    }
    
    // Convert empty strings to null for optional fields
    const optionalFields = ['website', 'founded_date', 'description', 'social_links'];
    optionalFields.forEach(field => {
        if (req.body[field] === '') {
            req.body[field] = null;
        }
    });
    
    next();
};

module.exports = {
    validateCompanyProfile: [...validateCompanyProfile, sanitizeCompanyData],
    validateCompanyProfileUpdate: [...validateCompanyProfileUpdate, sanitizeCompanyData],
    validateImageUpload,
    validateSearchQuery,
    sanitizeCompanyData
};