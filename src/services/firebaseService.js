
require('dotenv').config();
const admin = require('firebase-admin');

/**
 * Firebase Authentication Service
 * Handles ONLY Firebase Auth operations (no Firestore)
 * Uses PostgreSQL as the primary database
 */
class FirebaseAuthService {
    static #initialized = false;
    static #auth = null;

    /**
     * Initialize Firebase Admin SDK (Auth only)
     */
    static initialize() {
        if (this.#initialized) {
            return;
        }

        try {
            // Validate required environment variables
            const requiredEnvVars = [
                'FIREBASE_ADMIN_PROJECT_ID',
                'FIREBASE_ADMIN_PRIVATE_KEY',
                'FIREBASE_ADMIN_CLIENT_EMAIL'
            ];

            for (const envVar of requiredEnvVars) {
                if (!process.env[envVar]) {
                    throw new Error(`Missing required environment variable: ${envVar}`);
                }
            }

            // Service Account Configuration
            const serviceAccount = {
                type: "service_account",
                project_id: process.env.FIREBASE_ADMIN_PROJECT_ID,
                private_key_id: process.env.FIREBASE_ADMIN_PRIVATE_KEY_ID,
                private_key: process.env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, '\n'),
                client_email: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
                client_id: process.env.FIREBASE_ADMIN_CLIENT_ID,
                auth_uri: "https://accounts.google.com/o/oauth2/auth",
                token_uri: "https://oauth2.googleapis.com/token",
                auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
                client_x509_cert_url: `https://www.googleapis.com/robot/v1/metadata/x509/${encodeURIComponent(process.env.FIREBASE_ADMIN_CLIENT_EMAIL)}`
            };

            // Initialize Firebase Admin (Auth only)
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount)
                // Note: No Firestore or Storage bucket needed
            });

            // Cache auth instance only
            this.#auth = admin.auth();
            this.#initialized = true;

            console.log(' Firebase Auth SDK initialized successfully');
        } catch (error) {
            console.error(' Firebase Auth initialization failed:', error.message);
            throw error;
        }
    }

    /**
     * Get Auth instance
     */
    static getAuth() {
        if (!this.#initialized) {
            this.initialize();
        }
        return this.#auth;
    }

    // =========================
    // USER AUTHENTICATION METHODS
    // =========================

    /**
     * Create a new user in Firebase Auth
     * Note: User profile data will be stored in PostgreSQL
     */
    static async createUser(userData) {
        try {
            const { email, password, displayName, phoneNumber } = userData;

            const userRecord = await this.getAuth().createUser({
                email,
                password,
                displayName,
                phoneNumber,
                emailVerified: false
            });

            console.log(' Firebase user created:', userRecord.uid);
            
            // Return minimal data - full profile will be in PostgreSQL
            return {
                firebaseUID: userRecord.uid,
                email: userRecord.email,
                displayName: userRecord.displayName,
                phoneNumber: userRecord.phoneNumber,
                emailVerified: userRecord.emailVerified
            };
        } catch (error) {
            console.error(' Firebase user creation failed:', error.message);
            
            // Handle specific Firebase Auth errors
            if (error.code === 'auth/email-already-exists') {
                throw new Error('Email already registered');
            } else if (error.code === 'auth/invalid-email') {
                throw new Error('Invalid email format');
            } else if (error.code === 'auth/weak-password') {
                throw new Error('Password is too weak');
            }
            
            throw new Error(`User creation failed: ${error.message}`);
        }
    }

    /**
     * Get Firebase user by email
     */
    static async getUserByEmail(email) {
        try {
            const userRecord = await this.getAuth().getUserByEmail(email);
            return {
                firebaseUID: userRecord.uid,
                email: userRecord.email,
                displayName: userRecord.displayName,
                phoneNumber: userRecord.phoneNumber,
                emailVerified: userRecord.emailVerified,
                disabled: userRecord.disabled
            };
        } catch (error) {
            if (error.code === 'auth/user-not-found') {
                return null;
            }
            console.error(' Get user by email failed:', error.message);
            throw new Error(`Get user failed: ${error.message}`);
        }
    }

    /**
     * Get Firebase user by UID
     */
    static async getUserByUID(firebaseUID) {
        try {
            const userRecord = await this.getAuth().getUser(firebaseUID);
            return {
                firebaseUID: userRecord.uid,
                email: userRecord.email,
                displayName: userRecord.displayName,
                phoneNumber: userRecord.phoneNumber,
                emailVerified: userRecord.emailVerified,
                disabled: userRecord.disabled
            };
        } catch (error) {
            if (error.code === 'auth/user-not-found') {
                return null;
            }
            console.error(' Get user by UID failed:', error.message);
            throw new Error(`Get user failed: ${error.message}`);
        }
    }

    /**
     * Update Firebase user
     */
    static async updateUser(firebaseUID, updateData) {
        try {
            const userRecord = await this.getAuth().updateUser(firebaseUID, updateData);
            console.log(' Firebase user updated successfully');
            return {
                firebaseUID: userRecord.uid,
                email: userRecord.email,
                displayName: userRecord.displayName,
                phoneNumber: userRecord.phoneNumber,
                emailVerified: userRecord.emailVerified
            };
        } catch (error) {
            console.error(' Firebase user update failed:', error.message);
            throw new Error(`User update failed: ${error.message}`);
        }
    }

    /**
     * Delete Firebase user
     */
    static async deleteUser(firebaseUID) {
        try {
            await this.getAuth().deleteUser(firebaseUID);
            console.log(' Firebase user deleted successfully');
            return true;
        } catch (error) {
            console.error(' Firebase user deletion failed:', error.message);
            throw new Error(`User deletion failed: ${error.message}`);
        }
    }

    /**
     * Verify Firebase ID token
     */
    static async verifyIdToken(idToken) {
        try {
            const decodedToken = await this.getAuth().verifyIdToken(idToken);
            return {
                firebaseUID: decodedToken.uid,
                email: decodedToken.email,
                emailVerified: decodedToken.email_verified,
                phoneNumber: decodedToken.phone_number,
                name: decodedToken.name,
                iat: decodedToken.iat,
                exp: decodedToken.exp
            };
        } catch (error) {
            console.error(' Token verification failed:', error.message);
            
            if (error.code === 'auth/id-token-expired') {
                throw new Error('Token has expired');
            } else if (error.code === 'auth/id-token-revoked') {
                throw new Error('Token has been revoked');
            }
            
            throw new Error('Invalid token');
        }
    }

    // =========================
    // EMAIL VERIFICATION METHODS
    // =========================

    /**
     * Generate email verification link
     */
    static async generateEmailVerificationLink(email) {
        try {
            const link = await this.getAuth().generateEmailVerificationLink(email);
            console.log(' Email verification link generated');
            return link;
        } catch (error) {
            console.error(' Email verification link generation failed:', error.message);
            throw new Error(`Email verification failed: ${error.message}`);
        }
    }

    /**
     * Generate password reset link
     */
    static async generatePasswordResetLink(email) {
        try {
            const link = await this.getAuth().generatePasswordResetLink(email);
            console.log(' Password reset link generated');
            return link;
        } catch (error) {
            console.error(' Password reset link generation failed:', error.message);
            throw new Error(`Password reset failed: ${error.message}`);
        }
    }

    // =========================
    // SMS OTP METHODS
    // =========================

    /**
     * Send SMS OTP (Mock implementation for development)
     * In production, integrate with Firebase Auth Phone verification
     * or a service like Twilio
     */
    static async sendSMSOTP(phoneNumber) {
        try {
            // Generate mock OTP for development
            const mockOTP = Math.floor(100000 + Math.random() * 900000).toString();
            const verificationId = `verify_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            
            // Store OTP temporarily (use Redis in production)
            global.otpStore = global.otpStore || {};
            global.otpStore[verificationId] = {
                otp: mockOTP,
                phoneNumber,
                timestamp: Date.now(),
                expires: Date.now() + (5 * 60 * 1000) // 5 minutes
            };
            
            console.log(` Mock SMS OTP for ${phoneNumber}: ${mockOTP}`);
            console.log(` Verification ID: ${verificationId}`);
            
            // const verificationId = await admin.auth().createCustomToken(uid);
            
            return { 
                verificationId,
                // Remove otp from response in production
                otp: mockOTP // Only for development testing
            };
        } catch (error) {
            console.error(' SMS OTP generation failed:', error.message);
            throw new Error(`SMS OTP failed: ${error.message}`);
        }
    }

    /**
     * Verify SMS OTP
     */
    static async verifySMSOTP(verificationId, otp) {
        try {
            global.otpStore = global.otpStore || {};
            const storedOTP = global.otpStore[verificationId];
            
            if (!storedOTP) {
                throw new Error('Invalid or expired verification ID');
            }
            
            if (Date.now() > storedOTP.expires) {
                delete global.otpStore[verificationId];
                throw new Error('OTP has expired');
            }
            
            if (storedOTP.otp !== otp) {
                throw new Error('Invalid OTP');
            }
            
            // Clean up
            delete global.otpStore[verificationId];
            
            console.log(' SMS OTP verified successfully');
            return { 
                verified: true, 
                phoneNumber: storedOTP.phoneNumber 
            };
        } catch (error) {
            console.error(' OTP verification failed:', error.message);
            throw error;
        }
    }

    // =========================
    // UTILITY METHODS
    // =========================

    /**
     * Check if service is initialized
     */
    static isInitialized() {
        return this.#initialized;
    }

    /**
     * Get Firebase configuration
     */
    static getConfig() {
        return {
            projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
            clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
            initialized: this.#initialized
        };
    }

    /**
     * Set custom user claims (for role-based access)
     */
    static async setCustomUserClaims(firebaseUID, claims) {
        try {
            await this.getAuth().setCustomUserClaims(firebaseUID, claims);
            console.log(' Custom claims set successfully');
            return true;
        } catch (error) {
            console.error(' Setting custom claims failed:', error.message);
            throw new Error(`Setting claims failed: ${error.message}`);
        }
    }

    /**
     * Revoke refresh tokens (force user to re-authenticate)
     */
    static async revokeRefreshTokens(firebaseUID) {
        try {
            await this.getAuth().revokeRefreshTokens(firebaseUID);
            console.log(' Refresh tokens revoked successfully');
            return true;
        } catch (error) {
            console.error(' Revoking tokens failed:', error.message);
            throw new Error(`Token revocation failed: ${error.message}`);
        }
    }
}

module.exports = FirebaseAuthService;