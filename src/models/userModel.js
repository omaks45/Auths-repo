// src/models/userModel.js
const { query } = require('../config/database');
const bcrypt = require('bcrypt');

class UserModel {
    // Create new user
    static async create(userData) {
        const {
            email,
            password,
            full_name,
            gender,
            mobile_no,
            signup_type = 'e'
        } = userData;

        // Hash password
        const saltRounds = 12;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        const sql = `
            INSERT INTO users (email, password, full_name, gender, mobile_no, signup_type)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id, email, full_name, gender, mobile_no, signup_type, 
                    is_mobile_verified, is_email_verified, created_at
        `;

        const values = [email, hashedPassword, full_name, gender, mobile_no, signup_type];
        const result = await query(sql, values);
        return result.rows[0];
    }

    // Find user by email
    static async findByEmail(email) {
        const sql = `
            SELECT id, email, password, full_name, gender, mobile_no, signup_type,
                is_mobile_verified, is_email_verified, created_at, updated_at
            FROM users 
            WHERE email = $1
        `;
        const result = await query(sql, [email]);
        return result.rows[0];
    }

    // Find user by ID
    static async findById(id) {
        const sql = `
            SELECT id, email, full_name, gender, mobile_no, signup_type,
                is_mobile_verified, is_email_verified, created_at, updated_at
            FROM users 
            WHERE id = $1
        `;
        const result = await query(sql, [id]);
        return result.rows[0];
    }

    // Update user
    static async update(id, updateData) {
        const allowedFields = ['full_name', 'gender', 'mobile_no'];
        const updates = [];
        const values = [];
        let paramCounter = 1;

        // Build dynamic update query
        for (const [key, value] of Object.entries(updateData)) {
            if (allowedFields.includes(key) && value !== undefined) {
                updates.push(`${key} = $${paramCounter}`);
                values.push(value);
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
            UPDATE users 
            SET ${updates.join(', ')}
            WHERE id = $${paramCounter}
            RETURNING id, email, full_name, gender, mobile_no, signup_type,
                    is_mobile_verified, is_email_verified, created_at, updated_at
        `;

        const result = await query(sql, values);
        return result.rows[0];
    }

    // Verify password
    static async verifyPassword(plainPassword, hashedPassword) {
        return await bcrypt.compare(plainPassword, hashedPassword);
    }

    // Update verification status
    static async updateEmailVerification(id, isVerified = true) {
        const sql = `
            UPDATE users 
            SET is_email_verified = $1, updated_at = CURRENT_TIMESTAMP
            WHERE id = $2
            RETURNING id, email, is_email_verified
        `;
        const result = await query(sql, [isVerified, id]);
        return result.rows[0];
    }

    static async updateMobileVerification(id, isVerified = true) {
        const sql = `
            UPDATE users 
            SET is_mobile_verified = $1, updated_at = CURRENT_TIMESTAMP
            WHERE id = $2
            RETURNING id, mobile_no, is_mobile_verified
        `;
        const result = await query(sql, [isVerified, id]);
        return result.rows[0];
    }

    // Check if email exists
    static async emailExists(email) {
        const sql = 'SELECT id FROM users WHERE email = $1';
        const result = await query(sql, [email]);
        return result.rows.length > 0;
    }

    // Check if mobile exists
    static async mobileExists(mobile_no) {
        const sql = 'SELECT id FROM users WHERE mobile_no = $1';
        const result = await query(sql, [mobile_no]);
        return result.rows.length > 0;
    }
}

module.exports = UserModel;