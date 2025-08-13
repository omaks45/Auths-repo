// src/models/companyModel.js
const { query } = require('../config/database');

class CompanyModel {
    // Create new company profile
    static async create(companyData) {
        const {
            owner_id,
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
        } = companyData;

        const sql = `
            INSERT INTO company_profile (
                owner_id, company_name, address, city, state, country, 
                postal_code, website, logo_url, banner_url, industry, 
                founded_date, description, social_links
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
            RETURNING *
        `;

        const values = [
            owner_id, company_name, address, city, state, country,
            postal_code, website || null, logo_url || null, banner_url || null,
            industry, founded_date || null, description || null,
            social_links ? JSON.stringify(social_links) : null
        ];

        const result = await query(sql, values);
        return result.rows[0];
    }

    // Find company by owner ID
    static async findByOwnerId(owner_id) {
        const sql = `
            SELECT cp.*, u.email, u.full_name as owner_name
            FROM company_profile cp
            JOIN users u ON cp.owner_id = u.id
            WHERE cp.owner_id = $1
        `;
        const result = await query(sql, [owner_id]);
        return result.rows[0];
    }

    // Find company by ID
    static async findById(id) {
        const sql = `
            SELECT cp.*, u.email, u.full_name as owner_name
            FROM company_profile cp
            JOIN users u ON cp.owner_id = u.id
            WHERE cp.id = $1
        `;
        const result = await query(sql, [id]);
        return result.rows[0];
    }

    // Update company profile
    static async update(id, updateData) {
        const allowedFields = [
            'company_name', 'address', 'city', 'state', 'country',
            'postal_code', 'website', 'logo_url', 'banner_url',
            'industry', 'founded_date', 'description', 'social_links'
        ];

        const updates = [];
        const values = [];
        let paramCounter = 1;

        // Build dynamic update query
        for (const [key, value] of Object.entries(updateData)) {
            if (allowedFields.includes(key) && value !== undefined) {
                if (key === 'social_links' && typeof value === 'object') {
                    updates.push(`${key} = $${paramCounter}`);
                    values.push(JSON.stringify(value));
                } else {
                    updates.push(`${key} = $${paramCounter}`);
                    values.push(value);
                }
                paramCounter++;
            }
        }

        if (updates.length === 0) {
            throw new Error('No valid fields to update');
        }

        // Add updated_at
        updates.push(`updated_at = CURRENT_TIMESTAMP`);
        values.push(id);

        const sql = `
            UPDATE company_profile 
            SET ${updates.join(', ')}
            WHERE id = $${paramCounter}
            RETURNING *
        `;

        const result = await query(sql, values);
        return result.rows[0];
    }

    // Update company profile by owner ID
    static async updateByOwnerId(owner_id, updateData) {
        const allowedFields = [
            'company_name', 'address', 'city', 'state', 'country',
            'postal_code', 'website', 'logo_url', 'banner_url',
            'industry', 'founded_date', 'description', 'social_links'
        ];

        const updates = [];
        const values = [];
        let paramCounter = 1;

        // Build dynamic update query
        for (const [key, value] of Object.entries(updateData)) {
            if (allowedFields.includes(key) && value !== undefined) {
                if (key === 'social_links' && typeof value === 'object') {
                    updates.push(`${key} = $${paramCounter}`);
                    values.push(JSON.stringify(value));
                } else {
                    updates.push(`${key} = $${paramCounter}`);
                    values.push(value);
                }
                paramCounter++;
            }
        }

        if (updates.length === 0) {
            throw new Error('No valid fields to update');
        }

        // Add updated_at
        updates.push(`updated_at = CURRENT_TIMESTAMP`);
        values.push(owner_id);

        const sql = `
            UPDATE company_profile 
            SET ${updates.join(', ')}
            WHERE owner_id = $${paramCounter}
            RETURNING *
        `;

        const result = await query(sql, values);
        return result.rows[0];
    }

    // Delete company profile
    static async delete(id) {
        const sql = 'DELETE FROM company_profile WHERE id = $1 RETURNING *';
        const result = await query(sql, [id]);
        return result.rows[0];
    }

    // Check if company exists for owner
    static async existsForOwner(owner_id) {
        const sql = 'SELECT id FROM company_profile WHERE owner_id = $1';
        const result = await query(sql, [owner_id]);
        return result.rows.length > 0;
    }

    // Get all companies (for admin purposes)
    static async findAll(limit = 50, offset = 0) {
        const sql = `
            SELECT cp.*, u.email, u.full_name as owner_name
            FROM company_profile cp
            JOIN users u ON cp.owner_id = u.id
            ORDER BY cp.created_at DESC
            LIMIT $1 OFFSET $2
        `;
        const result = await query(sql, [limit, offset]);
        return result.rows;
    }

    // Search companies by name or industry
    static async search(searchTerm, limit = 20) {
        const sql = `
            SELECT cp.*, u.email, u.full_name as owner_name
            FROM company_profile cp
            JOIN users u ON cp.owner_id = u.id
            WHERE 
                LOWER(cp.company_name) LIKE LOWER($1) OR 
                LOWER(cp.industry) LIKE LOWER($1) OR
                LOWER(cp.city) LIKE LOWER($1)
            ORDER BY cp.created_at DESC
            LIMIT $2
        `;
        const result = await query(sql, [`%${searchTerm}%`, limit]);
        return result.rows;
    }

    // Get company statistics
    static async getStats() {
        const sql = `
            SELECT 
                COUNT(*) as total_companies,
                COUNT(DISTINCT industry) as unique_industries,
                COUNT(DISTINCT country) as countries_represented,
                AVG(EXTRACT(YEAR FROM CURRENT_DATE) - EXTRACT(YEAR FROM founded_date)) as avg_company_age
            FROM company_profile
            WHERE founded_date IS NOT NULL
        `;
        const result = await query(sql);
        return result.rows[0];
    }
}

module.exports = CompanyModel;