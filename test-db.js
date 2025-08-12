// test-db.js - Run this to test your database connection
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'Bluestock',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
});

async function testDatabase() {
    try {
        console.log('Testing database connection...');
        
        // Test basic connection
        const client = await pool.connect();
        console.log('Database connected successfully!');
        
        // Test if tables exist
        const tablesResult = await client.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
        `);
        
        console.log('Available tables:', tablesResult.rows.map(row => row.table_name));
        
        // Test users table structure
        try {
            const usersResult = await client.query('SELECT * FROM users LIMIT 1');
            console.log('Users table exists and accessible');
        } catch (error) {
            console.log(' Users table issue:', error.message);
        }
        
        // Test company_profile table structure  
        try {
            const companyResult = await client.query('SELECT * FROM company_profile LIMIT 1');
            console.log('Company_profile table exists and accessible');
        } catch (error) {
            console.log('Company_profile table issue:', error.message);
        }
        
        client.release();
        console.log('Database test completed!');
        
    } catch (error) {
        console.error('Database test failed:', error.message);
        console.error('Check your .env file and PostgreSQL connection');
    } finally {
        await pool.end();
        process.exit();
    }
}

testDatabase();