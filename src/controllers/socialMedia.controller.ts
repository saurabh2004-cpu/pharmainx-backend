import { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';

interface AuthRequest extends Request {
    user?: {
        id: number | string;
        role: string;
    };
}

// ==========================================
// USER SOCIAL MEDIA CONTROLLERS
// ==========================================

export const createUserSocialMediaLink = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.id as string;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { link, platform } = req.body;
        if (!link || !platform) {
            return res.status(400).json({ error: 'Link and platform are required' });
        }

        const newLink = await prisma.userSocialMediaLinks.create({
            data: {
                userId,
                link,
                platform
            }
        });

        res.status(201).json(newLink);
    } catch (error: any) {
        console.error('Error creating user social media link:', error);
        res.status(500).json({ error: 'Internal Server Error', message: error.message });
    }
};

export const deleteUserSocialMediaLink = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.id as string;
        const { id } = req.params;

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        // Verify the link belongs to the user
        const link = await prisma.userSocialMediaLinks.findUnique({
            where: { id: id.toString() }
        });

        if (!link || link.userId !== userId) {
            return res.status(404).json({ error: 'Social media link not found or unauthorized' });
        }

        await prisma.userSocialMediaLinks.delete({
            where: { id: id.toString() }
        });

        res.status(200).json({ message: 'Social media link deleted successfully' });
    } catch (error: any) {
        console.error('Error deleting user social media link:', error);
        res.status(500).json({ error: 'Internal Server Error', message: error.message });
    }
};

export const getUserSocialMediaLinks = async (req: Request, res: Response) => {
    try {
        const { userId } = req.params;

        const links = await prisma.userSocialMediaLinks.findMany({
            where: { userId: userId.toString() }
        });

        res.status(200).json(links);
    } catch (error: any) {
        console.error('Error fetching user social media links:', error);
        res.status(500).json({ error: 'Internal Server Error', message: error.message });
    }
};

// ==========================================
// INSTITUTE SOCIAL MEDIA CONTROLLERS
// ==========================================

export const createInstituteSocialMediaLink = async (req: AuthRequest, res: Response) => {
    try {
        const instituteId = req.user?.id as string;
        if (!instituteId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { link, platform } = req.body;
        if (!link || !platform) {
            return res.status(400).json({ error: 'Link and platform are required' });
        }

        const newLink = await prisma.instituteSocialMediaLinks.create({
            data: {
                instituteId,
                link,
                platform
            }
        });

        res.status(201).json(newLink);
    } catch (error: any) {
        console.error('Error creating institute social media link:', error);
        res.status(500).json({ error: 'Internal Server Error', message: error.message });
    }
};

export const deleteInstituteSocialMediaLink = async (req: AuthRequest, res: Response) => {
    try {
        const instituteId = req.user?.id as string;
        const { id } = req.params;

        if (!instituteId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const link = await prisma.instituteSocialMediaLinks.findUnique({
            where: { id: id.toString() }
        });

        if (!link || link.instituteId !== instituteId) {
            return res.status(404).json({ error: 'Social media link not found or unauthorized' });
        }

        await prisma.instituteSocialMediaLinks.delete({
            where: { id: id.toString() }
        });

        res.status(200).json({ message: 'Social media link deleted successfully' });
    } catch (error: any) {
        console.error('Error deleting institute social media link:', error);
        res.status(500).json({ error: 'Internal Server Error', message: error.message });
    }
};

export const getInstituteSocialMediaLinks = async (req: Request, res: Response) => {
    try {
        const { instituteId } = req.params;

        const links = await prisma.instituteSocialMediaLinks.findMany({
            where: { instituteId: instituteId.toString() }
        });

        res.status(200).json(links);
    } catch (error: any) {
        console.error('Error fetching institute social media links:', error);
        res.status(500).json({ error: 'Internal Server Error', message: error.message });
    }
};
