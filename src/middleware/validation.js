// src/middleware/validation.js
const { body, validationResult } = require('express-validator');
const sanitizeHtml = require('sanitize-html');
const { parsePhoneNumber } = require('libphonenumber-js');
const { AppError } = require('../utils/errorHandler');

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

// Company profile validation
const validateCompanyProfile = [
    body('company_name')
        .isLength({ min: 2, max: 200 })
        .withMessage('Company name must be between 2 and 200 characters')
        .matches(/^[a-zA-Z0-9\s&.,'-]+$/)
        .withMessage('Company name contains invalid characters'),

    body('address')
        .isLength({ min: 5, max: 500 })
        .withMessage('Address must be between 5 and 500 characters'),

    body('city')
        .isLength({ min: 2, max: 50 })
        .withMessage('City must be between 2 and 50 characters')
        .matches(/^[a-zA-Z\s.-]+$/)
        .withMessage('City name contains invalid characters'),

    body('state')
        .isLength({ min: 2, max: 50 })
        .withMessage('State must be between 2 and 50 characters')
        .matches(/^[a-zA-Z\s.-]+$/)
        .withMessage('State name contains invalid characters'),

    body('country')
        .isLength({ min: 2, max: 50 })
        .withMessage('Country must be between 2 and 50 characters')
        .matches(/^[a-zA-Z\s.-]+$/)
        .withMessage('Country name contains invalid characters'),

    body('postal_code')
        .isLength({ min: 3, max: 20 })
        .withMessage('Postal code must be between 3 and 20 characters')
        .matches(/^[a-zA-Z0-9\s-]+$/)
        .withMessage('Invalid postal code format'),

    body('website')
        .optional()
        .isURL({ protocols: ['http', 'https'], require_protocol: true })
        .withMessage('Please provide a valid website URL'),

    body('industry')
        .isLength({ min: 2, max: 100 })
        .withMessage('Industry must be between 2 and 100 characters'),

    body('founded_date')
        .optional()
        .isISO8601()
        .withMessage('Founded date must be a valid date')
        .custom((value) => {
            const date = new Date(value);
            const currentDate = new Date();
            if (date > currentDate) {
                throw new Error('Founded date cannot be in the future');
            }
            return true;
        }),

    body('description')
        .optional()
        .isLength({ max: 1000 })
        .withMessage('Description must not exceed 1000 characters'),

    body('social_links')
        .optional()
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

            // Validate common social media platforms
            const allowedPlatforms = ['facebook', 'twitter', 'linkedin', 'instagram', 'youtube', 'website'];
            const urlPattern = /^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)$/;

            for (const [platform, url] of Object.entries(value)) {
                if (!allowedPlatforms.includes(platform.toLowerCase())) {
                    throw new Error(`Unsupported social platform: ${platform}`);
                }
                if (!urlPattern.test(url)) {
                    throw new Error(`Invalid URL for ${platform}`);
                }
            }
            
            return true;
        }),

    sanitizeInput,
    handleValidationErrors
];

// Company profile update validation (optional fields)
const validateCompanyProfileUpdate = [
    body('company_name')
        .optional()
        .isLength({ min: 2, max: 200 })
        .withMessage('Company name must be between 2 and 200 characters')
        .matches(/^[a-zA-Z0-9\s&.,'-]+$/)
        .withMessage('Company name contains invalid characters'),

    body('address')
        .optional()
        .isLength({ min: 5, max: 500 })
        .withMessage('Address must be between 5 and 500 characters'),

    body('city')
        .optional()
        .isLength({ min: 2, max: 50 })
        .withMessage('City must be between 2 and 50 characters')
        .matches(/^[a-zA-Z\s.-]+$/)
        .withMessage('City name contains invalid characters'),

    body('state')
        .optional()
        .isLength({ min: 2, max: 50 })
        .withMessage('State must be between 2 and 50 characters')
        .matches(/^[a-zA-Z\s.-]+$/)
        .withMessage('State name contains invalid characters'),

    body('country')
        .optional()
        .isLength({ min: 2, max: 50 })
        .withMessage('Country must be between 2 and 50 characters')
        .matches(/^[a-zA-Z\s.-]+$/)
        .withMessage('Country name contains invalid characters'),

    body('postal_code')
        .optional()
        .isLength({ min: 3, max: 20 })
        .withMessage('Postal code must be between 3 and 20 characters')
        .matches(/^[a-zA-Z0-9\s-]+$/)
        .withMessage('Invalid postal code format'),

    body('website')
        .optional()
        .isURL({ protocols: ['http', 'https'], require_protocol: true })
        .withMessage('Please provide a valid website URL'),

    body('industry')
        .optional()
        .isLength({ min: 2, max: 100 })
        .withMessage('Industry must be between 2 and 100 characters'),

    body('founded_date')
        .optional()
        .isISO8601()
        .withMessage('Founded date must be a valid date')
        .custom((value) => {
            const date = new Date(value);
            const currentDate = new Date();
            if (date > currentDate) {
                throw new Error('Founded date cannot be in the future');
            }
            return true;
        }),

    body('description')
        .optional()
        .isLength({ max: 1000 })
        .withMessage('Description must not exceed 1000 characters'),

    body('social_links')
        .optional()
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

            const allowedPlatforms = ['facebook', 'twitter', 'linkedin', 'instagram', 'youtube', 'website'];
            const urlPattern = /^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)$/;

            for (const [platform, url] of Object.entries(value)) {
                if (!allowedPlatforms.includes(platform.toLowerCase())) {
                    throw new Error(`Unsupported social platform: ${platform}`);
                }
                if (!urlPattern.test(url)) {
                    throw new Error(`Invalid URL for ${platform}`);
                }
            }
            
            return true;
        }),

    sanitizeInput,
    handleValidationErrors
];

// Mobile OTP validation
const validateMobileOTP = [
    body('otp')
        .isLength({ min: 6, max: 6 })
        .withMessage('OTP must be exactly 6 digits')
        .isNumeric()
        .withMessage('OTP must contain only numbers'),

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

    sanitizeInput,
    handleValidationErrors
];

// Image upload validation
const validateImageUpload = (req, res, next) => {
    if (!req.file) {
        return next(new AppError('Please select an image to upload', 400));
    }

    // Check file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(req.file.mimetype)) {
        return next(new AppError('Only JPEG, PNG, and WebP images are allowed', 400));
    }

    // Check file size (5MB limit)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (req.file.size > maxSize) {
        return next(new AppError('Image size should not exceed 5MB', 400));
    }

    next();
};

module.exports = {
    validateUserRegistration,
    validateUserLogin,
    validateCompanyProfile,
    validateCompanyProfileUpdate,
    validateMobileOTP,
    validateImageUpload,
    sanitizeInput,
    handleValidationErrors
};