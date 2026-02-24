import { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { getServiceLogger } from '../utils/logger.js';
import { getCloudFrontUrl } from '../services/aws.service.js';

const logger = getServiceLogger("SavedJobs");

interface AuthRequest extends Request {
    user?: {
        id: number | string;
        role: string;
    };
}

export const addToSavedJobs = async (req: AuthRequest, res: Response) => {
    const authId = req.user?.id as string;
    const { jobId } = req.body;

    if (!authId) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!jobId) {
        return res.status(400).json({ error: 'Job ID is required' });
    }

    try {
        // Validate User exists (optional if auth middleware works, but good for data integrity)
        // Validate Job exists
        const job = await prisma.job.findUnique({ where: { id: jobId } });
        if (!job) {
            return res.status(404).json({ error: 'Job not found' });
        }

        // Check for duplicate
        const existingSavedJob = await prisma.savedJob.findFirst({
            where: {
                userId: authId,
                jobId: jobId
            }
        });

        if (existingSavedJob) {
            return res.status(409).json({ error: 'Job already saved' });
        }

        const savedJob = await prisma.savedJob.create({
            data: {
                userId: authId,
                jobId: jobId
            },
            include: {
                job: true
            }
        });

        logger.info({ userId: authId, jobId }, 'Job saved successfully');
        res.status(201).json(savedJob);
    } catch (err) {
        logger.error({ err, userId: authId, jobId }, 'Database error during save job');
        res.status(500).json({ error: 'Database error' });
    }
};

export const removeFromSavedJobs = async (req: AuthRequest, res: Response) => {
    const authId = req.user?.id as string;
    const { jobId } = req.params;
    const jobIdStr = jobId as string;

    if (!authId) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        // Find the saved job entry for this user and job
        const savedJob = await prisma.savedJob.findFirst({
            where: {
                userId: authId,
                jobId: jobIdStr
            }
        });

        if (!savedJob) {
            // Alternatively check if it was finding by ID? 
            // If the user meant "SavedJob.id", then the lookup would be different. 
            // But usually deleting by JobID is the user intent "unsave this job".
            // I'll stick to JobId logic or check if the param matches a SavedJob.id?
            // UUIDs are unique.

            // Let's assume the param can be EITHER? Safe to valid check.
            // But simpler to just define one behavior. 
            // Given "Prevent duplicate", (User, Job) is unique.
            // So removing by JobId is unambiguous.

            return res.status(404).json({ error: 'Saved job not found' });
        }

        // Verify ownership (implicit in the findFirst query above by userId)

        await prisma.savedJob.delete({
            where: { id: savedJob.id }
        });

        logger.info({ userId: authId, savedJobId: savedJob.id }, 'Saved job removed');
        res.status(200).json({ message: 'Job removed from saved jobs' });
    } catch (err) {
        logger.error({ err, userId: authId, jobId: jobIdStr }, 'Database error during remove saved job');
        res.status(500).json({ error: 'Database error' });
    }
};


export const getSavedJobsByUserId = async (req: AuthRequest, res: Response) => {
    const authId = req.user?.id as string;

    try {
        const savedJobs = await prisma.savedJob.findMany({
            where: {
                userId: authId
            },
            include: {
                job: {
                    include: {
                        institute: {
                            include: { instituteImages: true }
                        }
                    }
                }
            }
        });

        // Map profile_picture onto each institute
        const mapped = savedJobs.map((s: any) => {
            if (s.job?.institute) {
                const imgs = s.job.institute.instituteImages;
                const img = Array.isArray(imgs) && imgs.length > 0 ? imgs[0] : null;
                s.job.institute.profile_picture = img?.profileImage ? getCloudFrontUrl(img.profileImage) : null;
            }
            return s;
        });

        logger.info({ userId: authId }, 'Saved jobs fetched successfully');
        res.status(200).json(mapped);
    } catch (err) {
        logger.error({ err, userId: authId }, 'Database error during get saved jobs');
        res.status(500).json({ error: 'Database error' });
    }
}