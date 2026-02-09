import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma.js';
import { subMinutes } from 'date-fns';

interface AuthRequest extends Request {
    user?: {
        id: string;
        role: string;
    };
}

export const viewTrackerMiddleware = async (req: AuthRequest, res: Response, next: NextFunction) => {
    const { id } = req.params as any;
    const jobId = id;

    if (!jobId) {
        return next();
    }

    // If anonymous, userId is null in DB
    const finalUserId: string | null = req.user?.id ? req.user.id : null;

    if (!finalUserId) {
        // Skip tracking if anonymous or just proceed with null? 
        // Schema allows null. Let's create with null.
    }

    try {
        // Avoid multiple logs within 10 minutes
        const recent = await prisma.jobView.findFirst({
            where: {
                jobId,
                userId: finalUserId,
                viewedAt: { gte: subMinutes(new Date(), 10) },
            },
        });

        if (!recent) {
            await prisma.jobView.create({
                data: { jobId, userId: finalUserId },
            });
        }
    } catch (err) {
        console.error('Error tracking job view:', err);
    }

    next();
};
