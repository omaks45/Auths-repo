
const { Pool } = require('pg');

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'Bluestock',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});

// Test connection
pool.on('connect', () => {
    console.log(' Connected to PostgreSQL database:', process.env.DB_NAME);
});

pool.on('error', (err) => {
    console.error(' Database connection error:', err);
});

// Helper function for queries
const query = async (text, params) => {
    const start = Date.now();
    try {
        const res = await pool.query(text, params);
        const duration = Date.now() - start;
        console.log(' Query executed', { text: text.substring(0, 100) + '...', duration, rows: res.rowCount });
        return res;
    } catch (error) {
        console.error(' Query error:', error);
        throw error;
    }
};

// Helper function to get a client from pool
const getClient = () => {
    return pool.connect();
};

// Test database connection
const testConnection = async () => {
    try {
        const result = await query('SELECT NOW() as current_time');
        console.log(' Database connection test successful:', result.rows[0]);
        
        // Test if required tables exist
        const tablesResult = await query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name IN ('users', 'company_profile')
        `);
        
        const tables = tablesResult.rows.map(row => row.table_name);
        console.log(' Found tables:', tables);
        
        if (!tables.includes('users')) {
            console.log('  Warning: users table not found');
        }
        if (!tables.includes('company_profile')) {
            console.log('  Warning: company_profile table not found');
        }
        
        return true;
    } catch (error) {
        console.error(' Database connection test failed:', error.message);
        return false;
    }
};

module.exports = {
    pool,
    query,
    getClient,
    testConnection
};

module.exports = {
    pool,
    query,
    getClient,
    testConnection
};