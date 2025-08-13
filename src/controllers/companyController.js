// src/controllers/companyController.js
const CompanyService = require('../services/companyService');
const CloudinaryService = require('../services/cloudinaryService');
const { query, getClient, pool } = require('../config/database');
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
            
            // Check if company profile already exists
            const existingProfile = await query(
                'SELECT id FROM company_profile WHERE user_id = $1',
                [userId]
            );
            
            if (existingProfile.rows.length > 0) {
                throw createError(409, 'Company profile already exists for this user');
            }
            
            // Create company profile with database functions
            const companyProfile = await CompanyService.createCompanyProfile(
                userId, 
                profileData, 
                { query, getClient }
            );
            
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
            
            // Direct database query with joins for complete profile
            const profileResult = await query(`
                SELECT 
                    cp.*,
                    u.email,
                    u.created_at as user_created_at
                FROM company_profile cp
                JOIN users u ON cp.user_id = u.id
                WHERE cp.user_id = $1
            `, [userId]);
            
            if (profileResult.rows.length === 0) {
                throw createError(404, 'Company profile not found');
            }
            
            const companyProfile = profileResult.rows[0];
            
            // Add calculated fields
            companyProfile.profile_completion = calculateProfileCompletion(companyProfile);
            
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
        const client = await getClient();
        
        try {
            await client.query('BEGIN');
            
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
                const nameCheckResult = await client.query(
                    'SELECT id FROM company_profile WHERE company_name = $1 AND user_id != $2',
                    [updateData.company_name, userId]
                );
                
                if (nameCheckResult.rows.length > 0) {
                    throw createError(409, 'Company name already exists');
                }
            }
            
            // Build dynamic update query
            const updateFields = [];
            const updateValues = [];
            let paramCount = 1;
            
            const allowedFields = [
                'company_name', 'industry', 'description', 'website', 
                'phone', 'email', 'address_line1', 'address_line2', 
                'city', 'state', 'postal_code', 'country'
            ];
            
            allowedFields.forEach(field => {
                if (updateData[field] !== undefined) {
                    updateFields.push(`${field} = $${paramCount}`);
                    updateValues.push(updateData[field]);
                    paramCount++;
                }
            });
            
            if (updateFields.length === 0) {
                throw createError(400, 'No valid fields to update');
            }
            
            updateFields.push('updated_at = NOW()');
            updateValues.push(userId);
            
            const updateQuery = `
                UPDATE company_profile 
                SET ${updateFields.join(', ')}
                WHERE user_id = $${paramCount}
                RETURNING *
            `;
            
            const result = await client.query(updateQuery, updateValues);
            
            if (result.rows.length === 0) {
                throw createError(404, 'Company profile not found');
            }
            
            await client.query('COMMIT');
            
            const updatedProfile = result.rows[0];
            updatedProfile.profile_completion = calculateProfileCompletion(updatedProfile);
            
            res.json({
                success: true,
                message: 'Company profile updated successfully',
                data: {
                    company: updatedProfile
                }
            });
            
        } catch (error) {
            await client.query('ROLLBACK');
            next(error);
        } finally {
            client.release();
        }
    }
    
    /**
     * Delete company profile
     * DELETE /api/company/profile
     */
    static async deleteProfile(req, res, next) {
        const client = await getClient();
        
        try {
            await client.query('BEGIN');
            
            const userId = req.user.id;
            
            // Get profile with image URLs for cleanup
            const profileResult = await client.query(
                'SELECT logo_url, banner_url FROM company_profile WHERE user_id = $1',
                [userId]
            );
            
            if (profileResult.rows.length === 0) {
                throw createError(404, 'Company profile not found');
            }
            
            const { logo_url, banner_url } = profileResult.rows[0];
            
            // Delete company profile
            const deleteResult = await client.query(
                'DELETE FROM company_profile WHERE user_id = $1 RETURNING *',
                [userId]
            );
            
            await client.query('COMMIT');
            
            // Clean up old images from Cloudinary (async, don't wait)
            const promises = [];
            if (logo_url) {
                promises.push(CloudinaryService.deleteImage(logo_url));
            }
            if (banner_url) {
                promises.push(CloudinaryService.deleteImage(banner_url));
            }
            
            if (promises.length > 0) {
                Promise.allSettled(promises).catch(console.error);
            }
            
            res.json({
                success: true,
                message: 'Company profile deleted successfully'
            });
            
        } catch (error) {
            await client.query('ROLLBACK');
            next(error);
        } finally {
            client.release();
        }
    }
    
   // Update these methods in your CompanyController

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
            
            // Upload new logo to Cloudinary with transformations
            const uploadOptions = {
                folder: 'company-logos',
                // Use Cloudinary's built-in transformations instead of Sharp
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
            
            // Upload new banner to Cloudinary with transformations
            const uploadOptions = {
                folder: 'company-banners',
                // Use Cloudinary's built-in transformations instead of Sharp
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
            
            // Build dynamic search query
            let whereConditions = [];
            let queryParams = [];
            let paramCount = 1;
            
            if (filters.search) {
                whereConditions.push(`(
                    company_name ILIKE $${paramCount} OR 
                    description ILIKE $${paramCount} OR 
                    industry ILIKE $${paramCount}
                )`);
                queryParams.push(`%${filters.search}%`);
                paramCount++;
            }
            
            if (filters.industry) {
                whereConditions.push(`industry ILIKE $${paramCount}`);
                queryParams.push(`%${filters.industry}%`);
                paramCount++;
            }
            
            if (filters.city) {
                whereConditions.push(`city ILIKE $${paramCount}`);
                queryParams.push(`%${filters.city}%`);
                paramCount++;
            }
            
            if (filters.state) {
                whereConditions.push(`state ILIKE $${paramCount}`);
                queryParams.push(`%${filters.state}%`);
                paramCount++;
            }
            
            if (filters.country) {
                whereConditions.push(`country ILIKE $${paramCount}`);
                queryParams.push(`%${filters.country}%`);
                paramCount++;
            }
            
            const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
            
            // Count total results
            const countQuery = `SELECT COUNT(*) as total FROM company_profile ${whereClause}`;
            const countResult = await query(countQuery, queryParams);
            const totalCount = parseInt(countResult.rows[0].total);
            
            // Get paginated results
            const offset = (pagination.page - 1) * pagination.limit;
            const searchQuery = `
                SELECT 
                    id, company_name, industry, description, city, state, country,
                    logo_url, banner_url, website, created_at
                FROM company_profile 
                ${whereClause}
                ORDER BY ${pagination.sortBy} ${pagination.sortOrder}
                LIMIT $${paramCount} OFFSET $${paramCount + 1}
            `;
            
            queryParams.push(pagination.limit, offset);
            const searchResult = await query(searchQuery, queryParams);
            
            res.json({
                success: true,
                message: 'Companies retrieved successfully',
                data: {
                    companies: searchResult.rows,
                    pagination: {
                        current_page: pagination.page,
                        per_page: pagination.limit,
                        total_count: totalCount,
                        total_pages: Math.ceil(totalCount / pagination.limit)
                    },
                    filters
                }
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
            const stats = await query(`
                SELECT 
                    COUNT(*) as total_companies,
                    COUNT(CASE WHEN logo_url IS NOT NULL THEN 1 END) as companies_with_logos,
                    COUNT(CASE WHEN banner_url IS NOT NULL THEN 1 END) as companies_with_banners,
                    COUNT(DISTINCT industry) as unique_industries,
                    COUNT(DISTINCT country) as countries_represented,
                    DATE_TRUNC('month', created_at) as month,
                    COUNT(*) as monthly_registrations
                FROM company_profile
                WHERE created_at >= NOW() - INTERVAL '12 months'
                GROUP BY DATE_TRUNC('month', created_at)
                ORDER BY month DESC
            `);
            
            // Get industry distribution
            const industryStats = await query(`
                SELECT industry, COUNT(*) as count 
                FROM company_profile 
                WHERE industry IS NOT NULL AND industry != ''
                GROUP BY industry 
                ORDER BY count DESC 
                LIMIT 10
            `);
            
            // Get country distribution
            const countryStats = await query(`
                SELECT country, COUNT(*) as count 
                FROM company_profile 
                WHERE country IS NOT NULL AND country != ''
                GROUP BY country 
                ORDER BY count DESC 
                LIMIT 10
            `);
            
            res.json({
                success: true,
                message: 'Company statistics retrieved successfully',
                data: {
                    overview: stats.rows[0] || {},
                    monthly_registrations: stats.rows,
                    industry_distribution: industryStats.rows,
                    country_distribution: countryStats.rows
                }
            });
            
        } catch (error) {
            next(error);
        }
    }
}

// Helper function to calculate profile completion percentage
function calculateProfileCompletion(profile) {
    const requiredFields = [
        'company_name', 'industry', 'description', 'website',
        'phone', 'email', 'address_line1', 'city', 'state', 
        'postal_code', 'country', 'logo_url'
    ];
    
    const filledFields = requiredFields.filter(field => 
        profile[field] && profile[field].toString().trim() !== ''
    );
    
    return Math.round((filledFields.length / requiredFields.length) * 100);
}

module.exports = CompanyController;