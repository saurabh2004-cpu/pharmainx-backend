import { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { getServiceLogger } from '../utils/logger.js';
import { VerificationStatus, UserRoles, Prisma } from '../generated/prisma/client.ts';
import path from 'path';
import crypto from 'crypto';
import fs from 'fs/promises';

const logger = getServiceLogger("UserVerifications");

interface AuthRequest extends Request {
    user?: {
        id: string | number;
        role: string;
    };
}

// 1. Create Verification
export const createVerification = async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id?.toString();
    const userRole = req.user?.role;

    try {
        const {
            firstName,
            lastName,
            dob,
            governMentId,
            authorizeToVerify,
            email,
            phone,
            country,
            city,
            professionalTitle,
            primarySpecialty,
            licenseNumber,
            licenseExpiryDate,
            degree,
            university,
            yearOfGraduation,
            degreeCertificate,
            postGraduateDegree,
            postGraduateUniversity,
            postGraduateDegreeCertificate,
            currentEmployer,
            currentRole,
            practiceCountry,
            practiceCity,
            isLicenceSuspended,
            licenceSuspensionReason
        } = req.body;

        // Basic validation
        if (!userId) return res.status(400).json({ error: 'User ID is required' });
        if (!userRole) return res.status(400).json({ error: 'User Role is required' });

        // Check if user exists
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Validate dates
        const parsedDob = new Date(dob);
        const parsedLicenseExpiryDate = new Date(licenseExpiryDate);
        const parsedYearOfGraduation = new Date(yearOfGraduation);

        if (isNaN(parsedDob.getTime())) return res.status(400).json({ error: 'Invalid Date of Birth' });
        if (isNaN(parsedLicenseExpiryDate.getTime())) return res.status(400).json({ error: 'Invalid License Expiry Date' });
        if (isNaN(parsedYearOfGraduation.getTime())) return res.status(400).json({ error: 'Invalid Year of Graduation' });

        const files = req.files as { [fieldname: string]: Express.Multer.File[] };

        // Helper to handle local file uploads
        const handleFileUpload = async (fieldname: string, subFolder: string) => {
            if (files && files[fieldname] && files[fieldname][0]) {
                const file = files[fieldname][0];
                const fileExt = path.extname(file.originalname);
                const uniqueName = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.round(Math.random() * 1E9)}`;

                const relativePath = path.join('uploads', 'user-verifications', userId!, subFolder, `${uniqueName}${fileExt}`);
                const fullPath = path.resolve(process.cwd(), relativePath);

                // Ensure directory exists
                await fs.mkdir(path.dirname(fullPath), { recursive: true });

                // Write file to local storage
                await fs.writeFile(fullPath, file.buffer);

                return relativePath.replace(/\\/g, '/'); // Return posix-style path for DB
            }
            return null;
        };

        const governMentIdKey = await handleFileUpload('governMentId', 'govId');
        const degreeCertificateKey = await handleFileUpload('degreeCertificate', 'degree');
        const postGraduateCertificateKey = await handleFileUpload('postGraduateDegreeCertificate', 'postgraduate');

        if (!degreeCertificateKey && !degreeCertificate) {
            return res.status(400).json({ error: 'Degree certificate is required' });
        }

        if (!governMentIdKey && !governMentId) {
            return res.status(400).json({ error: 'Government ID is required' });
        }

        const verification = await prisma.userVerifications.create({
            data: {
                userId: userId as string,
                userRole: userRole.toUpperCase() as UserRoles, // Ensure uppercase for enum
                firstName,
                lastName,
                dob: parsedDob,
                governMentId: (governMentIdKey || governMentId) as string,
                authorizeToVerify: Boolean(authorizeToVerify),
                email,
                phone,
                country,
                city,
                professionalTitle,
                primarySpecialty,
                licenseNumber,
                licenseExpiryDate: parsedLicenseExpiryDate,
                degree,
                university,
                yearOfGraduation: parsedYearOfGraduation,
                degreeCertificate: (degreeCertificateKey || degreeCertificate) as string,
                postGraduateDegree,
                postGraduateUniversity,
                postGraduateDegreeCertificate: postGraduateCertificateKey || postGraduateDegreeCertificate,
                currentEmployer,
                currentRole,
                practiceCountry,
                practiceCity,
                isLicenceSuspended: Boolean(isLicenceSuspended),
                licenceSuspensionReason,
                status: VerificationStatus.PENDING
            }
        });

        logger.info({ verificationId: verification.id, userId }, 'User verification created successfully');
        res.status(201).json(verification);
    } catch (err: any) {
        logger.error({
            message: err.message,
            stack: err.stack,
            prismaCode: err.code,
            meta: err.meta
        }, 'Error creating user verification');

        // Handle Prisma specific errors
        if (err.code === 'P2002') {
            return res.status(400).json({ error: 'A verification record already exists for this unique field.' });
        }
        if (err.code === 'P2003') {
            return res.status(400).json({ error: 'Foreign key constraint failed. Check if userId is correct.' });
        }

        res.status(500).json({ error: 'Database error', message: err.message });
    }
};

// 2. Get Verification By Id
export const getVerificationById = async (req: Request, res: Response) => {
    console.log("get verification by user id ")

    const { id } = req.params;
    try {
        const verification = await prisma.userVerifications.findUnique({
            where: { id: id as string },
            include: { user: true }
        });

        if (!verification) {
            return res.status(404).json({ error: 'Verification not found' });
        }

        // const updated = await prisma.userVerifications.update({
        //     where: { id: id as string },
        //     data: { status: VerificationStatus.APPROVED }
        // });

        // console.log("updated verification ", updated);

        res.status(200).json(verification);
    } catch (err: any) {
        logger.error({ err, id }, 'Error fetching verification by id');
        res.status(500).json({ error: 'Database error', message: err.message });
    }
};

// 3. Get All User Verifications
export const getAllUserVerifications = async (req: Request, res: Response) => {
    const { page = '1', pageSize = '20', status, userId } = req.query as any;
    const skip = (parseInt(page) - 1) * parseInt(pageSize);
    const take = parseInt(pageSize);

    const where: Prisma.UserVerificationsWhereInput = {};
    if (status) {
        where.status = status as VerificationStatus;
    }
    if (userId) {
        where.userId = userId as string;
    }

    try {
        const [verifications, total] = await Promise.all([
            prisma.userVerifications.findMany({
                where,
                skip,
                take,
                orderBy: { created_at: 'desc' },
                include: { user: true }
            }),
            prisma.userVerifications.count({ where })
        ]);

        res.status(200).json({ verifications, total, page: parseInt(page), pageSize: take });
    } catch (err: any) {
        logger.error({ err }, 'Error fetching all verifications');
        res.status(500).json({ error: 'Database error', message: err.message });
    }
};

// 4. Delete Verification By Id
export const deleteVerificationById = async (req: Request, res: Response) => {
    const { id } = req.params;
    try {
        await prisma.userVerifications.delete({ where: { id: id as string } });
        logger.info({ id }, 'Verification deleted successfully');
        res.status(204).send();
    } catch (err: any) {
        logger.error({ err, id }, 'Error deleting verification');
        res.status(500).json({ error: 'Database error', message: err.message });
    }
};

// 5. Delete All Verifications
export const deleteAllVerifications = async (req: Request, res: Response) => {
    try {
        const result = await prisma.userVerifications.deleteMany({});
        logger.info({ count: result.count }, 'All verifications deleted');
        res.status(200).json({ message: 'All verifications deleted', count: result.count });
    } catch (err: any) {
        logger.error({ err }, 'Error deleting all verifications');
        res.status(500).json({ error: 'Database error', message: err.message });
    }
};

// 6. Approve Verification
export const approveVerification = async (req: Request, res: Response) => {
    const { id } = req.params;
    try {
        const verification = await prisma.userVerifications.update({
            where: { id: String(id) },
            data: { status: VerificationStatus.APPROVED }
        });

        // Update user's verified status
        await prisma.user.update({
            where: { id: String(verification.userId) },
            data: { verified: true }
        });

        logger.info({ id, userId: verification.userId }, 'Verification approved');
        res.status(200).json(verification);
    } catch (err: any) {
        logger.error({ err, id }, 'Error approving verification');
        res.status(500).json({ error: 'Database error', message: err.message });
    }
};

// 7. Reject Verification
export const rejectVerification = async (req: Request, res: Response) => {
    const { id } = req.params;
    try {
        const verification = await prisma.userVerifications.update({
            where: { id: String(id) },
            data: { status: VerificationStatus.REJECTED }
        });

        // Update user's verified status to false (if it was true before, though unlikely)
        await prisma.user.update({
            where: { id: String(verification.userId) },
            data: { verified: false }
        });

        logger.info({ id, userId: verification.userId }, 'Verification rejected');
        res.status(200).json(verification);
    } catch (err: any) {
        logger.error({ err, id }, 'Error rejecting verification');
        res.status(500).json({ error: 'Database error', message: err.message });
    }
};


export const getVerificationByUserId = async (req: Request, res: Response) => {
    const { userId } = req.params;
    try {
        const verification = await prisma.userVerifications.findFirst({
            where: { userId: userId.toString() },
            orderBy: { created_at: 'desc' } // Get the most recent one if multiple exist
        });
        if (!verification) {
            return res.status(404).json({ error: 'Verification not found' });
        }

        // await prisma.userVerifications.update({
        //     where: { id: verification.id },
        //     data: { status: VerificationStatus.APPROVED }
        // });
        res.status(200).json(verification.status);
    } catch (err: any) {
        logger.error({ err, userId }, 'Error fetching verification by user id');
        res.status(500).json({ error: 'Database error', message: err.message });
    }
}