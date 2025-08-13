
const UserModel = require('../models/userModel');
const { generateToken } = require('../utils/jwt');
const { AppError } = require('../utils/errorHandler');
const FirebaseService = require('./firebaseService');
const { parsePhoneNumber } = require('libphonenumber-js');

class UserService {
    // Register new user
    static async registerUser(userData) {
        const { email, password, full_name, gender, mobile_no, signup_type = 'e' } = userData;

        // Check if user already exists
        const existingUserByEmail = await UserModel.emailExists(email);
        if (existingUserByEmail) {
            throw new AppError('User with this email already exists', 409);
        }

        const existingUserByMobile = await UserModel.mobileExists(mobile_no);
        if (existingUserByMobile) {
            throw new AppError('User with this mobile number already exists', 409);
        }

        // Parse and format phone number
        const phoneNumber = parsePhoneNumber(mobile_no);
        const formattedMobile = phoneNumber.formatInternational();

        // Create user in database
        const newUser = await UserModel.create({
            email,
            password,
            full_name,
            gender,
            mobile_no: formattedMobile,
            signup_type
        });

        // Create user in Firebase for authentication
        try {
            await FirebaseService.createUser(email, password, {
                displayName: full_name,
                phoneNumber: formattedMobile
            });
        } catch (firebaseError) {
            // If Firebase fails, we should ideally rollback the database user
            console.error('Firebase user creation failed:', firebaseError);
            // For now, we'll continue as the main registration succeeded
        }

        // Send email verification
        try {
            await FirebaseService.sendEmailVerification(email);
        } catch (error) {
            console.error('Email verification sending failed:', error);
        }

        // Generate JWT token
        const token = generateToken({
            id: newUser.id,
            email: newUser.email,
            full_name: newUser.full_name
        });

        // Remove password from response
        const { password: _, ...userResponse } = newUser;

        return {
            user: userResponse,
            token,
            message: 'User registered successfully. Please verify your email and mobile number.'
        };
    }

    // Login user
    static async loginUser(email, password) {
        // Find user by email
        const user = await UserModel.findByEmail(email);
        if (!user) {
            throw new AppError('Invalid email or password', 401);
        }

        // Verify password
        const isPasswordValid = await UserModel.verifyPassword(password, user.password);
        if (!isPasswordValid) {
            throw new AppError('Invalid email or password', 401);
        }

        // Verify with Firebase
        try {
            await FirebaseService.verifyUser(email, password);
        } catch (firebaseError) {
            console.error('Firebase verification failed:', firebaseError);
            // Continue with local authentication if Firebase fails
        }

        // Generate JWT token
        const token = generateToken({
            id: user.id,
            email: user.email,
            full_name: user.full_name
        });

        // Remove password from response
        const { password: _, ...userResponse } = user;

        return {
            user: userResponse,
            token,
            message: 'Login successful'
        };
    }

    // Get user profile
    static async getUserProfile(userId) {
        const user = await UserModel.findById(userId);
        if (!user) {
            throw new AppError('User not found', 404);
        }

        return user;
    }

    // Update user profile
    static async updateUserProfile(userId, updateData) {
        // Validate mobile number if provided
        if (updateData.mobile_no) {
            const phoneNumber = parsePhoneNumber(updateData.mobile_no);
            if (!phoneNumber || !phoneNumber.isValid()) {
                throw new AppError('Invalid phone number format', 400);
            }
            updateData.mobile_no = phoneNumber.formatInternational();

            // Check if mobile number is already taken by another user
            const existingUser = await UserModel.mobileExists(updateData.mobile_no);
            if (existingUser) {
                // Check if it's not the same user
                const currentUser = await UserModel.findById(userId);
                if (currentUser.mobile_no !== updateData.mobile_no) {
                    throw new AppError('Mobile number is already in use', 409);
                }
            }

            // Reset mobile verification if number changed
            const currentUser = await UserModel.findById(userId);
            if (currentUser.mobile_no !== updateData.mobile_no) {
                updateData.is_mobile_verified = false;
            }
        }

        const updatedUser = await UserModel.update(userId, updateData);
        if (!updatedUser) {
            throw new AppError('User not found', 404);
        }

        return updatedUser;
    }

