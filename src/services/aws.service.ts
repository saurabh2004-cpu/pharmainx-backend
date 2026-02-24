import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { CloudFrontClient, CreateInvalidationCommand } from '@aws-sdk/client-cloudfront';
import { getServiceLogger } from '../utils/logger.js';
import path from 'path';

const logger = getServiceLogger('AWS:Service');

// Initialize S3 Client
const s3Client = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || ''
    }
});

// Initialize CloudFront Client
const cloudFrontClient = new CloudFrontClient({
    region: process.env.AWS_REGION, // CloudFront is global, but SDK usually takes a region or defaults
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || ''
    }
});

const BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME || '';
const CLOUDFRONT_BASE_URL = process.env.CLOUDFRONT_BASE_URL || '';
const CLOUDFRONT_DISTRIBUTION_ID = process.env.CLOUDFRONT_DISTRIBUTION_ID || '';

/**
 * Uploads a file buffer to S3
 * @param buffer - File content
 * @param key - S3 object key (path)
 * @param contentType - MIME type
 * @returns Promise<void>
 */
export const uploadToS3 = async (buffer: Buffer, key: string, contentType: string): Promise<void> => {
    try {
        const command = new PutObjectCommand({
            Bucket: BUCKET_NAME,
            Key: key,
            Body: buffer,
            ContentType: contentType,
            // ACL: 'private' // Default is usually private, explicit setting varies by bucket settings
        });

        await s3Client.send(command);
        logger.info({ key }, 'Successfully uploaded to S3');
    } catch (error: any) {
        logger.error({ err: error, key, message: error.message }, 'Failed to upload to S3');
        throw new Error(`S3 Upload Failed: ${error.message}`);
    }
};

/**
 * Deletes a file from S3
 * @param key - S3 object key
 * @returns Promise<void>
 */
export const deleteFromS3 = async (key: string): Promise<void> => {
    try {
        if (!key) return;

        const command = new DeleteObjectCommand({
            Bucket: BUCKET_NAME,
            Key: key
        });

        await s3Client.send(command);
        logger.info({ key }, 'Successfully deleted from S3');
    } catch (error: any) {
        logger.error({ err: error, key, message: error.message }, 'Failed to delete from S3');
        // We log but maybe don't throw to allow flow to continue? 
        // Throwing ensures caller tests persistence.
        throw new Error(`S3 Delete Failed: ${error.message}`);
    }
};

/**
 * Invalidates a CloudFront path
 * @param key - S3 object key or path relative to distribution root
 * @returns Promise<void>
 */
export const invalidateCloudFront = async (key: string): Promise<void> => {
    try {
        if (!key || !CLOUDFRONT_DISTRIBUTION_ID) return;

        // Path must start with / for CloudFront
        const invalidationPath = key.startsWith('/') ? key : `/${key}`;

        const command = new CreateInvalidationCommand({
            DistributionId: CLOUDFRONT_DISTRIBUTION_ID,
            InvalidationBatch: {
                CallerReference: `${Date.now()}-${Math.random()}`, // Unique string
                Paths: {
                    Quantity: 1,
                    Items: [invalidationPath]
                }
            }
        });

        await cloudFrontClient.send(command);
        logger.info({ path: invalidationPath }, 'Requested CloudFront invalidation');
    } catch (error: any) {
        logger.error({ err: error, key, message: error.message }, 'Failed to invalidate CloudFront');
        // Don't block main flow for cache invalidation failure, just log
    }
};

/**
 * Generates the full CloudFront URL for a given key
 * @param key - S3 object key
 * @returns string - Full URL
 */
export const getCloudFrontUrl = (key: string): string => {
    if (!key) return '';
    // If key is already a full URL, return as-is
    if (key.startsWith('http://') || key.startsWith('https://')) return key;

    const cleanKey = key.startsWith('/') ? key.substring(1) : key;

    // Normalize base URL — ensure it has https://
    let cleanBase = CLOUDFRONT_BASE_URL.endsWith('/') ? CLOUDFRONT_BASE_URL.slice(0, -1) : CLOUDFRONT_BASE_URL;
    if (!cleanBase.startsWith('http://') && !cleanBase.startsWith('https://')) {
        cleanBase = `https://${cleanBase}`;
    }

    return `${cleanBase}/${cleanKey}`;
};
