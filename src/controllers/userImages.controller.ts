import { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { getServiceLogger } from '../utils/logger.js';
import { uploadToS3, deleteFromS3, invalidateCloudFront, getCloudFrontUrl } from '../services/aws.service.js';
import path from 'path';

const logger = getServiceLogger('UserImages');

interface AuthRequest extends Request {
    user?: {
        id: number | string;
        role: string;
    };
}

export const uploadUserImages = async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id as string;

    if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    if (!files || (Object.keys(files).length === 0)) {
        return res.status(400).json({ error: 'No files uploaded' });
    }

    try {
        // Check if UserImages record exists
        let userImages = await prisma.userImages.findFirst({
            where: { userId }
        });

        // Prepare data to update/create
        const dataToUpdate: any = {};

        // Helper to handle single file implementation
        const handleFile = async (field: 'profileImage' | 'coverImage', subFolder: 'profile' | 'cover') => {
            if (files[field] && files[field][0]) {
                const file = files[field][0];
                const fileExt = path.extname(file.originalname);
                const uniqueName = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
                // Key format: uploads/users/{userId}/{subFolder}/{uuid}.ext
                const newKey = `uploads/users/${userId}/${subFolder}/${uniqueName}${fileExt}`;

                // Check old
                if (userImages && userImages[field]) {
                    const oldKey = userImages[field];
                    // Delete old from S3
                    await deleteFromS3(oldKey);
                    // Invalidate old path
                    await invalidateCloudFront(oldKey);
                }

                // Upload new
                await uploadToS3(file.buffer, newKey, file.mimetype);
                dataToUpdate[field] = newKey;
            }
        };

        await handleFile('profileImage', 'profile');
        await handleFile('coverImage', 'cover');

        if (userImages) {
            // Update existing
            userImages = await prisma.userImages.update({
                where: { id: userImages.id },
                data: dataToUpdate
            });
        } else {
            // Create new
            userImages = await prisma.userImages.create({
                data: {
                    userId,
                    profileImage: dataToUpdate.profileImage || '',
                    coverImage: dataToUpdate.coverImage || ''
                }
            });
        }

        // Return URLs instead of keys (optional, but good for immediate feedback)
        // But prompt says "Fetch images... Return full CloudFront URLs".
        // The return object is the DB record which has keys.
        // We can map it if frontend expects URLs immediately.
        // Let's modify result to inject URLs.
        const result = {
            ...userImages,
            profileImage: getCloudFrontUrl(userImages.profileImage),
            coverImage: getCloudFrontUrl(userImages.coverImage)
        };

        logger.info({ userId, updatedFields: Object.keys(dataToUpdate) }, 'User images updated');
        res.status(200).json(result);

    } catch (err: any) {
        logger.error({ err, userId }, 'Error uploading user images');
        res.status(500).json({ error: 'Upload failed', message: err.message });
    }
};

export const getUserImages = async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id as string;

    if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        const userImages = await prisma.userImages.findFirst({
            where: { userId }
        });

        if (!userImages) {
            return res.status(404).json({ message: 'No images found for this user', profileImage: null, coverImage: null });
        }

        const response = {
            ...userImages,
            profileImage: userImages.profileImage ? getCloudFrontUrl(userImages.profileImage) : null,
            coverImage: userImages.coverImage ? getCloudFrontUrl(userImages.coverImage) : null
        };

        res.status(200).json(response);
    } catch (err: any) {
        logger.error({ err, userId }, 'Error fetching user images');
        res.status(500).json({ error: 'Database error' });
    }
};

export const deleteUserImage = async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id as string;
    const { type } = req.params; // 'profile' or 'cover'

    if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    if (type !== 'profile' && type !== 'cover') {
        return res.status(400).json({ error: 'Invalid image type. Must be "profile" or "cover"' });
    }

    try {
        const userImages = await prisma.userImages.findFirst({
            where: { userId }
        });

        if (!userImages) {
            return res.status(404).json({ error: 'No images record found' });
        }

        const dataToUpdate: any = {};

        let keyToDelete = '';

        if (type === 'profile' && userImages.profileImage) {
            keyToDelete = userImages.profileImage;
            dataToUpdate.profileImage = '';
        } else if (type === 'cover' && userImages.coverImage) {
            keyToDelete = userImages.coverImage;
            dataToUpdate.coverImage = '';
        } else {
            return res.status(400).json({ message: 'Image already empty or not found' });
        }

        // Perform S3 Deletion
        await deleteFromS3(keyToDelete);
        await invalidateCloudFront(keyToDelete);

        const updated = await prisma.userImages.update({
            where: { id: userImages.id },
            data: dataToUpdate
        });

        logger.info({ userId, deletedType: type }, 'User image deleted');

        // Return updated result with URLs (empty)
        const result = {
            ...updated,
            profileImage: getCloudFrontUrl(updated.profileImage),
            coverImage: getCloudFrontUrl(updated.coverImage)
        };
        res.status(200).json(result);

    } catch (err: any) {
        logger.error({ err, userId, type }, 'Error deleting user image');
        res.status(500).json({ error: 'Server error during deletion' });
    }
};
