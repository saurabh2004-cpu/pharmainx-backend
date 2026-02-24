import { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { getServiceLogger } from '../utils/logger.js';
import { JobCreateUpdateSchema } from '../types/job.js';
import { Prisma } from '../generated/prisma/client.ts';
import { getCloudFrontUrl } from '../services/aws.service.js';

const logger = getServiceLogger("Job");

const mapJobInstituteImage = (job: any) => {
    if (!job?.institute) return job;
    const images = job.institute.instituteImages;
    const img = Array.isArray(images) && images.length > 0 ? images[0] : null;
    job.institute.profile_picture = img?.profileImage ? getCloudFrontUrl(img.profileImage) : null;
    return job;
};


export const InstituteRoles = ["HOSPITAL", "CLINIC", "LAB", "PHARMACY"];

interface AuthRequest extends Request {
    user?: {
        id: number | string;
        role: string;
    };
}

export const createJob = async (req: AuthRequest, res: Response) => {
    const authId = req.user?.id as string;
    const role = req.user?.role;

    logger.info({ authId, role, body: req.body }, 'Create Job Request Received');
    console.log("requsat body of create jobvv", req.body)

    if (!authId || !role || !InstituteRoles.includes(role)) {
        logger.warn({ authId, role }, 'Unauthorized job creation attempt');
        return res.status(403).json({ success: false, message: 'Forbidden: only institutes may create jobs', error: 'Forbidden' });
    }

    // Validation
    logger.debug('Starting Zod validation');
    const parseResult = JobCreateUpdateSchema.safeParse(req.body);

    if (!parseResult.success) {
        const errors = parseResult.error.errors;
        logger.warn({ errors }, 'Validation failed');
        const errorMessage = errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
        return res.status(400).json({
            success: false,
            message: `Validation Error: ${errorMessage}`,
            error: 'Invalid input',
            details: errors
        });
    }

    logger.debug('Validation passed');
    const jobData = parseResult.data;
    console.log("create job data speciality", jobData.speciality);

    if ((jobData.workLocation === 'On-site' || jobData.workLocation === 'Hybrid')) {
        if (!jobData.city) {
            return res.status(400).json({ success: false, message: 'City is required for On-site or Hybrid jobs', error: 'Missing city' });
        }
        if (!jobData.country) {
            return res.status(400).json({ success: false, message: 'Country is required for On-site or Hybrid jobs', error: 'Missing country' });
        }
    }

    // Define credit costs based on job type
    const JOB_TYPE_CREDITS: Record<string, number> = {
        'Doctor': 50,
        'Other': 30,
        'Student': 10
    };

    // Determine credit cost for this job type
    const jobCreditsCost = JOB_TYPE_CREDITS[jobData.role];

    if (jobCreditsCost === undefined) {
        logger.warn({ jobType: jobData.role }, 'Unsupported job role');
        return res.status(400).json({
            success: false,
            message: `Unsupported job role: ${jobData.role}. Supported types are: ${Object.keys(JOB_TYPE_CREDITS).join(', ')}`,
            error: 'Invalid job role'
        });
    }

    try {
        // 1. Fetch Institute with Credits
        const institute = await prisma.institute.findUnique({
            where: { id: authId },
            include: {
                instituteCreditsWallets: true,
            }
        });

        if (!institute) {
            return res.status(404).json({ success: false, message: 'Institute not found', error: 'Not Found' });
        }

        // 2. Fetch Global Credits Config (kept for potential future use)
        const creditsConfig = await prisma.creditsWallet.findFirst();

        if (!creditsConfig) {
            logger.error('Global CreditsWallet config missing');
            return res.status(500).json({ success: false, message: 'No Credits Wallet Found', error: 'Credits config missing' });
        }

        // 3. Get Institute Balance
        // Schema: instituteCreditsWallets InstituteCredits[]
        const instituteCredits = institute.instituteCreditsWallets[0];

        if (!instituteCredits) {
            return res.status(400).json({ success: false, message: 'No credits account found for this institute', error: 'No credits account' });
        }

        logger.info({ currentCredits: instituteCredits.credits, cost: jobCreditsCost, jobType: jobData.jobType }, 'Checking credits');

        // 4. Validate Credits
        if (instituteCredits.credits < jobCreditsCost) {
            return res.status(400).json({
                success: false,
                message: 'Not enough credits to create a job',
                error: 'Insufficient credits',
                details: {
                    required: jobCreditsCost,
                    available: instituteCredits.credits
                }
            });
        }

        // 5. Transaction
        logger.info({ jobType: jobData.jobType, creditsCost: jobCreditsCost }, 'Starting transaction to deduct credits and create job');

        const result = await prisma.$transaction(async (tx) => {
            // Deduct credits
            await tx.instituteCredits.update({
                where: { id: instituteCredits.id },
                data: { credits: { decrement: jobCreditsCost } },
            });

            // Create Job
            const job = await tx.job.create({
                data: {
                    institute: {
                        connect: { id: authId },
                    },
                    title: jobData.title,
                    fullDescription: jobData.fullDescription,
                    jobType: jobData.jobType,
                    role: jobData.role,
                    skills: jobData.skills,
                    workLocation: jobData.workLocation,
                    city: (jobData.workLocation === 'On-site' || jobData.workLocation === 'Hybrid') ? jobData.city : null,
                    country: (jobData.workLocation === 'On-site' || jobData.workLocation === 'Hybrid') ? jobData.country : null,
                    experienceLevel: jobData.experienceLevel,
                    requirements: jobData.requirements,
                    salaryMin: jobData.salaryMin,
                    salaryMax: jobData.salaryMax,
                    shortDescription: jobData.shortDescription,
                    salaryCurrency: jobData.salaryCurrency,
                    applicationDeadline: jobData.applicationDeadline,
                    contactEmail: jobData.contactEmail,
                    contactPhone: jobData.contactPhone,
                    contactPerson: jobData.contactPerson,
                    additionalInfo: jobData.additionalInfo ?? null,
                    speciality: jobData.speciality,
                    subSpeciality: jobData.subSpeciality,
                    status: 'active'
                },
                include: {
                    institute: true, // simplified include
                },
            });

            return job;
        });

        logger.info({ instituteId: authId, jobId: result.id, jobType: jobData.jobType, cost: jobCreditsCost }, 'Job created successfully');
        res.status(201).json(result);
    } catch (err: any) {
        logger.error({ err, message: err.message, code: err.code, meta: err.meta, instituteId: authId }, 'Database error during job creation');
        return res.status(500).json({
            success: false,
            message: 'Internal Server Error',
            error: err.message || 'Database error',
            details: process.env.NODE_ENV === 'development' ? err : undefined
        });
    }
};

export const renewJob = async (req: AuthRequest, res: Response) => {
    const { id: paramId } = req.params as any;
    const jobId = paramId;
    const authId = req.user?.id as string;
    const role = req.user?.role;

    if (!authId || !role || !InstituteRoles.includes(role)) {
        return res.status(403).json({ error: 'Forbidden: only institutes may renew jobs' });
    }

    try {
        // 1. Fetch Job
        const existingJob = await prisma.job.findUnique({ where: { id: jobId } });
        if (!existingJob) {
            return res.status(404).json({ error: 'Job not found' });
        }
        if (existingJob.instituteId !== authId) {
            return res.status(403).json({ error: "Forbidden: cannot renew another institute's job" });
        }
        if (existingJob.status !== 'expired') {
            // Optional: allow renewal if close to expiry, but prompt says "Job status is 'expired'"
            // For strict compliance:
            return res.status(400).json({ error: "Job is not expired" });
        }

        // 2. Fetch Institute with Credits
        const institute = await prisma.institute.findUnique({
            where: { id: authId },
            include: { instituteCreditsWallets: true }
        });

        if (!institute) {
            return res.status(404).json({ error: 'Institute not found' });
        }

        // 3. Fetch Global Credits Config
        const creditsConfig = await prisma.creditsWallet.findFirst({});
        if (!creditsConfig) {
            logger.error('Global CreditsWallet config missing');
            return res.status(500).json({ error: 'System configuration error: Credits config missing' });
        }

        // 4. Get Institute Balance
        const instituteCredits = institute.instituteCreditsWallets[0];
        if (!instituteCredits) {
            return res.status(400).json({ error: 'No credits account found for this institute' });
        }

        // Determine renewal credit cost based on role
        let renewCost = 10; // Default for Doctor and Other
        if (existingJob.role && existingJob.role.toLowerCase().includes('student')) {
            renewCost = 5;
        }

        // 5. Validate Credits
        if (instituteCredits.credits < renewCost) {
            return res.status(400).json({
                error: `Insufficient credits. Required: ${renewCost}, Available: ${instituteCredits.credits}`
            });
        }

        // 6. Transaction
        const result = await prisma.$transaction(async (tx) => {
            // Deduct credits
            await tx.instituteCredits.update({
                where: { id: instituteCredits.id },
                data: { credits: { decrement: renewCost } },
            });

            // Renew Job
            let newDeadline = existingJob.applicationDeadline ? new Date(existingJob.applicationDeadline) : new Date();

            // Add 30 days
            newDeadline.setDate(newDeadline.getDate() + 30);

            // Defensive check: If "Previous + 30" is still in the past (for very old expired jobs), reset to Now + 30
            if (newDeadline < new Date()) {
                newDeadline = new Date();
                newDeadline.setDate(newDeadline.getDate() + 30);
            }

            const updatedJob = await tx.job.update({
                where: { id: jobId },
                data: {
                    status: 'active',
                    applicationDeadline: newDeadline,
                    renewedAt: new Date(),
                },
            });

            return updatedJob;
        });

        logger.info({ instituteId: authId, jobId: result.id, cost: renewCost }, 'Job renewed successfully');
        res.status(200).json(result);

    } catch (err: any) {
        logger.error({ err, instituteId: authId, jobId }, 'Database error during job renewal');
        res.status(500).json({ error: 'Database error', message: err.message });
    }
};

export const updateJob = async (req: AuthRequest, res: Response) => {
    const { id: paramId } = req.params as any;
    const id = paramId; // ID is String (UUID)
    const authId = req.user?.id as string;
    const role = req.user?.role;

    // DEBUG LOG
    console.log('UpdateJob Auth Debug:', { authId, role, user: req.user, instituteRoles: InstituteRoles, isIncluded: role && InstituteRoles.includes(role) });

    if (!authId || !role || !InstituteRoles.includes(role)) {
        logger.warn({ authId, role }, 'Unauthorized job update attempt');
        return res.status(403).json({ error: 'Forbidden: only institutes may update jobs' });
    }

    const parseResult = JobCreateUpdateSchema.safeParse(req.body);
    if (!parseResult.success) {
        const errors = parseResult.error.errors;
        logger.warn({ errors }, 'Update Job Validation failed');
        console.log("Validation Errors:", JSON.stringify(errors, null, 2));
        const errorMessage = errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
        return res.status(400).json({
            success: false,
            message: `Validation Error: ${errorMessage}`,
            error: 'Invalid input',
            details: errors
        });
    }

    const updateData = parseResult.data;

    try {
        const existingJob = await prisma.job.findUnique({ where: { id } });
        if (!existingJob) {
            return res.status(404).json({ error: 'Job not found' });
        }
        if (existingJob.instituteId !== authId) {
            return res.status(403).json({ error: "Forbidden: cannot update another institute's job" });
        }

        console.log("Update Data:", JSON.stringify(updateData, null, 2));
        const job = await prisma.job.update({
            where: { id },
            data: {
                ...updateData,
                fullDescription: updateData.fullDescription,
                city: (updateData.workLocation === 'On-site' || updateData.workLocation === 'Hybrid') ? updateData.city : (updateData.workLocation === 'Remote' ? null : undefined),
                country: (updateData.workLocation === 'On-site' || updateData.workLocation === 'Hybrid') ? updateData.country : (updateData.workLocation === 'Remote' ? null : undefined),
                additionalInfo: updateData.additionalInfo ?? null,
                speciality: updateData.speciality,
                subSpeciality: updateData.subSpeciality,
                // status: 'expired',
            },
            include: {
                institute: true,
            },
        });

        logger.info({ instituteId: authId, jobId: job.id }, 'Job updated successfully');
        res.status(200).json(job);
    } catch (err) {
        logger.error({ err, instituteId: authId, jobId: id }, 'Database error during job update');
        res.status(500).json({ error: 'Database error' });
    }
};

export const deleteJob = async (req: AuthRequest, res: Response) => {
    const { id: paramId } = req.params as any;
    const id = paramId;
    const authId = req.user?.id as string;
    const role = req.user?.role;

    if (!authId || !role || !InstituteRoles.includes(role)) {
        return res.status(403).json({ error: 'Forbidden: only institutes may delete jobs' });
    }

    try {
        const existingJob = await prisma.job.findUnique({ where: { id } });
        if (!existingJob) {
            return res.status(404).json({ error: 'Job not found' });
        }
        if (existingJob.instituteId !== authId) {
            return res.status(403).json({ error: "Forbidden: cannot delete another institute's job" });
        }

        await prisma.job.delete({ where: { id } });
        logger.info({ instituteId: authId, jobId: id }, 'Job deleted successfully');
        res.status(204).send();
    } catch (err) {
        logger.error({ err, instituteId: authId, jobId: id }, 'Database error during job deletion');
        res.status(500).json({ error: 'Database error' });
    }
};

export const getAllJobs = async (req: Request, res: Response) => {
    console.log("All Jobs")
    const authReq = req as AuthRequest;
    const authId = authReq.user?.id;
    const query = req.query as any;
    const page = parseInt((query.page as string) || '1');
    const pageSize = parseInt((query.pageSize as string) || '20');
    const skip = (page - 1) * pageSize;
    const take = pageSize;

    try {
        let jobs: any[] = [];
        let total = 0;

        const where: Prisma.JobWhereInput = {};
        if (query.jobType) where.jobType = query.jobType as string;
        if (query.location) where.workLocation = { equals: query.location as string, mode: 'insensitive' };
        if (query.experienceLevel) where.experienceLevel = query.experienceLevel as string;
        if (query.status) where.status = query.status as string;



        const userRole = authReq.user?.role;
        const isInstitute = userRole && InstituteRoles.includes(userRole);

        console.log("DEBUG All Jobs: Auth Check", {
            authId,
            role: userRole,
            isInstitute
        });

        // Apply ranking if authenticated and NOT an institute
        if (authId && !isInstitute) {
            const user = await prisma.user.findUnique({
                where: { id: String(authId) },
            });

            if (user) {

                const statusFilter = query.status ? Prisma.sql`AND "status" = ${query.status}` : Prisma.sql`AND "status" = 'active'`;
                const jobTypeFilter = query.jobType ? Prisma.sql`AND "jobType" = ${query.jobType}` : Prisma.sql``;
                const locationFilter = query.location ? Prisma.sql`AND "workLocation" ILIKE ${query.location}` : Prisma.sql``;
                const expFilter = query.experienceLevel ? Prisma.sql`AND "experienceLevel" = ${query.experienceLevel}` : Prisma.sql``;

                const userRole = String(user.role || '').trim();
                const userSpec = String(user.speciality || '').trim();
                const userSubSpec = String(user.subSpeciality || '').trim();
                const userExp = user.experience || 0;

                console.log("DEBUG Ranking - User Profile:", {
                    id: user.id,
                    role: userRole,
                    speciality: userSpec,
                    subSpeciality: userSubSpec,
                    experience: userExp
                });

                jobs = await prisma.$queryRaw`
                    SELECT *,
                    (CASE WHEN "role" IS NOT NULL AND ${userRole} <> '' AND TRIM("role") ILIKE ${userRole} THEN 1 ELSE 0 END) as role_match,
                    (CASE WHEN "speciality" IS NOT NULL AND "speciality" <> '' AND ${userSpec} <> '' AND TRIM("speciality") ILIKE ${userSpec} THEN 1 ELSE 0 END) as spec_match,
                    (CASE WHEN "subSpeciality" IS NOT NULL AND "subSpeciality" <> '' AND ${userSubSpec} <> '' AND TRIM("subSpeciality") ILIKE ${userSubSpec} THEN 1 ELSE 0 END) as subspec_match,
                    (CASE 
                        WHEN ("experienceLevel" ILIKE '%fresher%' AND ${userExp} BETWEEN 0 AND 1) THEN 1
                        WHEN ("experienceLevel" ILIKE '%intermediate%' AND ${userExp} BETWEEN 2 AND 4) THEN 1
                        WHEN ("experienceLevel" ILIKE '%experienced%' AND ${userExp} >= 5) THEN 1
                        ELSE 0 
                    END) as exp_match
                    FROM "Job"
                    WHERE 1=1
                    ${statusFilter}
                    ${jobTypeFilter}
                    ${locationFilter}
                    ${expFilter}
                    ORDER BY role_match DESC, spec_match DESC, subspec_match DESC, exp_match DESC, "created_at" DESC
                    LIMIT ${take} OFFSET ${skip}
                 `;

                const jobIds = jobs.map((j: any) => j.id);
                const jobsWithRelations = await prisma.job.findMany({
                    where: { id: { in: jobIds } },
                    include: {
                        institute: { include: { instituteImages: true } },
                    }
                });


                const jobMap = new Map(jobsWithRelations.map(j => [j.id, j]));
                jobs = jobIds.map((id: string) => jobMap.get(id)).filter(Boolean).map(mapJobInstituteImage); // Restore order

                // Get total for pagination
                total = await prisma.job.count({ where });

            } else {
                // User not found fallback
                const [stdJobs, stdTotal] = await Promise.all([
                    prisma.job.findMany({
                        where,
                        skip,
                        take,
                        orderBy: { created_at: 'desc' },
                        include: { institute: { include: { instituteImages: true } } },
                    }),
                    prisma.job.count({ where }),
                ]);
                jobs = stdJobs.map(mapJobInstituteImage);
                total = stdTotal;
            }
        } else {
            // Unauthenticated or not a Job Seeker
            const [stdJobs, stdTotal] = await Promise.all([
                prisma.job.findMany({
                    where,
                    skip,
                    take,
                    orderBy: { created_at: 'desc' },
                    include: {
                        institute: { include: { instituteImages: true } }
                    },
                }),
                prisma.job.count({ where }),
            ]);
            jobs = stdJobs.map(mapJobInstituteImage);
            total = stdTotal;
        }

        logger.info({ page, pageSize, total }, 'Fetched jobs list');
        res.status(200).json({ jobs, page, pageSize, total });
    } catch (err) {
        logger.error({ err, query }, 'Database error during getAllJobs');
        res.status(500).json({ error: 'Database error' });
    }
};

// Helper for Enum string conversion if needed, generic placement
function updatedUserRoleString(role: string) {
    return role;
}

// Helper to calculate experience match
// Helper to calculate experience match logic strictly 
const calculateExperienceScore = (userExp: number | null, jobExpLevel: string): number => {
    if (userExp === null || userExp === undefined) return 0;
    if (!jobExpLevel) return 0;

    const jExp = jobExpLevel.toLowerCase().trim();

    if (jExp.includes('fresher') && userExp >= 0 && userExp <= 1) return 25;
    if (jExp.includes('intermediate') && userExp >= 2 && userExp <= 4) return 25;
    if (jExp.includes('experienced') && userExp >= 5) return 25;

    return 0;
};

export const getJobById = async (req: Request, res: Response) => {
    const { id: paramId } = req.params as any;
    const id = paramId;
    const authReq = req as AuthRequest;
    const authId = authReq.user?.id;

    try {
        const job = await prisma.job.findUnique({
            where: { id },
            include: {
                institute: { include: { instituteImages: true } },
            },
        });

        if (!job) {
            return res.status(404).json({ error: 'Job not found' });
        }

        let matchingScore: number | null = null;

        // Calculate matching score if user is explicitly authenticated
        if (authId) {
            const user = await prisma.user.findUnique({
                where: { id: String(authId) },
            });
            console.log("found user", user)

            if (user) {
                // If user exists, start score calculation
                matchingScore = 0;

                // 1. Role Match (+20%)
                const userRole = user.role ? user.role.toString() : '';
                const jobRole = job.role || '';
                if (userRole && jobRole && userRole.toLowerCase() === jobRole.toLowerCase()) {
                    matchingScore += 20;
                }

                // 2. Speciality Match (+30%)
                const userSpec = user.speciality || '';
                const jobSpec = job.speciality || '';
                if (userSpec && jobSpec && userSpec === jobSpec) {
                    matchingScore += 30;
                }

                // 3. Sub-Speciality Match (+25%)
                const userSubSpec = user.subSpeciality || '';
                const jobSubSpec = job.subSpeciality || '';
                if (userSubSpec && jobSubSpec && userSubSpec === jobSubSpec) {
                    matchingScore += 25;
                }

                // 4. Experience Match (+25%)
                matchingScore += calculateExperienceScore(user.experience, job.experienceLevel);
            }
        }

        logger.info({ id, matchingScore }, 'Fetched job by ID with matching score');

        // Map institute profile_picture
        const mappedJob = mapJobInstituteImage({ ...job });

        // Return strictly formatted response: { job: { ... }, matchingScore }
        res.status(200).json({
            job: mappedJob,
            matchingScore
        });

    } catch (err) {
        logger.error({ err, id }, 'Database error during getJobById');
        res.status(500).json({ error: 'Database error' });
    }
};

export const getJobByIdInstitute = async (req: Request, res: Response) => {
    const { jobId } = req.params;
    console.log("jobid in get by institute", jobId, typeof jobId)
    try {
        const job = await prisma.job.findUnique({
            where: { id: jobId.toString() },
        });

        if (!job) {
            return res.status(404).json({ error: 'Job not found' });
        }
        logger.info({ jobId }, 'Fetched job by ID');
        res.status(200).json(job);
    } catch (err) {
        logger.error({ err, jobId }, 'Database error during getJobById');
        res.status(500).json({ error: 'Database error' });
    }
}

export const getJobsByInstitution = async (req: Request, res: Response) => {
    const { instituteId: instId } = req.params as any;
    const instituteId = instId;
    const query = req.query as any;
    const page = parseInt((query.page as string) || '1');
    const pageSize = parseInt((query.pageSize as string) || '20');
    const status = query.status as string | undefined;
    const skip = (page - 1) * pageSize;
    const take = pageSize;

    const where: any = { instituteId };
    if (status && status !== 'undefined' && status !== 'null') {
        where.status = status;
    }

    try {
        const [jobs, total] = await Promise.all([
            prisma.job.findMany({
                where,
                skip,
                take,
                orderBy: { created_at: 'desc' },
                include: {
                    institute: true,
                },
            }),
            prisma.job.count({ where: { instituteId } }),
        ]);

        const jobsWithApplicationsCount = await Promise.all(jobs.map(async (job) => {
            const applicationsCount = await prisma.application.count({ where: { jobId: job.id } });
            return { ...job, applicationsCount };
        }));

        logger.info({ instituteId, page, pageSize, total }, 'Fetched jobs by institution');
        res.status(200).json({ jobs: jobsWithApplicationsCount, page, pageSize, total });
    } catch (err) {
        logger.error({ err, instituteId }, 'Database error during getJobsByInstitution');
        res.status(500).json({ error: 'Database error' });
    }
};

export const searchJobs = async (req: Request, res: Response) => {
    const query = req.query as any;
    const { q, location, jobType, experienceLevel, specialtyId } = query;
    const page = parseInt((query.page as string) || '1');
    const pageSize = parseInt((query.pageSize as string) || '20');
    const skip = (page - 1) * pageSize;
    const take = pageSize;

    const where: Prisma.JobWhereInput = {};

    if (q) {
        where.OR = [
            { title: { contains: q as string, mode: 'insensitive' } },
            { fullDescription: { contains: q as string, mode: 'insensitive' } },
            { requirements: { contains: q as string, mode: 'insensitive' } },
            { role: { contains: q as string, mode: 'insensitive' } },
        ];
    }

    if (location) where.workLocation = { equals: location as string, mode: 'insensitive' };
    if (jobType) where.jobType = jobType as string;
    if (experienceLevel) where.experienceLevel = experienceLevel as string;
    if (specialtyId) {
        // Specialty relation removed, ignoring filter or need to map to specialization string?
        // where.specialization = specialtyId; // Assuming passed as string? But variable name is ID.
        // Skipping for now to fix build.
    }

    try {
        const [jobs, total] = await Promise.all([
            prisma.job.findMany({
                where,
                skip,
                take,
                orderBy: { created_at: 'desc' },
                include: {
                    institute: { include: { instituteImages: true } },
                },
            }),
            prisma.job.count({ where }),
        ]);

        const mappedJobs = jobs.map(mapJobInstituteImage);
        logger.info({ query, page, pageSize, total }, 'Fetched job search results');
        res.status(200).json({ jobs: mappedJobs, page, pageSize, total });
    } catch (err) {
        logger.error({ err, query }, 'Database error during searchJobs');
        res.status(500).json({ error: 'Database error' });
    }
};

export const toggleJobStatus = async (req: AuthRequest, res: Response) => {
    const { id } = req.params as any;
    const authId = req.user?.id;
    const authRole = req.user?.role;

    try {
        const job = await prisma.job.findUnique({ where: { id } });
        if (!job) {
            return res.status(404).json({ error: 'Job not found' });
        }
        if (job.instituteId !== authId) {
            return res.status(403).json({ error: "Forbidden: cannot toggle another institute's job" });
        }
        const updatedJob = await prisma.job.update({
            where: { id },
            data: { status: job.status === 'active' ? 'inactive' : 'active' },
        });
        logger.info({ instituteId: authId, jobId: id, status: job.status }, 'Job status toggled successfully');
        res.status(200).json(updatedJob);
    } catch (err) {
        logger.error({ err, instituteId: authId, jobId: id }, 'Database error during job status toggle');
        res.status(500).json({ error: 'Database error' });
    }
};

export const getRecommendedJobs = async (req: Request, res: Response) => {
    const authReq = req as AuthRequest;
    const authId = authReq.user?.id;
    const userRole = authReq.user?.role;
    const query = req.query as any;
    const page = parseInt((query.page as string) || '1');
    const pageSize = parseInt((query.pageSize as string) || '20');
    const skip = (page - 1) * pageSize;
    const take = pageSize;

    // 1. Auth Check: Must be authenticated and NOT an Institute
    const isInstitute = userRole && InstituteRoles.includes(userRole);
    if (!authId || isInstitute) {
        return res.status(403).json({
            success: false,
            message: 'Forbidden: Only authenticated job seekers can view recommended jobs',
            error: 'Forbidden'
        });
    }

    try {
        // 2. Fetch User Profile
        const user = await prisma.user.findUnique({
            where: { id: String(authId) },
        });

        if (!user) {
            return res.status(404).json({ success: false, message: 'User profile not found', error: 'Not Found' });
        }

        const uRole = String(user.role || '').trim();
        const uSpec = String(user.speciality || '').trim();
        const uSubSpec = String(user.subSpeciality || '').trim();
        const uExp = user.experience || 0;

        console.log("DEBUG Recommended Jobs - User Profile:", {
            id: user.id,
            role: uRole,
            speciality: uSpec,
            subSpeciality: uSubSpec,
            experience: uExp
        });

        // 3. Execute Raw SQL for Match Scoring
        // Match Score = Sum(Role Match + Speciality Match + SubSpeciality Match + Experience Match)
        // Range: 0 to 4

        // Note: We select * from Job and calculate match_score
        const recommendedJobsRaw = await prisma.$queryRaw`
            SELECT *,
            (
                (CASE WHEN "role" IS NOT NULL AND ${uRole} <> '' AND TRIM("role") ILIKE ${uRole} THEN 1 ELSE 0 END) +
                (CASE WHEN "speciality" IS NOT NULL AND "speciality" <> '' AND ${uSpec} <> '' AND TRIM("speciality") ILIKE ${uSpec} THEN 1 ELSE 0 END) +
                (CASE WHEN "subSpeciality" IS NOT NULL AND "subSpeciality" <> '' AND ${uSubSpec} <> '' AND TRIM("subSpeciality") ILIKE ${uSubSpec} THEN 1 ELSE 0 END) +
                (CASE 
                    WHEN ("experienceLevel" ILIKE '%fresher%' AND ${uExp} BETWEEN 0 AND 1) THEN 1
                    WHEN ("experienceLevel" ILIKE '%intermediate%' AND ${uExp} BETWEEN 2 AND 4) THEN 1
                    WHEN ("experienceLevel" ILIKE '%experienced%' AND ${uExp} >= 5) THEN 1
                    ELSE 0 
                END)
            ) as match_score
            FROM "Job"
            WHERE "status" = 'active'
            ORDER BY match_score DESC, "created_at" DESC
            LIMIT ${take} OFFSET ${skip}
        `;

        const jobsList = recommendedJobsRaw as any[];
        const jobIds = jobsList.map((j) => j.id);

        // 4. Fetch Relations (Institute) and Re-map
        // Prisma raw query doesn't include relations, so we fetch them separately
        const jobsWithRelations = await prisma.job.findMany({
            where: { id: { in: jobIds } },
            include: {
                institute: true,
            }
        });

        const jobMap = new Map(jobsWithRelations.map(j => [j.id, j]));

        // Merge match_score and relational data, preserving order from raw query
        const finalJobs = jobsList.map((rawJob) => {
            const relationalData = jobMap.get(rawJob.id);
            if (!relationalData) return null;
            return {
                ...relationalData,
                match_score: Number(rawJob.match_score) // Ensure number type
            };
        }).filter(Boolean);

        // 5. Get Total Count for Pagination
        // We need the total count of active jobs to support pagination correctly in this context
        // OR should we filter out 0 match scores? The requirement implies strict ranking, 
        // effectively all active jobs are candidates, just ordered by relevance.
        // "Jobs matching... match 0 matches (if needed)" -> So allow all.
        const total = await prisma.job.count({
            where: { status: 'active' }
        });

        logger.info({ userId: authId, count: finalJobs.length }, 'Fetched recommended jobs');

        res.status(200).json({
            jobs: finalJobs,
            page,
            pageSize,
            total
        });

    } catch (err: any) {
        logger.error({ err, userId: authId }, 'Database error during getRecommendedJobs');
        res.status(500).json({
            success: false,
            message: 'Internal Server Error',
            error: err.message || 'Database error'
        });
    }
};
