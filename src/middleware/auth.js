
const { verifyToken, getTokenFromHeader } = require('../utils/jwt');
const { AppError, catchAsync } = require('../utils/errorHandler');
const UserModel = require('../models/userModel');

// Protect routes - require valid JWT
const protect = catchAsync(async (req, res, next) => {
    // Get token from header
    const token = getTokenFromHeader(req);
    
    if (!token) {
        return next(new AppError('Access denied. No token provided', 401));
    }

    try {
        // Verify token
        const decoded = verifyToken(token);
        
        // Get user from database
        const user = await UserModel.findById(decoded.id);
        if (!user) {
            return next(new AppError('Token is valid but user no longer exists', 401));
        }

        // Add user to request
        req.user = user;
        next();
    } catch (error) {
        return next(new AppError(error.message, 401));
    }
});

// Optional authentication - don't require token
const optionalAuth = catchAsync(async (req, res, next) => {
    const token = getTokenFromHeader(req);
    
    if (token) {
        try {
            const decoded = verifyToken(token);
            const user = await UserModel.findById(decoded.id);
            req.user = user;
        } catch (error) {
            // Ignore token errors for optional auth
            console.log('Optional auth token error:', error.message);
        }
    }
    
    next();
});

// Check if user has verified email
const requireEmailVerification = (req, res, next) => {
    if (!req.user.is_email_verified) {
        return next(new AppError('Please verify your email before proceeding', 403));
    }
    next();
};

// Check if user has verified mobile
const requireMobileVerification = (req, res, next) => {
    if (!req.user.is_mobile_verified) {
        return next(new AppError('Please verify your mobile number before proceeding', 403));
    }
    next();
};

module.exports = {
    protect,
    optionalAuth,
    requireEmailVerification,
    requireMobileVerification
};