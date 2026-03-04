import { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js'; // Ensure .js extension for runtime compatibility if not using ts-node/tsx handling
import { getServiceLogger } from '../utils/logger.js';
import { InstituteRoles, AuthRoles, Prisma, ApplicationStatus, VerificationStatus } from '../generated/prisma/client.ts'; // Import defaults from generated client
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { getCloudFrontUrl } from '../services/aws.service.js';
import { logActivity } from '../utils/activityLogger.js';
import { ActivityLogsModule, ActivityActionType } from '../generated/prisma/client.ts';

const logger = getServiceLogger("Institute");

interface AuthRequest extends Request {
    user?: {
        id: number | string;
        role: string;
    };
}

export const createInstitute = async (req: AuthRequest, res: Response) => {
    const {
        name,
        city,
        country,
        verified,
        contactEmail,
        contactNumber,
        role,
        specialties,
        affiliatedUniversity,
        yearEstablished,
        ownership,
        headline,
        about,
        password,
        bedsCount,
        staffCount,
        type,
        services,
        telephone
    } = req.body;


    console.log("req.body   ", req.body);
    // define required fields explicitly
    const requiredFields = [name, city, country, contactEmail, contactNumber, role, type, services, telephone];

    // Check for missing required fields (ignoring 0 as falsy for numeric checks if any were required, but here these are mostly strings)
    if (requiredFields.some((field) => !field && field !== 0)) {
        return res.status(400).json({ error: 'Required fields are missing' });
    }

    // Explicitly parse numeric fields to allow usage of formData or loosen calls
    const parsedBedsCount = bedsCount !== undefined && bedsCount !== null ? parseInt(bedsCount) : undefined;
    const parsedStaffCount = staffCount !== undefined && staffCount !== null ? parseInt(staffCount) : undefined;
    const parsedYearEstablished = yearEstablished !== undefined && yearEstablished !== null ? parseInt(yearEstablished) : undefined;

    // Validate that if they are provided, they are valid numbers
    if (
        (bedsCount && isNaN(parsedBedsCount!)) ||
        (staffCount && isNaN(parsedStaffCount!)) ||
        (yearEstablished && isNaN(parsedYearEstablished!))
    ) {
        return res.status(400).json({ error: 'Invalid numeric fields provided' });
    }

    try {

        let validInstituteRole: InstituteRoles = InstituteRoles.HOSPITAL;
        if (Object.values(InstituteRoles).includes(role as InstituteRoles)) {
            validInstituteRole = role as InstituteRoles;
        }

        const existingName = await prisma.institute.findUnique({
            where: { contactEmail },
        });

        if (existingName) {
            logger.warn({ name }, 'Attempt to create duplicate institute (name)');
            return res.status(409).json({ error: 'Institute with this name already exists' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const institute = await prisma.institute.create({
            data: {
                name,
                city,
                country,
                verified: verified || false,
                contactEmail,
                password: hashedPassword,
                contactNumber,
                role: validInstituteRole, // Use validated Enum
                affiliatedUniversity,
                yearEstablished: parsedYearEstablished,
                ownership,
                headline,
                about,
                bedsCount: parsedBedsCount !== undefined ? parsedBedsCount : 0, // Default to 0 if not provided but schema requires Int (assuming new schema might default this, strictly schema says Int, usually defaults to 0 or we must provide it. If schema has no default, we must provide it. Based on user prompt "new required... bedsCount", we should provide it. If it was optional in schema, we'd pass undefined. Let's assume strict requirement requires a value, 0 is safe.)
                staffCount: parsedStaffCount !== undefined ? parsedStaffCount : 0,
                type,
                services,
                telephone,
            },
        });

        if (!institute) {
            return res.status(400).json({ error: 'Institute not created' });
        }


        logger.info({ instituteId: institute.id }, 'Institute created successfully');

        await logActivity({
            module: ActivityLogsModule.INSTITUTE,
            action: ActivityActionType.CREATE,
            newData: institute,
            description: 'Institute created'
        });

        res.status(201).json(institute);
    } catch (err: any) {
        logger.error({
            err,
            message: err.message,
            code: err.code,
            meta: err.meta,
            body: req.body
        }, 'Database error during institute creation');

        if (err.code === 'P2002') {
            return res.status(409).json({ error: `Unique constraint failed on the fields: ${err.meta?.target}` });
        }
        res.status(500).json({ error: 'Database error', details: err.message });
    }
};

export const loginInstitute = async (req: AuthRequest, res: Response) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
    }

    try {
        const institute = await prisma.institute.findUnique({
            where: { contactEmail: email },
        });

        if (!institute) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const validPassword = await bcrypt.compare(password, institute.password);

        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }



        const token = jwt.sign({ id: institute.id, role: institute.role }, process.env.JWT_SECRET || 'secret', { expiresIn: '7d' });

        logger.info({ id: institute.id }, 'Institute logged in successfully');

        res
            // .cookie('accessToken', token, {
            //     httpOnly: true,
            //     secure: true,
            //     sameSite: 'strict',
            //     maxAge: 60 * 60 * 1000, // 1 hour
            // })
            .status(200).json({ token, role: institute.role, instituteId: institute.id });
    } catch (err: any) {
        logger.error({ err, email, password }, 'Database error during institute login');
        res.status(500).json({ error: 'Database error' });
    }
};

export const updateInstitute = async (req: AuthRequest, res: Response) => {
    const { id: paramId } = req.params as any;
    const id = paramId as string;
    const authId = req.user?.id;

    if (!authId) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    // Explicitly pick allowed fields
    const {
        name,
        contactNumber,
        bedsCount,
        staffCount,
        telephone,
        services,
        headline,
        about,
        city,
        country,
        verified
    } = req.body;

    const updateData: any = {};

    if (name !== undefined) updateData.name = name;
    if (contactNumber !== undefined) updateData.contactNumber = contactNumber;
    if (telephone !== undefined) updateData.telephone = telephone;
    if (services !== undefined) updateData.services = services;
    if (headline !== undefined) updateData.headline = headline;
    if (about !== undefined) updateData.about = about;
    if (city !== undefined) updateData.city = city;
    if (country !== undefined) updateData.country = country;

    // Update the verified flag on the Institute model directly
    if (verified !== undefined) {
        updateData.verified = (verified === true || verified === 'true');
    }

    // Handle numeric fields conversion and validation
    if (bedsCount !== undefined) {
        const parsedBeds = parseInt(bedsCount, 10);
        if (isNaN(parsedBeds)) {
            return res.status(400).json({ error: 'Invalid bedsCount' });
        }
        updateData.bedsCount = parsedBeds;
    }

    if (staffCount !== undefined) {
        const parsedStaff = parseInt(staffCount, 10);
        if (isNaN(parsedStaff)) {
            return res.status(400).json({ error: 'Invalid staffCount' });
        }
        updateData.staffCount = parsedStaff;
    }

    try {
        const oldData = await prisma.institute.findUnique({ where: { id } });

        if (!oldData) {
            return res.status(404).json({ error: 'Institute not found' });
        }

        const institute = await prisma.institute.update({
            where: { id },
            data: updateData,
            include: { instituteVerifications: true, instituteImages: true },
        });

        // Handle the secondary update for instituteVerifications record IF it exists
        if (verified !== undefined) {
            const verification = await prisma.instituteVerifications.findUnique({
                where: { instituteId: id }
            });

            if (verification) {
                await prisma.instituteVerifications.update({
                    where: { id: verification.id },
                    data: {
                        status: (verified === true || verified === 'true') ? VerificationStatus.APPROVED : VerificationStatus.REJECTED
                    }
                });
            }
        }

        const images = (institute as any).instituteImages && (institute as any).instituteImages.length > 0 ? (institute as any).instituteImages[0] : null;

        const mappedInstitute: any = {
            ...institute,
            verified: institute.verified || institute?.instituteVerifications?.status === VerificationStatus.APPROVED,
        };

        if (images?.profileImage) {
            mappedInstitute.profile_picture = getCloudFrontUrl(images.profileImage);
        }
        if (images?.coverImage) {
            mappedInstitute.banner_picture = getCloudFrontUrl(images.coverImage);
        }

        logger.info({ id, hasProfile: !!mappedInstitute.profile_picture, hasBanner: !!mappedInstitute.banner_picture }, 'Institute updated successfully');

        await logActivity({
            module: ActivityLogsModule.INSTITUTE,
            action: ActivityActionType.UPDATE,
            oldData,
            newData: mappedInstitute,
            description: 'Institute updated profile'
        });

        res.status(200).json(mappedInstitute);
    } catch (err: any) {
        if (err.code === 'P2025') {
            logger.warn({ id }, 'Institute not found during update');
            return res.status(404).json({ error: 'Institute not found' });
        }
        logger.error({ err, id, body: updateData }, 'Database error during institute update');
        res.status(500).json({ error: 'Database error' });
    }
};

export const deleteInstitute = async (req: AuthRequest, res: Response) => {
    const { id: paramId } = req.params as any;
    const id = paramId as string;
    const authId = req.user?.id;

    if (!authId) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        const existingData = await prisma.institute.findUnique({ where: { id } });

        await prisma.institute.delete({ where: { id } });
        logger.info({ id }, 'Institute deleted successfully');

        await logActivity({
            module: ActivityLogsModule.INSTITUTE,
            action: ActivityActionType.DELETE,
            oldData: existingData,
            description: 'Institute deleted'
        });

        res.status(204).send();
    } catch (err: any) {
        if (err.code === 'P2025') {
            logger.warn({ id }, 'Institute not found during deletion');
            return res.status(404).json({ error: 'Institute not found' });
        }
        logger.error({ err, id }, 'Database error during institute deletion');
        res.status(500).json({ error: 'Database error' });
    }
};

