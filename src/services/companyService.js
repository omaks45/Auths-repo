const pool = require('../config/database');
const createError = require('http-errors');

class CompanyService {
    /**
     * Create a new company profile
     * Time Complexity: O(1)
     */
    static async createCompanyProfile(userId, profileData) {
        const client = await pool.connect();
        
        try {
            await client.query('BEGIN');
            
            // Check if user already has a company profile
            const existingProfile = await client.query(
                'SELECT id FROM company_profile WHERE owner_id = $1',
                [userId]
            );
            
            if (existingProfile.rows.length > 0) {
                throw createError(409, 'Company profile already exists for this user');
            }
            
            const {
                company_name,
                address,
                city,
                state,
                country,
                postal_code,
                website,
                logo_url,
                banner_url,
                industry,
                founded_date,
                description,
                social_links
            } = profileData;
            
            const query = `
                INSERT INTO company_profile (
                    owner_id, company_name, address, city, state, country,
                    postal_code, website, logo_url, banner_url, industry,
                    founded_date, description, social_links, created_at, updated_at
                ) VALUES (
                    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
                    CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
                ) RETURNING *
            `;
            
            const values = [
                userId,
                company_name,
                address,
                city,
                state,
                country,
                postal_code,
                website || null,
                logo_url || null,
                banner_url || null,
                industry,
                founded_date || null,
                description || null,
                social_links || null
            ];
            
            const result = await client.query(query, values);
            
            await client.query('COMMIT');
            return result.rows[0];
            
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }
    
    /**
     * Get company profile by user ID
     * Time Complexity: O(1)
     */
    static async getCompanyProfileByUserId(userId) {
        const query = `
            SELECT 
                cp.*,
                u.full_name as owner_name,
                u.email as owner_email,
                u.mobile_no as owner_mobile,
                u.is_email_verified,
                u.is_mobile_verified
            FROM company_profile cp
            JOIN users u ON cp.owner_id = u.id
            WHERE cp.owner_id = $1
        `;
        
        const result = await pool.query(query, [userId]);
        
        if (result.rows.length === 0) {
            return null;
        }
        
        return result.rows[0];
    }
    
    /**
     * Update company profile
     * Time Complexity: O(1)
     */
    static async updateCompanyProfile(userId, updateData) {
        const client = await pool.connect();
        
        try {
            await client.query('BEGIN');
            
            // Check if profile exists
            const existingProfile = await client.query(
                'SELECT id FROM company_profile WHERE owner_id = $1',
                [userId]
            );
            
            if (existingProfile.rows.length === 0) {
                throw createError(404, 'Company profile not found');
            }
            
            // Build dynamic update query
            const updateFields = [];
            const values = [];
            let paramCounter = 1;
            
            const allowedFields = [
                'company_name', 'address', 'city', 'state', 'country',
                'postal_code', 'website', 'logo_url', 'banner_url',
                'industry', 'founded_date', 'description', 'social_links'
            ];
            
            for (const field of allowedFields) {
                if (updateData.hasOwnProperty(field)) {
                    updateFields.push(`${field} = $${paramCounter}`);
                    values.push(updateData[field]);
                    paramCounter++;
                }
            }
            
            if (updateFields.length === 0) {
                throw createError(400, 'No valid fields provided for update');
            }
            
            // Add updated_at timestamp
            updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
            
            // Add user ID for WHERE clause
            values.push(userId);
            
            const query = `
                UPDATE company_profile 
                SET ${updateFields.join(', ')}
                WHERE owner_id = $${paramCounter}
                RETURNING *
            `;
            
            const result = await client.query(query, values);
            
            await client.query('COMMIT');
            return result.rows[0];
            
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }
    
    /**
     * Update company image URL (logo or banner)
     * Time Complexity: O(1)
     */
    static async updateCompanyImage(userId, imageType, imageUrl) {
        const allowedTypes = ['logo_url', 'banner_url'];
        
        if (!allowedTypes.includes(imageType)) {
            throw createError(400, 'Invalid image type');
        }
        
        const query = `
            UPDATE company_profile 
            SET ${imageType} = $1, updated_at = CURRENT_TIMESTAMP
            WHERE owner_id = $2
            RETURNING id, ${imageType}
        `;
        
        const result = await pool.query(query, [imageUrl, userId]);
        
        if (result.rows.length === 0) {
            throw createError(404, 'Company profile not found');
        }
        
        return result.rows[0];
    }
    
    /**
     * Delete company profile
     * Time Complexity: O(1)
     */
    static async deleteCompanyProfile(userId) {
        const client = await pool.connect();
        
        try {
            await client.query('BEGIN');
            
            // Get the profile to return old image URLs for cleanup
            const profileResult = await client.query(
                'SELECT logo_url, banner_url FROM company_profile WHERE owner_id = $1',
                [userId]
            );
            
            if (profileResult.rows.length === 0) {
                throw createError(404, 'Company profile not found');
            }
            
            const oldProfile = profileResult.rows[0];
            
            // Delete the profile
            await client.query(
                'DELETE FROM company_profile WHERE owner_id = $1',
                [userId]
            );
            
            await client.query('COMMIT');
            
            return {
                deleted: true,
                oldImageUrls: {
                    logo_url: oldProfile.logo_url,
                    banner_url: oldProfile.banner_url
                }
            };
            
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }
    
    /**
     * Search companies with pagination and filters
     * Time Complexity: O(n log n) where n is the number of matching records
     */
    static async searchCompanies(filters = {}, pagination = {}) {
        const {
            search = '',
            industry = '',
            city = '',
            state = '',
            country = ''
        } = filters;
        
        const {
            page = 1,
            limit = 10,
            sortBy = 'created_at',
            sortOrder = 'DESC'
        } = pagination;
        
        const offset = (page - 1) * limit;
        
        // Build WHERE clause
        const whereConditions = [];
        const queryParams = [];
        let paramCounter = 1;
        
        if (search.trim()) {
            whereConditions.push(`(
                cp.company_name ILIKE $${paramCounter} OR 
                cp.description ILIKE $${paramCounter}
            )`);
            queryParams.push(`%${search.trim()}%`);
            paramCounter++;
        }
        
        if (industry.trim()) {
            whereConditions.push(`cp.industry ILIKE $${paramCounter}`);
            queryParams.push(`%${industry.trim()}%`);
            paramCounter++;
        }
        
        if (city.trim()) {
            whereConditions.push(`cp.city ILIKE $${paramCounter}`);
            queryParams.push(`%${city.trim()}%`);
            paramCounter++;
        }
        
        if (state.trim()) {
            whereConditions.push(`cp.state ILIKE $${paramCounter}`);
            queryParams.push(`%${state.trim()}%`);
            paramCounter++;
        }
        
        if (country.trim()) {
            whereConditions.push(`cp.country ILIKE $${paramCounter}`);
            queryParams.push(`%${country.trim()}%`);
            paramCounter++;
        }
        
        const whereClause = whereConditions.length > 0 
            ? `WHERE ${whereConditions.join(' AND ')}`
            : '';
        
        // Validate sort parameters
        const allowedSortFields = [
            'company_name', 'city', 'state', 'country', 
            'industry', 'created_at', 'updated_at'
        ];
        const validSortBy = allowedSortFields.includes(sortBy) ? sortBy : 'created_at';
        const validSortOrder = ['ASC', 'DESC'].includes(sortOrder.toUpperCase()) 
            ? sortOrder.toUpperCase() 
            : 'DESC';
        
        // Main query
        const query = `
            SELECT 
                cp.id,
                cp.company_name,
                cp.address,
                cp.city,
                cp.state,
                cp.country,
                cp.website,
                cp.logo_url,
                cp.industry,
                cp.founded_date,
                cp.description,
                cp.created_at,
                u.full_name as owner_name
            FROM company_profile cp
            JOIN users u ON cp.owner_id = u.id
            ${whereClause}
            ORDER BY cp.${validSortBy} ${validSortOrder}
            LIMIT $${paramCounter} OFFSET $${paramCounter + 1}
        `;
        
        queryParams.push(limit, offset);
        
        // Count query
        const countQuery = `
            SELECT COUNT(*) as total
            FROM company_profile cp
            JOIN users u ON cp.owner_id = u.id
            ${whereClause}
        `;
        
        const [companiesResult, countResult] = await Promise.all([
            pool.query(query, queryParams),
            pool.query(countQuery, queryParams.slice(0, -2)) // Remove limit and offset for count
        ]);
        
        const total = parseInt(countResult.rows[0].total);
        const totalPages = Math.ceil(total / limit);
        
        return {
            companies: companiesResult.rows,
            pagination: {
                currentPage: page,
                totalPages,
                totalRecords: total,
                hasNextPage: page < totalPages,
                hasPrevPage: page > 1
            }
        };
    }
    
    /**
     * Get company statistics
     * Time Complexity: O(1)
     */
    static async getCompanyStats() {
        const query = `
            SELECT 
                COUNT(*) as total_companies,
                COUNT(DISTINCT industry) as total_industries,
                COUNT(DISTINCT country) as total_countries,
                COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '30 days') as companies_last_30_days,
                COUNT(*) FILTER (WHERE logo_url IS NOT NULL) as companies_with_logo,
                COUNT(*) FILTER (WHERE banner_url IS NOT NULL) as companies_with_banner
            FROM company_profile
        `;
        
        const result = await pool.query(query);
        return result.rows[0];
    }
    
    /**
     * Check if company name is available
     * Time Complexity: O(1)
     */
    static async isCompanyNameAvailable(companyName, excludeUserId = null) {
        let query = 'SELECT id FROM company_profile WHERE LOWER(company_name) = LOWER($1)';
        const params = [companyName];
        
        if (excludeUserId) {
            query += ' AND owner_id != $2';
            params.push(excludeUserId);
        }
        
        const result = await pool.query(query, params);
        return result.rows.length === 0;
    }
}

module.exports = CompanyService;