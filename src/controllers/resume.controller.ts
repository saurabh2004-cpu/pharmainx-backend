import { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { prisma } from '../lib/prisma.js';
import { s3Client } from '../services/aws.service.js';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const uploadDir = 'uploads/resume';

export const downloadResume = async (req: Request, res: Response) => {
    const { userId } = req.params;

    if (!userId) {
        return res.status(400).json({ error: 'User ID is required' });
    }

    if (userId.includes('..') || userId.includes('/') || userId.includes('\\')) {
        return res.status(400).json({ error: 'Invalid User ID' });
    }

    // 1. Check for local legacy file first
    const extensions = ['.pdf', '.doc', '.docx'];
    for (const ext of extensions) {
        const potentialPath = path.join(uploadDir, `${userId}${ext}`);
        if (fs.existsSync(potentialPath)) {
            const absolutePath = path.resolve(potentialPath);
            return res.download(absolutePath, (err) => {
                if (err && !res.headersSent) {
                    res.status(500).json({ error: 'Error downloading file' });
                }
            });
        }
    }

    // 2. Check DB for resumeUrl
    try {
        const application = await prisma.application.findFirst({
            where: { userId: String(userId) },
            orderBy: { created_at: 'desc' },
            select: { resumeUrl: true }
        });

        if (!application?.resumeUrl) {
            return res.status(404).json({ error: 'Resume not found for this user' });
        }

        const resumeUrl = application.resumeUrl;

        if (resumeUrl.startsWith('http')) {
            // Extract the S3 key from the stored CloudFront URL
            // e.g. https://xxxx.cloudfront.net/resumes/userId.pdf → resumes/userId.pdf
            let s3Key: string;
            try {
                s3Key = new URL(resumeUrl).pathname.replace(/^\//, '');
            } catch {
                return res.status(500).json({ error: 'Invalid resume URL stored in database' });
            }

            // Generate a presigned S3 URL (valid for 60 seconds)
            const command = new GetObjectCommand({
                Bucket: process.env.AWS_S3_BUCKET_NAME!,
                Key: s3Key,
                ResponseContentDisposition: `attachment; filename="resume_${userId}${path.extname(s3Key) || '.pdf'}"`,
            });

            const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn: 60 });

            // Redirect client directly to S3 — no proxying needed
            return res.redirect(presignedUrl);
        }

        // Legacy: local path stored in DB
        const absolutePath = path.resolve(resumeUrl);
        if (fs.existsSync(absolutePath)) {
            return res.download(absolutePath);
        }

        return res.status(404).json({ error: 'Resume file not found' });

    } catch (error) {
        console.error('Error in downloadResume:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};