export const getMyInstitute = async (req: AuthRequest, res: Response) => {

    console.log("get Institute prodile :");
    const authId = req.user?.id;
    console.log("authId", authId);

    if (!authId) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        const institute = await prisma.institute.findUnique({
            where: { id: authId as string },
            include: { instituteImages: true }
        });

        if (!institute) {
            return res.status(404).json({ error: 'Institute not found' });
        }

        const images = (institute as any).instituteImages && (institute as any).instituteImages.length > 0 ? (institute as any).instituteImages[0] : null;
        const mappedInstitute = {
            ...institute,
            profile_picture: images?.profileImage ? getCloudFrontUrl(images.profileImage) : null,
            banner_picture: images?.coverImage ? getCloudFrontUrl(images.coverImage) : null,
        };

        res.status(200).json(mappedInstitute);
    } catch (err) {
        logger.error({ err, authId }, 'Database error during getMyInstitute');
        res.status(500).json({ error: 'Database error' });
    }
};

export const getInstituteStats = async (req: AuthRequest, res: Response) => {
    const authId = req.user?.id;
    const role = req.user?.role;

    if (!authId || !Object.values(InstituteRoles).includes(role as any)) {
        return res.status(403).json({ error: "Forbidden: only institutes may view stats" });
    }

    try {
        const instituteId = authId;

        // 1️⃣ Total Jobs Posted
        const jobs = await prisma.job.findMany({
            where: { instituteId: instituteId.toString() },
            select: { id: true, created_at: true },
        });

        const jobIds = jobs.map(j => j.id);
        const totalJobs = jobIds.length;

        // Early return if no jobs
        if (jobIds.length === 0) {
            return res.status(200).json({
                totals: {
                    totalJobs: 0,
                    totalInstituteProfileViews: 0,
                    totalApplications: 0,
                    averageResponseRate: 0,
                    averageResponseTimeHours: 0,
                    conversionRate: 0,
                },
            });
        }

        // 2️⃣ Total Institute Profile Views
        const totalInstituteProfileViews = await prisma.instituteView.count({
            where: { instituteId: instituteId.toString() },
        });

        // Job Views (used for rates)
        const totalJobViews = await prisma.jobView.count({
            where: { jobId: { in: jobIds } },
        });

        // 3️⃣ Total Applications on Institute Jobs
        const applications = await prisma.application.findMany({
            where: { jobId: { in: jobIds } },
            select: {
                created_at: true,
                jobId: true,
            },
        });

        const totalApplications = applications.length;

        // 5️⃣ Average Response Time (job.created_at → application.created_at)
        let totalResponseTimeMs = 0;

        if (applications.length > 0) {
            const jobCreatedAtMap = new Map(
                jobs.map(j => [j.id, j.created_at.getTime()])
            );

            for (const app of applications) {
                const jobCreatedAt = jobCreatedAtMap.get(app.jobId);
                if (jobCreatedAt) {
                    totalResponseTimeMs += app.created_at.getTime() - jobCreatedAt;
                }
            }
        }

        const averageResponseTimeHours =
            totalApplications > 0
                ? totalResponseTimeMs / totalApplications / (1000 * 60 * 60)
                : 0;

        // 4️⃣ Average Response Rate (%) → applications ÷ job views
        const averageResponseRate =
            totalJobViews > 0
                ? (totalApplications / totalJobViews) * 100
                : 0;

        // 6️⃣ Conversion Rate (%) → views → applications
        const conversionRate =
            totalJobViews > 0
                ? (totalApplications / totalJobViews) * 100
                : 0;

        res.status(200).json({
            totals: {
                totalJobs,
                totalInstituteProfileViews,
                totalApplications,
                averageResponseRate: Number(averageResponseRate.toFixed(2)),
                averageResponseTimeHours: Number(averageResponseTimeHours.toFixed(2)),
                conversionRate: Number(conversionRate.toFixed(2)),
            },
        });
    } catch (error) {
        console.error("Institute stats error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};


export const searchInstitutes = async (req: Request, res: Response) => {
    const query = req.query as any;
    const { name, specialty, city, country, role, verified, status } = query;
    const page = parseInt((query.page as string) || '1');
    const limitParams = query.limit || query.pageSize;
    const limit = parseInt((limitParams as string) || '10');
    const skip = (page - 1) * limit;
    const take = limit;

    const where: Prisma.InstituteWhereInput = {};

    if (name) where.name = { contains: name as string, mode: 'insensitive' };



    if (city) where.city = { contains: city as string, mode: 'insensitive' };
    if (country) where.country = { contains: country as string, mode: 'insensitive' };
    if (role) where.role = role as any;
    if (verified !== undefined) where.verified = verified;
    if (status) {
        where.instituteVerifications = {
            status: status as any
        };
    }

    try {
        const [institutes, total] = await Promise.all([
            prisma.institute.findMany({
                where,
                skip,
                take,
                orderBy: { created_at: 'desc' },
                include: { instituteImages: true, instituteVerifications: true },
            }),
            prisma.institute.count({ where }),
        ]);

        console.log("institute list", institutes)

        const mappedInstitutes = institutes.map(inst => {
            const images = (inst as any).instituteImages && (inst as any).instituteImages.length > 0 ? (inst as any).instituteImages[0] : null;
            return {
                ...inst,
                verified: inst.verified || inst?.instituteVerifications?.status === VerificationStatus.APPROVED,
                profile_picture: images?.profileImage ? getCloudFrontUrl(images.profileImage) : null,
                banner_picture: images?.coverImage ? getCloudFrontUrl(images.coverImage) : null,
            };
        });

        console.log("mappedInstitutes", mappedInstitutes)

        logger.info({ query, page, limit, total }, 'Fetched institutes search results');
        res.status(200).json({
            institutes: mappedInstitutes,
            data: mappedInstitutes,
            page,
            pageSize: limit,
            limit,
            total,
            totalPages: Math.ceil(total / limit)
        });
    } catch (err) {
        logger.error({ err, query }, 'Database error during searchInstitutes');
        res.status(500).json({ error: 'Database error' });
    }
};

export const getAllInstitutes = async (req: Request, res: Response) => {
    // Reusing search logic
    return searchInstitutes(req, res);
};

export const getInstituteById = async (req: Request, res: Response) => {
    const { id: paramId } = req.params as any;
    const id = paramId as string;

    try {
        const institute = await prisma.institute.findUnique({
            where: { id },
            include: { instituteImages: true, instituteVerifications: true },
        });

        if (!institute) {
            logger.warn({ id }, 'Institute not found');
            return res.status(404).json({ error: 'Institute not found' });
        }

        const images = (institute as any).instituteImages && (institute as any).instituteImages.length > 0 ? (institute as any).instituteImages[0] : null;

        const mappedInstitute: any = {
            ...institute,
            verified: institute.verified || institute?.instituteVerifications?.status === VerificationStatus.APPROVED,
        };

        if (images?.profileImage) {
            mappedInstitute.profile_picture = getCloudFrontUrl(images.profileImage);
        }
        if (images?.coverImage) {
            mappedInstitute.banner_picture = getCloudFrontUrl(images.coverImage);
        }

        // Log the response for debugging
        logger.info({ instituteId: id, hasProfile: !!mappedInstitute.profile_picture, hasBanner: !!mappedInstitute.banner_picture }, 'Institute profile updated successfully');

        res.status(200).json(mappedInstitute);
    } catch (err) {
        logger.error({ err, id }, 'Database error during getInstituteById');
        res.status(500).json({ error: 'Database error' });
    }
};

export const getInstituteJobs = async (req: AuthRequest, res: Response) => {
    const authId = req.user?.id as string;
    const role = req.user?.role;

    if (!authId || !Object.values(InstituteRoles).includes(role as any)) {
        return res.status(403).json({ error: "Forbidden: only institutes may view stats" });
    }

    try {
        const instituteId = authId;

        const jobs = await prisma.job.findMany({
            where: { instituteId },
            select: { id: true },
        });

        const jobIds = jobs.map((j) => j.id);
        const totalJobs = jobIds.length;

        const totalViews = await prisma.jobView.count({
            where: { jobId: { in: jobIds } },
        });

        const applications = await prisma.application.findMany({
            where: { jobId: { in: jobIds } },
            select: { created_at: true, updated_at: true, status: true },
        });

        const totalApplications = applications.length;
        const totalResponses = applications.filter(a => a.status !== ApplicationStatus.APPLIED).length;
        const totalConversions = applications.filter(a => a.status === ApplicationStatus.HIRED).length;

        const avgResponseTime =
            applications.length > 0
                ? applications.reduce(
                    (acc, a) => acc + (a.updated_at.getTime() - a.created_at.getTime()),
                    0
                ) /
                applications.length /
                3600000
                : 0;

        const responseRate = totalViews > 0 ? (totalResponses / totalViews) * 100 : 0;
        const conversionRate = totalResponses > 0 ? (totalConversions / totalResponses) * 100 : 0;

        const stats = {
            totals: {
                totalJobs,
                totalViews,
                totalApplications,
                responseRate,
                averageResponseTime: parseFloat(avgResponseTime.toFixed(2)),
                conversionRate,
            },
            trends: [],
            weeklyComparison: [],
            responseDistribution: {},
        };

        res.status(200).json(stats);
    } catch (err) {
        console.error(err);

        res.status(500).json({ error: 'Database error' });
    }
};

export const getInstituteCredits = async (req: AuthRequest, res: Response) => {
    const authId = req.user?.id;
    const role = req.user?.role;

    if (!authId || !Object.values(InstituteRoles).includes(role as any)) {
        return res.status(403).json({ error: "Forbidden: only institutes may view credits" });
    }

    try {
        const instituteId = authId;

        const credits = await prisma.institute.findUnique({
            where: { id: instituteId.toString() },
            select: { instituteCreditsWallets: true },
        });

        if (!credits) {
            return res.status(404).json({ error: 'Institute not found' });
        }

        res.status(200).json({ credits: credits.instituteCreditsWallets });
    } catch (err) {
        console.error(err);

        res.status(500).json({ error: 'Database error' });
    }
};  