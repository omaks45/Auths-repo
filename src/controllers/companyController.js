const CompanyService = require('../services/companyService');
const CloudinaryService = require('../services/cloudinaryService');
const createError = require('http-errors');
const { validationResult } = require('express-validator');

class CompanyController {
    /**
     * Register a new company profile
     * POST /api/company/register
     */
    static async register(req, res, next) {
        try {
            // Check validation errors
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    message: 'Validation failed',
                    errors: errors.array()
                });
            }
            
            const userId = req.user.id;
            const profileData = req.body;
            
            // Create company profile
            const companyProfile = await CompanyService.createCompanyProfile(userId, profileData);
            
            res.status(201).json({
                success: true,
                message: 'Company profile created successfully',
                data: {
                    company: companyProfile
                }
            });
            
        } catch (error) {
            next(error);
        }
    }
    
    /**
     * Get company profile
     * GET /api/company/profile
     */
    static async getProfile(req, res, next) {
        try {
            const userId = req.user.id;
            
            const companyProfile = await CompanyService.getCompanyProfileByUserId(userId);
            
            if (!companyProfile) {
                throw createError(404, 'Company profile not found');
            }
            
            res.json({
                success: true,
                message: 'Company profile retrieved successfully',
                data: {
                    company: companyProfile
                }
            });
            
        } catch (error) {
            next(error);
        }
    }
    
    /**
     * Update company profile
     * PUT /api/company/profile
     */
    static async updateProfile(req, res, next) {
        try {
            // Check validation errors
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    message: 'Validation failed',
                    errors: errors.array()
                });
            }
            
            const userId = req.user.id;
            const updateData = req.body;
            
            // If company name is being updated, check availability
            if (updateData.company_name) {
                const isAvailable = await CompanyService.isCompanyNameAvailable(
                    updateData.company_name, 
                    userId
                );
                if (!isAvailable) {
                    throw createError(409, 'Company name already exists');
                }
            }
            
            const updatedProfile = await CompanyService.updateCompanyProfile(userId, updateData);
            
            res.json({
                success: true,
                message: 'Company profile updated successfully',
                data: {
                    company: updatedProfile
                }
            });
            
        } catch (error) {
            next(error);
        }
    }
    
    /**
     * Delete company profile
     * DELETE /api/company/profile
     */
    static async deleteProfile(req, res, next) {
        try {
            const userId = req.user.id;
            
            const result = await CompanyService.deleteCompanyProfile(userId);
            
            // Clean up old images from Cloudinary if they exist
            const promises = [];
            if (result.oldImageUrls.logo_url) {
                promises.push(CloudinaryService.deleteImage(result.oldImageUrls.logo_url));
            }
            if (result.oldImageUrls.banner_url) {
                promises.push(CloudinaryService.deleteImage(result.oldImageUrls.banner_url));
            }
            
            // Execute deletions in parallel (don't wait for completion)
            if (promises.length > 0) {
                Promise.allSettled(promises).catch(console.error);
            }
            
            res.json({
                success: true,
                message: 'Company profile deleted successfully'
            });
            
        } catch (error) {
            next(error);
        }
    }
    
    /**
     * Upload company logo
     * POST /api/company/upload-logo
     */
    static async uploadLogo(req, res, next) {
        try {
            // Check validation errors
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    message: 'Validation failed',
                    errors: errors.array()
                });
            }
            
            const userId = req.user.id;
            
            if (!req.file) {
                throw createError(400, 'No image file provided');
            }
            
            // Get current profile to delete old logo if exists
            const currentProfile = await CompanyService.getCompanyProfileByUserId(userId);
            if (!currentProfile) {
                throw createError(404, 'Company profile not found. Please create a profile first.');
            }
            
            const oldLogoUrl = currentProfile.logo_url;
            
            // Upload new logo to Cloudinary
            const uploadOptions = {
                folder: 'company-logos',
                transformation: [
                    { width: 500, height: 500, crop: 'limit', quality: 'auto:best' },
                    { fetch_format: 'auto' }
                ]
            };
            
            const uploadResult = await CloudinaryService.uploadImage(req.file, uploadOptions);
            
            // Update database with new logo URL
            const updatedProfile = await CompanyService.updateCompanyImage(
                userId, 
                'logo_url', 
                uploadResult.secure_url
            );
            
            // Delete old logo from Cloudinary (async, don't wait)
            if (oldLogoUrl) {
                CloudinaryService.deleteImage(oldLogoUrl).catch(console.error);
            }
            
            res.json({
                success: true,
                message: 'Company logo uploaded successfully',
                data: {
                    logo_url: uploadResult.secure_url,
                    public_id: uploadResult.public_id
                }
            });
            
        } catch (error) {
            next(error);
        }
    }
    
    /**
     * Upload company banner
     * POST /api/company/upload-banner
     */
    static async uploadBanner(req, res, next) {
        try {
            // Check validation errors
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    message: 'Validation failed',
                    errors: errors.array()
                });
            }
            
            const userId = req.user.id;
            
            if (!req.file) {
                throw createError(400, 'No image file provided');
            }
            
            // Get current profile to delete old banner if exists
            const currentProfile = await CompanyService.getCompanyProfileByUserId(userId);
            if (!currentProfile) {
                throw createError(404, 'Company profile not found. Please create a profile first.');
            }
            
            const oldBannerUrl = currentProfile.banner_url;
            
            // Upload new banner to Cloudinary
            const uploadOptions = {
                folder: 'company-banners',
                transformation: [
                    { width: 1200, height: 400, crop: 'limit', quality: 'auto:best' },
                    { fetch_format: 'auto' }
                ]
            };
            
            const uploadResult = await CloudinaryService.uploadImage(req.file, uploadOptions);
            
            // Update database with new banner URL
            const updatedProfile = await CompanyService.updateCompanyImage(
                userId, 
                'banner_url', 
                uploadResult.secure_url
            );
            
            // Delete old banner from Cloudinary (async, don't wait)
            if (oldBannerUrl) {
                CloudinaryService.deleteImage(oldBannerUrl).catch(console.error);
            }
            
            res.json({
                success: true,
                message: 'Company banner uploaded successfully',
                data: {
                    banner_url: uploadResult.secure_url,
                    public_id: uploadResult.public_id
                }
            });
            
        } catch (error) {
            next(error);
        }
    }
    
    /**
     * Search companies with filters and pagination
     * GET /api/company/search
     */
    static async searchCompanies(req, res, next) {
        try {
            const filters = {
                search: req.query.search || '',
                industry: req.query.industry || '',
                city: req.query.city || '',
                state: req.query.state || '',
                country: req.query.country || ''
            };
            
            const pagination = {
                page: parseInt(req.query.page) || 1,
                limit: Math.min(parseInt(req.query.limit) || 10, 50), // Max 50 per page
                sortBy: req.query.sortBy || 'created_at',
                sortOrder: req.query.sortOrder || 'DESC'
            };
            
            const result = await CompanyService.searchCompanies(filters, pagination);
            
            res.json({
                success: true,
                message: 'Companies retrieved successfully',
                data: result
            });
            
        } catch (error) {
            next(error);
        }
    }
    
    /**
     * Get company statistics
     * GET /api/company/stats
     */
    static async getStats(req, res, next) {
        try {
            const stats = await CompanyService.getCompanyStats();
            
            res.json({
                success: true,
                message: 'Company statistics retrieved successfully',
                data: {
                    stats
                }
            });
            
        } catch (error) {
            next(error);
        }
    }
}

module.exports = CompanyController;