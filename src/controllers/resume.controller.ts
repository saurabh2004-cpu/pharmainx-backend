import { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { prisma } from '../lib/prisma.js';

const uploadDir = 'uploads/resume';

export const downloadResume = async (req: Request, res: Response) => {
    const { userId } = req.params;

    if (!userId) {
        return res.status(400).json({ error: 'User ID is required' });
    }

    // Security check: Prevent directory traversal
    if (userId.includes('..') || userId.includes('/') || userId.includes('\\')) {
        return res.status(400).json({ error: 'Invalid User ID' });
    }

    // 1. Check for local legacy file first
    const extensions = ['.pdf', '.doc', '.docx'];
    let localFilePath: string | null = null;

    for (const ext of extensions) {
        const potentialPath = path.join(uploadDir, `${userId}${ext}`);
        if (fs.existsSync(potentialPath)) {
            localFilePath = potentialPath;
            break;
        }
    }

    if (localFilePath) {
        const absolutePath = path.resolve(localFilePath);
        return res.download(absolutePath, (err) => {
            if (err) {
                console.error('Error downloading file:', err);
                if (!res.headersSent) {
                    res.status(500).json({ error: 'Error downloading file' });
                }
            }
        });
    }

    // 2. If no local file, check database for S3/CloudFront URL
    try {
        const application = await prisma.application.findFirst({
            where: { userId: String(userId) },
            orderBy: { created_at: 'desc' },
            select: { resumeUrl: true }
        });

        if (application && application.resumeUrl) {
            if (application.resumeUrl.startsWith('http')) {
                return res.redirect(application.resumeUrl);
            }

            // If it's a relative path that we didn't find locally above (unlikely but safe)
            const absolutePath = path.resolve(application.resumeUrl);
            if (fs.existsSync(absolutePath)) {
                return res.download(absolutePath);
            }
        }

        res.status(404).json({ error: 'Resume not found for this user' });
    } catch (error) {
        console.error('Error fetching resume from DB:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
