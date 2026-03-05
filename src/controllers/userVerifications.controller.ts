import { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { getServiceLogger } from '../utils/logger.js';
import { VerificationStatus, UserRoles, Prisma } from '../generated/prisma/client.ts';
import path from 'path';
import crypto from 'crypto';
import fs from 'fs/promises';

import { uploadToS3, getCloudFrontUrl, deleteFromS3 } from '../services/aws.service.js';
import { logActivity } from '../utils/activityLogger.js';
import { ActivityLogsModule, ActivityActionType } from '../generated/prisma/client.ts';

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

        // Helper to handle S3 file uploads
        const handleFileUpload = async (fieldname: string, subFolder: string) => {
            if (files && files[fieldname] && files[fieldname][0]) {
                const file = files[fieldname][0];
                const fileExt = path.extname(file.originalname);
                const uniqueName = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.round(Math.random() * 1E9)}`;

                const s3Key = `verification-documents/${userId}/${subFolder}/${uniqueName}${fileExt}`;

                // Upload to S3
                await uploadToS3(file.buffer, s3Key, file.mimetype);

                // Return S3 Key
                return s3Key;
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

        if (verification.governMentId) verification.governMentId = getCloudFrontUrl(verification.governMentId);
        if (verification.degreeCertificate) verification.degreeCertificate = getCloudFrontUrl(verification.degreeCertificate);
        if (verification.postGraduateDegreeCertificate) verification.postGraduateDegreeCertificate = getCloudFrontUrl(verification.postGraduateDegreeCertificate);

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
    where.status = VerificationStatus.PENDING;
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

        const formattedVerifications = verifications.map(v => ({
            ...v,
            governMentId: v.governMentId ? getCloudFrontUrl(v.governMentId) : v.governMentId,
            degreeCertificate: v.degreeCertificate ? getCloudFrontUrl(v.degreeCertificate) : v.degreeCertificate,
            postGraduateDegreeCertificate: v.postGraduateDegreeCertificate ? getCloudFrontUrl(v.postGraduateDegreeCertificate) : v.postGraduateDegreeCertificate
        }));

        res.status(200).json({ verifications: formattedVerifications, total, page: parseInt(page), pageSize: take });
    } catch (err: any) {
        logger.error({ err }, 'Error fetching all verifications');
        res.status(500).json({ error: 'Database error', message: err.message });
    }
};

// 4. Delete Verification By Id
export const deleteVerificationById = async (req: Request, res: Response) => {
    const { id } = req.params;
    try {
        const verification = await prisma.userVerifications.findUnique({ where: { id: id as string } });
        if (verification) {
            if (verification.governMentId) await deleteFromS3(verification.governMentId).catch(e => console.error("S3 delete err", e));
            if (verification.degreeCertificate) await deleteFromS3(verification.degreeCertificate).catch(e => console.error("S3 delete err", e));
            if (verification.postGraduateDegreeCertificate) await deleteFromS3(verification.postGraduateDegreeCertificate).catch(e => console.error("S3 delete err", e));
        }

        await prisma.userVerifications.delete({ where: { id: id as string } });
        logger.info({ id }, 'Verification deleted successfully');

        await logActivity({
            module: ActivityLogsModule.USER_VERIFICATIONS,
            action: ActivityActionType.DELETE,
            oldData: verification,
            description: 'User verification deleted'
        });

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

        await logActivity({
            module: ActivityLogsModule.USER_VERIFICATIONS,
            action: ActivityActionType.UPDATE,
            newData: verification,
            description: 'User verification approved'
        });

        res.status(200).json(verification);
    } catch (err: any) {
        logger.error({ err, id }, 'Error approving verification');
        res.status(500).json({ error: 'Database error', message: err.message });
    }
};

// 7. Reject Verification
export const rejectVerification = async (req: Request, res: Response) => {
    const { id } = req.params;
    const { documentField, customNote } = req.body;

    // Validate request payload
    if (!documentField || !customNote) {
        return res.status(400).json({ error: 'documentField and customNote are required for rejection' });
    }

    try {
        const result = await prisma.$transaction(async (tx) => {
            // First get the verification to ensure it exists and get userId
            const verification = await tx.userVerifications.findUnique({
                where: { id: String(id) }
            });

            if (!verification) {
                throw new Error("Verification not found");
            }

            // 1. Update verification status
            const updatedVerification = await tx.userVerifications.update({
                where: { id: String(id) },
                data: { status: VerificationStatus.REJECTED }
            });

            // 2. Set user as unverified
            await tx.user.update({
                where: { id: String(verification.userId) },
                data: { verified: false }
            });

            // 3. Create the granular Rejection record
            await tx.userVerificationRejection.create({
                data: {
                    documentField,
                    customNote: customNote || null,
                    verificationId: verification.id,
                    userId: verification.userId
                }
            });

            return updatedVerification;
        }, {
            maxWait: 5000, // default is 2000
            timeout: 10000 // default is 5000
        });

        // 4. Activity Log (Moved outside transaction to avoid P2028 error)
        await logActivity({
            module: ActivityLogsModule.USER_VERIFICATIONS,
            action: ActivityActionType.UPDATE,
            newData: result,
            description: `User verification rejected for ${documentField}`
        });

        res.status(200).json(result);
    } catch (err: any) {
        logger.error({ err, id }, 'Error rejecting verification');
        if (err.message === "Verification not found") {
            return res.status(404).json({ error: err.message });
        }
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

        if (verification.status === VerificationStatus.REJECTED) {
            const rejection = await prisma.userVerificationRejection.findFirst({
                where: { verificationId: verification.id }
            });
            return res.status(200).json({ status: verification.status, rejection });
        }

        res.status(200).json(verification.status);
    } catch (err: any) {
        logger.error({ err, userId }, 'Error fetching verification by user id');
        res.status(500).json({ error: 'Database error', message: err.message });
    }
}