const cloudinary = require('cloudinary').v2;
const createError = require('http-errors');


// Configure Cloudinary (make sure to set these in your environment variables)
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true
});

class CloudinaryService {
    /**
     * Upload image to Cloudinary with basic optimizations
     * Time Complexity: O(1) - API call
     * @param {Object} file - Multer file object or buffer
     * @param {Object} options - Upload options
     * @returns {Promise<Object>} Upload result
     */
    static async uploadImage(file, options = {}) {
        try {
            // Default upload options with Cloudinary's built-in transformations
            const defaultOptions = {
                resource_type: 'image',
                quality: 'auto:best',
                fetch_format: 'auto',
                secure: true,
                unique_filename: true,
                use_filename: false,
                overwrite: false,
                invalidate: true,
                ...options
            };
            
            // Upload to Cloudinary directly
            return new Promise((resolve, reject) => {
                const uploadStream = cloudinary.uploader.upload_stream(
                    defaultOptions,
                    (error, result) => {
                        if (error) {
                            console.error('Cloudinary upload error:', error);
                            reject(createError(500, 'Failed to upload image to cloud storage'));
                        } else {
                            resolve(result);
                        }
                    }
                );
                
                // Use the file buffer directly
                uploadStream.end(file.buffer);
            });
            
        } catch (error) {
            console.error('Image upload service error:', error);
            throw createError(500, 'Image upload failed');
        }
    }
    
    // Remove the optimizeImage method entirely since it used Sharp
    // Remove the mapCloudinaryCropToSharp method entirely
    
    /**
     * Delete image from Cloudinary
     * Time Complexity: O(1) - API call
     * @param {string} imageUrl - Cloudinary image URL
     * @returns {Promise<Object>} Deletion result
     */
    static async deleteImage(imageUrl) {
        try {
            if (!imageUrl || !imageUrl.includes('cloudinary.com')) {
                return { result: 'ok', message: 'No valid Cloudinary URL provided' };
            }
            
            // Extract public_id from URL
            const publicId = this.extractPublicIdFromUrl(imageUrl);
            
            if (!publicId) {
                throw new Error('Could not extract public_id from URL');
            }
            
            const result = await cloudinary.uploader.destroy(publicId);
            return result;
            
        } catch (error) {
            console.error('Cloudinary delete error:', error);
            // Don't throw error for delete failures, just log them
            return { result: 'error', message: error.message };
        }
    }
    
    /**
     * Extract public_id from Cloudinary URL
     * Time Complexity: O(1)
     * @param {string} imageUrl - Cloudinary image URL
     * @returns {string} Public ID
     */
    static extractPublicIdFromUrl(imageUrl) {
        try {
            // Handle different URL formats
            const regex = /\/(?:v\d+\/)?(?:.*\/)?([^\/]+)\.[^\/]+$/;
            const match = imageUrl.match(regex);
            
            if (match) {
                let publicId = match[1];
                
                // Handle nested folders (extract from path)
                const pathRegex = /\/(?:v\d+\/)?(.+)\.[^\/]+$/;
                const pathMatch = imageUrl.match(pathRegex);
                
                if (pathMatch) {
                    publicId = pathMatch[1];
                }
                
                return publicId;
            }
            
            return null;
            
        } catch (error) {
            console.error('Error extracting public_id:', error);
            return null;
        }
    }
    
    /**
     * Generate optimized image URL with transformations
     * Time Complexity: O(1)
     * @param {string} publicId - Cloudinary public ID
     * @param {Object} transformations - Transformation options
     * @returns {string} Optimized image URL
     */
    static generateOptimizedUrl(publicId, transformations = {}) {
        try {
            return cloudinary.url(publicId, {
                secure: true,
                quality: 'auto:best',
                fetch_format: 'auto',
                ...transformations
            });
            
        } catch (error) {
            console.error('Error generating optimized URL:', error);
            return null;
        }
    }
    
    /**
     * Get image details from Cloudinary
     * Time Complexity: O(1) - API call
     * @param {string} publicId - Cloudinary public ID
     * @returns {Promise<Object>} Image details
     */
    static async getImageDetails(publicId) {
        try {
            const result = await cloudinary.api.resource(publicId);
            return {
                public_id: result.public_id,
                format: result.format,
                width: result.width,
                height: result.height,
                bytes: result.bytes,
                url: result.secure_url,
                created_at: result.created_at
            };
            
        } catch (error) {
            console.error('Error getting image details:', error);
            throw createError(404, 'Image not found in cloud storage');
        }
    }
    