    // Send mobile OTP
    static async sendMobileOTP(userId) {
        const user = await UserModel.findById(userId);
        if (!user) {
            throw new AppError('User not found', 404);
        }

        if (user.is_mobile_verified) {
            throw new AppError('Mobile number is already verified', 400);
        }

        try {
            const verificationId = await FirebaseService.sendSMSOTP(user.mobile_no);
            return {
                message: 'OTP sent successfully to your mobile number',
                verificationId,
                mobile_no: user.mobile_no
            };
        } catch (error) {
            console.error('SMS OTP sending failed:', error);
            throw new AppError('Failed to send OTP. Please try again.', 500);
        }
    }

    // Verify mobile OTP
    static async verifyMobileOTP(userId, otp, verificationId) {
        const user = await UserModel.findById(userId);
        if (!user) {
            throw new AppError('User not found', 404);
        }

        if (user.is_mobile_verified) {
            return {
                message: 'Mobile number is already verified',
                is_mobile_verified: true
            };
        }

        try {
            const isValid = await FirebaseService.verifySMSOTP(verificationId, otp);
            if (!isValid) {
                throw new AppError('Invalid OTP. Please try again.', 400);
            }

            // Update verification status in database
            await UserModel.updateMobileVerification(userId, true);

            return {
                message: 'Mobile number verified successfully',
                is_mobile_verified: true
            };
        } catch (error) {
            if (error instanceof AppError) {
                throw error;
            }
            console.error('OTP verification failed:', error);
            throw new AppError('OTP verification failed. Please try again.', 400);
        }
    }

    // Resend email verification
    static async resendEmailVerification(userId) {
        const user = await UserModel.findById(userId);
        if (!user) {
            throw new AppError('User not found', 404);
        }

        if (user.is_email_verified) {
            throw new AppError('Email is already verified', 400);
        }

        try {
            await FirebaseService.sendEmailVerification(user.email);
            return {
                message: 'Email verification link sent successfully',
                email: user.email
            };
        } catch (error) {
            console.error('Email verification sending failed:', error);
            throw new AppError('Failed to send email verification. Please try again.', 500);
        }
    }

    // Verify email (called when user clicks verification link)
    static async verifyEmail(userId) {
        const user = await UserModel.findById(userId);
        if (!user) {
            throw new AppError('User not found', 404);
        }

        if (user.is_email_verified) {
            return {
                message: 'Email is already verified',
                is_email_verified: true
            };
        }

        // Update verification status in database
        await UserModel.updateEmailVerification(userId, true);

        return {
            message: 'Email verified successfully',
            is_email_verified: true
        };
    }

    // Check verification status
    static async getVerificationStatus(userId) {
        const user = await UserModel.findById(userId);
        if (!user) {
            throw new AppError('User not found', 404);
        }

        return {
            is_email_verified: user.is_email_verified,
            is_mobile_verified: user.is_mobile_verified,
            email: user.email,
            mobile_no: user.mobile_no
        };
    }

    // Change password
    static async changePassword(userId, currentPassword, newPassword) {
        const user = await UserModel.findByEmail(userId);
        if (!user) {
            throw new AppError('User not found', 404);
        }

        // Verify current password
        const isCurrentPasswordValid = await UserModel.verifyPassword(currentPassword, user.password);
        if (!isCurrentPasswordValid) {
            throw new AppError('Current password is incorrect', 400);
        }

        // Update password in Firebase
        try {
            await FirebaseService.updatePassword(user.email, newPassword);
        } catch (error) {
            console.error('Firebase password update failed:', error);
        }

        // Hash and update password in database
        const bcrypt = require('bcrypt');
        const saltRounds = 12;
        const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);

        await UserModel.update(userId, { password: hashedNewPassword });

        return {
            message: 'Password changed successfully'
        };
    }

    // Delete user account
    static async deleteAccount(userId) {
        const user = await UserModel.findById(userId);
        if (!user) {
            throw new AppError('User not found', 404);
        }

        // Delete from Firebase
        try {
            await FirebaseService.deleteUser(user.email);
        } catch (error) {
            console.error('Firebase user deletion failed:', error);
        }

        // Delete from database
        // Note: This might need to handle cascading deletes for company profiles
        const result = await UserModel.delete(userId);

        return {
            message: 'Account deleted successfully'
        };
    }
}

module.exports = UserService;