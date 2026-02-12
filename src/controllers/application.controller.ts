import { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { getServiceLogger } from '../utils/logger.js';
import { ApplicationCreateUpdateSchema } from '../types/application.js';
import { Prisma, ApplicationStatus } from '../generated/prisma/client.js';
import { sendNotification } from '../utils/notification.service.js';
import { InstituteRoles } from './job.controller.js';

const logger = getServiceLogger("Application");

interface AuthRequest extends Request {
    user?: {
        id: string;
        role: string;
    };
    file?: any;
}

// --- READ OPERATIONS (Kept for compatibility) ---

export const getApplicationsByJobId = async (req: AuthRequest, res: Response) => {
    // ... existing logic ...
    const { jobId } = req.params as any;
    try {
        const applications = await prisma.application.findMany({
            where: { jobId },
            include: { user: true, job: true },
        });

        console.log("applications", applications[0]);
        res.status(200).json(applications);
    } catch (err) {
        res.status(500).json({ error: 'Database error' });
    }
};

export const getApplicationsByUserId = async (req: AuthRequest, res: Response) => {
    const { userId } = req.params as any;
    try {
        const applications = await prisma.application.findMany({
            where: { userId },
            include: { job: true },
        });
        res.status(200).json(applications);
    } catch (err) {
        res.status(500).json({ error: 'Database error' });
    }
};

export const getApplicationById = async (req: AuthRequest, res: Response) => {
    const { id } = req.params as any;
    try {
        const application = await prisma.application.findUnique({
            where: { id },
            include: { job: true, user: true },
        });
        if (!application) return res.status(404).json({ error: 'Application not found' });
        res.status(200).json(application);
    } catch (err) {
        res.status(500).json({ error: 'Database error' });
    }
};

// --- APPLICATION LIFECYCLE CONTROLLERS ---

// STEP 1: Job Seeker Applies
export const applyForJob = async (req: AuthRequest, res: Response) => {
    const authUserId = req.user?.id;
    if (!authUserId) return res.status(401).json({ error: 'Unauthorized' });

    // --- PROFILE COMPLETION VALIDATION START ---
    try {
        const educations = await prisma.userEducation.findMany({
            where: { userId: authUserId }
        });

        const experiences = await prisma.userExperiences.findMany({
            where: { userId: authUserId }
        });

        const skills = await prisma.userSkills.findMany({
            where: { userId: authUserId }
        });

        const user = await prisma.user.findUnique({
            where: { id: authUserId },
            select: { speciality: true }
        });

        const isStudent = req.user?.role === 'STUDENT';

        // 1. Common checks for everyone
        if (
            educations.length === 0 ||
            skills.length === 0 ||
            !user?.speciality
        ) {
            return res.status(400).json({
                error: "Profile incomplete. Please complete your education, skills, and speciality before applying."
            });
        }

        // 2. Extra check for non-students (Experience required)
        if (!isStudent && experiences.length === 0) {
            return res.status(400).json({
                error: "Profile incomplete. Please add your experience details before applying."
            });
        }

    } catch (validationErr) {
        logger.error({ validationErr }, "Error validating profile completeness");
        return res.status(500).json({ error: "Failed to validate profile completeness" });
    }
    // --- PROFILE COMPLETION VALIDATION END ---

    // Handle file upload stuff from previous controller if needed
    let resumeUrl = req.body.resumeUrl || "";
    if (req.file) {
        resumeUrl = req.file.path.replace(/\\/g, '/');
    }

    const { jobId, coverLetter, experienceYears, currentPosition, currentInstitute, additionalDetails } = req.body;

    // Validate inputs (Basic)
    if (!jobId || !resumeUrl) {
        return res.status(400).json({ error: "Job ID and Resume URL are required" });
    }

    try {
        // Fetch Job to get Institute ID
        const job = await prisma.job.findUnique({ where: { id: jobId } });
        if (!job) return res.status(404).json({ error: "Job not found" });

        // Check if already applied
        const existing = await prisma.application.findFirst({
            where: { jobId, userId: authUserId },
        });
        if (existing) return res.status(409).json({ error: "Already applied" });

        const application = await prisma.application.create({
            data: {
                userId: authUserId,
                jobId,
                resumeUrl,
                coverLetter,
                experienceYears: experienceYears ? parseInt(experienceYears) : undefined,
                currentPosition,
                currentInstitute,
                additionalDetails: additionalDetails ? JSON.parse(additionalDetails) : undefined,
                status: 'APPLIED'
            },
            include: { job: true, user: true } // Include for response
        });

        // Notify Institute
        await sendNotification({
            receiverId: job.instituteId,
            receiverRole: 'INSTITUTE',
            title: 'New Job Application',
            message: `User ${application.user.firstName} ${application.user.lastName} applied for ${job.title}`,
            relatedJobId: jobId,
            relatedApplicationId: application.id,
            status: 'APPLIED'
        });

        res.status(201).json(application);
    } catch (err) {
        logger.error({ err }, "Error applying for job");
        res.status(500).json({ error: "Database error" });
    }
};

// STEP 2: Institute Shortlists Job Seeker
export const shortList = async (req: AuthRequest, res: Response) => {
    const { id } = req.params as any;
    const authId = req.user?.id;
    const role = req.user?.role;

    if (!InstituteRoles.includes(role || '')) return res.status(403).json({ error: "Forbidden" });

    try {
        const app = await prisma.application.findUnique({
            where: { id },
            include: { job: true }
        });
        if (!app) return res.status(404).json({ error: "Application not found" });
        if (app.job.instituteId !== authId) return res.status(403).json({ error: "Forbidden" });

        const updated = await prisma.application.update({
            where: { id },
            data: { status: 'SHORTLISTED' }
        });

        await sendNotification({
            receiverId: app.userId,
            receiverRole: 'USER',
            title: 'Application Shortlisted',
            message: `Your application for ${app.job.title} was shortlisted.`,
            relatedJobId: app.jobId,
            status: 'SHORTLISTED',
            relatedApplicationId: app.id
        });

        res.status(200).json(updated);
    } catch (err: any) {
        logger.error(err);
        res.status(500).json({ error: "Database error" });
    }
};

// STEP 2: Institute Requests Next Round
export const requestNextRound = async (req: AuthRequest, res: Response) => {
    const { id } = req.params as any;
    const authId = req.user?.id;
    const role = req.user?.role;

    if (!InstituteRoles.includes(role || '')) return res.status(403).json({ error: "Only institutes can perform this action" });

    try {
        const app = await prisma.application.findUnique({
            where: { id },
            include: { job: true }
        });
        if (!app) return res.status(404).json({ error: "Application not found" });

        // Verify ownership
        if (app.job.instituteId !== authId) return res.status(403).json({ error: "Forbidden" });

        const updated = await prisma.application.update({
            where: { id },
            data: { status: 'NEXT_ROUND_REQUESTED' }
        });

        // Notify User
        await sendNotification({
            receiverId: app.userId,
            receiverRole: 'USER',
            title: 'Next Round Requested',
            message: `The institute has requested a next round for your application to ${app.job.title}`,
            relatedJobId: app.jobId,
            relatedApplicationId: app.id,
            status: 'NEXT_ROUND_REQUESTED'
        });

        res.status(200).json(updated);
    } catch (err: any) {
        logger.error(err);
        res.status(500).json({ error: "Database error" });
    }
};

// STEP 3: Job Seeker Responds to Next Round
export const respondNextRound = async (req: AuthRequest, res: Response) => {
    const { id } = req.params as any;
    const { status } = req.body; // 'accept' or 'reject'
    const authUserId = req.user?.id;

    try {
        const app = await prisma.application.findUnique({
            where: { id },
            include: { job: true, user: true }
        });
        if (!app) return res.status(404).json({ error: "Application not found" });
        if (app.userId !== authUserId) return res.status(403).json({ error: "Forbidden" });

        let newStatus: ApplicationStatus;
        if (status === 'accept') newStatus = 'NEXT_ROUND_ACCEPTED';
        else if (status === 'reject') newStatus = 'NEXT_ROUND_REJECTED';
        else return res.status(400).json({ error: "Invalid action" });

        const updated = await prisma.application.update({
            where: { id },
            data: { status: newStatus }
        });

        // Notify Institute
        await sendNotification({
            receiverId: app.job.instituteId,
            receiverRole: 'INSTITUTE',
            title: `Next Round ${status === 'accept' ? 'Accepted' : 'Rejected'}`,
            message: `User ${app.user.firstName} ${app.user.lastName} has ${status}ed the next round request for ${app.job.title}`,
            relatedJobId: app.jobId,
            relatedApplicationId: app.id,
            status: newStatus
        });

        res.status(200).json(updated);
    } catch (err: any) {
        logger.error(err);
        res.status(500).json({ error: "Database error" });
    }
};

// STEP 4: Institute Schedules Interview
export const scheduleInterview = async (req: AuthRequest, res: Response) => {
    const { id } = req.params as any;
    const authId = req.user?.id;
    const role = req.user?.role;
    const { interviewType, interviewDate, interviewTime, interviewLink } = req.body;

    if (!InstituteRoles.includes(role || '')) return res.status(403).json({ error: "Forbidden" });


    try {
        const app = await prisma.application.findUnique({
            where: { id },
            include: { job: true }
        });
        if (!app) return res.status(404).json({ error: "Application not found" });
        if (app.job.instituteId !== authId) return res.status(403).json({ error: "Forbidden" });

        const updated = await prisma.application.update({
            where: { id },
            data: {
                status: 'INTERVIEW_SCHEDULED',
                // Assuming we might want to store interview details in additionalDetails or similar, skipping for now as per schema constraints
            }
        });

        const notificationMessage = interviewLink
            ? `Your interview has been scheduled for ${app.job.title} on ${interviewDate} at ${interviewTime}. Join using this link: ${interviewLink}`
            : `Your interview has been scheduled for ${app.job.title} on ${interviewDate} at ${interviewTime}.`;


        await sendNotification({
            receiverId: app.userId,
            receiverRole: 'USER',
            title: 'Interview Scheduled',
            message: notificationMessage,
            relatedJobId: app.jobId,
            relatedApplicationId: app.id,
            status: 'INTERVIEW_SCHEDULED'
        });

        res.status(200).json(updated);
    } catch (err: any) {
        logger.error(err);
        res.status(500).json({ error: "Database error" });
    }
};

// STEP 5: user Interview Decision
export const interviewDecision = async (req: AuthRequest, res: Response) => {
    const { id } = req.params as any;
    const { decision } = req.body; // 'accept' or 'reject'
    const authId = req.user?.id;
    const role = req.user?.role;

    // if (!InstituteRoles.includes(role || '')) return res.status(403).json({ error: "Forbidden" });

    try {
        const app = await prisma.application.findUnique({
            where: { id },
            include: { job: true }
        });
        if (!app) return res.status(404).json({ error: "Application not found" });
        // if (app.job.userId !== authId) return res.status(403).json({ error: "Forbidden" });
        const jobId = app.jobId;


        let newStatus: ApplicationStatus;
        if (decision === 'accept') newStatus = 'INTERVIEW_ACCEPTED';
        else if (decision === 'reject') newStatus = 'REJECTED';
        else return res.status(400).json({ error: "Invalid decision" });

        const updated = await prisma.application.update({
            where: { id },
            data: { status: newStatus }
        });

        await sendNotification({
            receiverId: app.job.instituteId,
            receiverRole: 'INSTITUTE',
            title: `Interview Result: ${decision === 'accept' ? 'Accepted' : 'Rejected'}`,
            message: `User has ${decision}ed the interview for ${app.job.title}.`,
            relatedJobId: app.jobId,
            relatedApplicationId: app.id,
            status: newStatus
        });

        res.status(200).json(updated);
    } catch (err: any) {
        logger.error(err);
        res.status(500).json({ error: "Database error" });
    }
};

// STEP 6: Institute Hires Job Seeker
export const hire = async (req: AuthRequest, res: Response) => {
    const { id } = req.params as any;
    const authId = req.user?.id;
    const role = req.user?.role;

    if (!InstituteRoles.includes(role || '')) return res.status(403).json({ error: "Forbidden" });

    try {
        const app = await prisma.application.findUnique({
            where: { id },
            include: { job: true }
        });
        if (!app) return res.status(404).json({ error: "Application not found" });
        if (app.job.instituteId !== authId) return res.status(403).json({ error: "Forbidden" });

        const updated = await prisma.application.update({
            where: { id },
            data: { status: 'HIRED' }
        });

        await sendNotification({
            receiverId: app.userId,
            receiverRole: 'USER',
            title: 'Congratulations! You are Hired',
            message: `You have been hired for ${app.job.title}!`,
            relatedJobId: app.jobId,
            relatedApplicationId: app.id,
            status: 'HIRED'
        });

        res.status(200).json(updated);
    } catch (err: any) {
        logger.error(err);
        res.status(500).json({ error: "Database error" });
    }
};

// STEP 7: Institute Rejects Job Seeker
export const reject = async (req: AuthRequest, res: Response) => {
    const { id } = req.params as any;
    const authId = req.user?.id;
    const role = req.user?.role;

    if (!InstituteRoles.includes(role || '')) return res.status(403).json({ error: "Forbidden" });

    try {
        const app = await prisma.application.findUnique({
            where: { id },
            include: { job: true }
        });
        if (!app) return res.status(404).json({ error: "Application not found" });
        if (app.job.instituteId !== authId) return res.status(403).json({ error: "Forbidden" });

        const updated = await prisma.application.update({
            where: { id },
            data: { status: 'REJECTED' }
        });

        await sendNotification({
            receiverId: app.userId,
            receiverRole: 'USER',
            title: 'Application Rejected',
            message: `Your application for ${app.job.title} was rejected.`,
            relatedJobId: app.jobId,
            relatedApplicationId: app.id,
            status: 'REJECTED'
        });

        res.status(200).json(updated);
    } catch (err: any) {
        logger.error(err);
        res.status(500).json({ error: "Database error" });
    }
};

export const getUserApplicationByJobId = async (req: AuthRequest, res: Response) => {
    const authUserId = req.user?.id;
    const { userId, jobId } = req.params as any;

    if (!authUserId) return res.status(401).json({ error: 'Unauthorized' });

    try {
        const application = await prisma.application.findFirst({
            where: { userId, jobId },
            include: { job: true, user: true },
        });

        if (!application) return res.status(404).json({ error: 'Application not found' });
        res.status(200).json(application);
    } catch (err) {
        res.status(500).json({ error: 'Database error' });
    }
};

export const deleteApplication = async (req: AuthRequest, res: Response) => {
    const authUserId = req.user?.id;
    const { id } = req.params as any;

    if (!authUserId) return res.status(401).json({ error: 'Unauthorized' });

    try {
        await prisma.application.delete({ where: { id } });
        res.status(200).json({ success: true });
    } catch (err: any) {
        if (err.code === 'P2025') {
            return res.status(404).json({ error: 'Application not found' });
        }
        res.status(500).json({ error: 'Database error' });
    }
};


export const getUserApplicationStats = async (req: AuthRequest, res: Response) => {
    const authUserId = req.user?.id;

    if (!authUserId) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        // Group by status and count
        const stats = await prisma.application.groupBy({
            by: ['status'],
            where: {
                userId: authUserId
            },
            _count: {
                status: true
            }
        });

        // Initialize default counts
        const response = {
            applied: 0,
            interviewScheduled: 0,
            rejected: 0
        };

        // Map database results to response format
        stats.forEach(group => {
            const count = group._count.status;
            switch (group.status) {
                case 'APPLIED':
                    response.applied = count;
                    break;
                case 'INTERVIEW_SCHEDULED':
                    response.interviewScheduled = count;
                    break;
                case 'REJECTED':
                    response.rejected = count;
                    break;
                // Ignore other statuses as per requirements
            }
        });

        res.status(200).json(response);
    } catch (err) {
        logger.error({ err, userId: authUserId }, 'Error fetching user application stats');
        res.status(500).json({ error: 'Database error' });
    }
};