    /**
     * Validate image file before upload (basic validation without Sharp)
     * Time Complexity: O(1)
     * @param {Object} file - Multer file object
     * @param {Object} options - Validation options
     * @returns {Object} Validation result
     */
    static validateImageFile(file, options = {}) {
        const {
            maxSize = 5 * 1024 * 1024, // 5MB default
            allowedFormats = ['jpg', 'jpeg', 'png', 'webp', 'gif']
            // Note: Can't validate dimensions without Sharp
        } = options;
        
        const errors = [];
        
        // Check file existence
        if (!file) {
            errors.push('No file provided');
            return { isValid: false, errors };
        }
        
        // Check file size
        if (file.size > maxSize) {
            errors.push(`File size exceeds maximum limit of ${Math.round(maxSize / (1024 * 1024))}MB`);
        }
        
        // Check file format
        const fileExtension = file.originalname.split('.').pop().toLowerCase();
        if (!allowedFormats.includes(fileExtension)) {
            errors.push(`Invalid file format. Allowed formats: ${allowedFormats.join(', ')}`);
        }
        
        // Check MIME type
        const allowedMimeTypes = [
            'image/jpeg',
            'image/jpg', 
            'image/png',
            'image/webp',
            'image/gif'
        ];
        
        if (!allowedMimeTypes.includes(file.mimetype)) {
            errors.push('Invalid file type. Please upload a valid image file');
        }
        
        return {
            isValid: errors.length === 0,
            errors
        };
    }
    
    /**
     * Generate thumbnail URL using Cloudinary transformations
     * Time Complexity: O(1)
     * @param {string} imageUrl - Original image URL
     * @param {Object} options - Thumbnail options
     * @returns {string} Thumbnail URL
     */
    static generateThumbnail(imageUrl, options = {}) {
        try {
            const {
                width = 150,
                height = 150,
                crop = 'fill',
                quality = 'auto:best'
            } = options;
            
            // Extract public_id from URL
            const publicId = this.extractPublicIdFromUrl(imageUrl);
            
            if (!publicId) {
                return imageUrl; // Return original if can't extract public_id
            }
            
            return cloudinary.url(publicId, {
                width,
                height,
                crop,
                quality,
                fetch_format: 'auto',
                secure: true
            });
            
        } catch (error) {
            console.error('Error generating thumbnail:', error);
            return imageUrl; // Return original URL on error
        }
    }
    
    /**
     * Bulk delete images
     * Time Complexity: O(n) where n is number of images
     * @param {Array<string>} imageUrls - Array of image URLs to delete
     * @returns {Promise<Array>} Array of deletion results
     */
    static async bulkDeleteImages(imageUrls) {
        try {
            const deletePromises = imageUrls
                .filter(url => url && url.includes('cloudinary.com'))
                .map(url => this.deleteImage(url));
            
            const results = await Promise.allSettled(deletePromises);
            
            return results.map((result, index) => ({
                url: imageUrls[index],
                success: result.status === 'fulfilled',
                result: result.status === 'fulfilled' ? result.value : result.reason
            }));
            
        } catch (error) {
            console.error('Bulk delete error:', error);
            throw createError(500, 'Bulk image deletion failed');
        }
    }
    
    /**
     * Check Cloudinary configuration
     * Time Complexity: O(1)
     * @returns {boolean} Configuration status
     */
    static isConfigured() {
        return !!(
            process.env.CLOUDINARY_CLOUD_NAME &&
            process.env.CLOUDINARY_API_KEY &&
            process.env.CLOUDINARY_API_SECRET
        );
    }
    
    /**
     * Get Cloudinary usage statistics
     * Time Complexity: O(1) - API call
     * @returns {Promise<Object>} Usage statistics
     */
    static async getUsageStats() {
        try {
            const result = await cloudinary.api.usage();
            return {
                used_percent: result.used_percent,
                credits_used: result.credits_used,
                credits_limit: result.credits_limit,
                bandwidth_used: result.bandwidth_used,
                storage_used: result.storage_used,
                requests_made: result.requests_made
            };
            
        } catch (error) {
            console.error('Error getting usage stats:', error);
            throw createError(500, 'Failed to retrieve usage statistics');
        }
    }
}

// Validate configuration on module load
if (!CloudinaryService.isConfigured()) {
    console.warn(' Cloudinary configuration missing. Please set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET environment variables.');
}

module.exports = CloudinaryService;