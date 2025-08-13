
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');

// Import middleware
const { errorHandler } = require('./utils/errorHandler');

const app = express();
const PORT = process.env.PORT || 5000;

// Security middleware
app.use(helmet());
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true
}));

// General middleware
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// DEBUG: Import and check routes one by one
console.log('Importing auth routes...');
try {
    const authRoutes = require('./routes/auth');
    console.log('Auth routes type:', typeof authRoutes);
    console.log('Auth routes:', authRoutes);
    
    if (typeof authRoutes === 'function') {
        app.use('/api/auth', authRoutes);
        console.log('Auth routes loaded successfully');
    } else {
        console.error('Auth routes is not a function:', typeof authRoutes);
    }
} catch (error) {
    console.error('Error loading auth routes:', error.message);
}

/*
console.log('Importing company routes...');
try {
    const companyRoutes = require('./routes/company');
    console.log('Company routes type:', typeof companyRoutes);
    console.log('Company routes:', companyRoutes);
    
    if (typeof companyRoutes === 'function') {
        app.use('/api/company', companyRoutes);
        console.log('Company routes loaded successfully');
    } else {
        console.error('Company routes is not a function:', typeof companyRoutes);
    }
} catch (error) {
    console.error('Error loading company routes:', error.message);
}

*/

// Health check
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// Error handling
app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        message: 'Route not found'
    });
});

app.use(errorHandler);

// Start server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV}`);
    console.log(`Health check: http://localhost:${PORT}/api/health`);
});

module.exports = app;