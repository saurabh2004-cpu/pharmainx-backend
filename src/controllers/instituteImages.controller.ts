import { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { getServiceLogger } from '../utils/logger.js';
import { uploadToS3, deleteFromS3, invalidateCloudFront, getCloudFrontUrl } from '../services/aws.service.js';
import path from 'path';

const logger = getServiceLogger('InstituteImages');

interface AuthRequest extends Request {
    user?: {
        id: number | string;
        role: string;
    };
}

export const uploadInstituteImages = async (req: AuthRequest, res: Response) => {
    const instituteId = req.user?.id as string;

    if (!instituteId) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    if (!files || (Object.keys(files).length === 0)) {
        return res.status(400).json({ error: 'No files uploaded' });
    }

    try {
        let instImages = await prisma.instituteImages.findFirst({
            where: { instituteId }
        });

        const dataToUpdate: any = {};

        const handleFile = async (field: 'profileImage' | 'coverImage', subFolder: 'profile' | 'cover') => {
            if (files[field] && files[field][0]) {
                const file = files[field][0];
                const fileExt = path.extname(file.originalname);
                const uniqueName = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
                // Key format: uploads/institutes/{instituteId}/{subFolder}/{uuid}.ext
                const newKey = `uploads/institutes/${instituteId}/${subFolder}/${uniqueName}${fileExt}`;

                // Check old
                if (instImages && instImages[field]) {
                    const oldKey = instImages[field];
                    await deleteFromS3(oldKey);
                    await invalidateCloudFront(oldKey);
                }

                // Upload new
                await uploadToS3(file.buffer, newKey, file.mimetype);
                dataToUpdate[field] = newKey;
            }
        };

        await handleFile('profileImage', 'profile');
        await handleFile('coverImage', 'cover');

        if (instImages) {
            instImages = await prisma.instituteImages.update({
                where: { id: instImages.id },
                data: dataToUpdate
            });
        } else {
            instImages = await prisma.instituteImages.create({
                data: {
                    instituteId,
                    profileImage: dataToUpdate.profileImage || '',
                    coverImage: dataToUpdate.coverImage || ''
                }
            });
        }

        const result = {
            ...instImages,
            profileImage: getCloudFrontUrl(instImages.profileImage),
            coverImage: getCloudFrontUrl(instImages.coverImage)
        };

        logger.info({ instituteId, updatedFields: Object.keys(dataToUpdate) }, 'Institute images updated');
        res.status(200).json(result);

    } catch (err: any) {
        logger.error({ err, instituteId }, 'Error uploading institute images');
        res.status(500).json({ error: 'Upload failed', message: err.message });
    }
};

export const getInstituteImages = async (req: AuthRequest, res: Response) => {
    const instituteId = req.user?.id as string;

    if (!instituteId) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        const instImages = await prisma.instituteImages.findFirst({
            where: { instituteId }
        });

        if (!instImages) {
            return res.status(404).json({ message: 'No images found for this institute', profileImage: null, coverImage: null });
        }

        const response = {
            ...instImages,
            profileImage: instImages.profileImage ? getCloudFrontUrl(instImages.profileImage) : null,
            coverImage: instImages.coverImage ? getCloudFrontUrl(instImages.coverImage) : null
        };

        res.status(200).json(response);
    } catch (err: any) {
        logger.error({ err, instituteId }, 'Error fetching institute images');
        res.status(500).json({ error: 'Database error' });
    }
};

export const deleteInstituteImage = async (req: AuthRequest, res: Response) => {
    const instituteId = req.user?.id as string;
    const { type } = req.params;

    if (!instituteId) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    if (type !== 'profile' && type !== 'cover') {
        return res.status(400).json({ error: 'Invalid image type. Must be "profile" or "cover"' });
    }

    try {
        const instImages = await prisma.instituteImages.findFirst({
            where: { instituteId }
        });

        if (!instImages) {
            return res.status(404).json({ error: 'No images record found' });
        }

        const dataToUpdate: any = {};
        let keyToDelete = '';

        if (type === 'profile' && instImages.profileImage) {
            keyToDelete = instImages.profileImage;
            dataToUpdate.profileImage = '';
        } else if (type === 'cover' && instImages.coverImage) {
            keyToDelete = instImages.coverImage;
            dataToUpdate.coverImage = '';
        } else {
            return res.status(400).json({ message: 'Image already empty or not found' });
        }

        await deleteFromS3(keyToDelete);
        await invalidateCloudFront(keyToDelete);

        const updated = await prisma.instituteImages.update({
            where: { id: instImages.id },
            data: dataToUpdate
        });

        logger.info({ instituteId, deletedType: type }, 'Institute image deleted');

        const result = {
            ...updated,
            profileImage: getCloudFrontUrl(updated.profileImage),
            coverImage: getCloudFrontUrl(updated.coverImage)
        };
        res.status(200).json(result);

    } catch (err: any) {
        logger.error({ err, instituteId, type }, 'Error deleting institute image');
        res.status(500).json({ error: 'Server error during deletion' });
    }
};
