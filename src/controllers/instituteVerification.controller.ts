import { AuthRequest } from "../middlewares/auth.middleware";
import { Response } from "express";
import { prisma } from '../lib/prisma.js';
import { VerificationStatus } from "../generated/prisma/enums";
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { uploadToS3, getCloudFrontUrl, deleteFromS3 } from '../services/aws.service.js';
import { logActivity } from '../utils/activityLogger.js';
import { ActivityLogsModule, ActivityActionType } from '../generated/prisma/client.ts';

const createInstituteVerification = async (req: AuthRequest, res: Response) => {
    const instituteId = req.user?.id?.toString()

    if (!instituteId) {
        return res.status(400).json({ error: "Institute ID is required" });
    }


    const { telephone, email, adminName, adminPhone } = req.body;
    let registrationCertificateKey = "";

    const existingVerification = await prisma.instituteVerifications.findUnique({
        where: {
            instituteId: instituteId.toString(),
        },
    });

    try {
        if (req.file) {
            let fileBuffer: Buffer;
            if (req.file.buffer) {
                fileBuffer = req.file.buffer;
            } else if (req.file.path) {
                fileBuffer = await fs.readFile(req.file.path);
            } else {
                return res.status(400).json({ error: "Failed to read uploaded file" });
            }

            const fileExt = req.file.originalname ? path.extname(req.file.originalname) : '.pdf';
            const uniqueName = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
            registrationCertificateKey = `verification-documents/institute/${instituteId}/registration/${uniqueName}${fileExt}`;

            await uploadToS3(fileBuffer, registrationCertificateKey, req.file.mimetype || 'application/pdf');
        }

        if (existingVerification) {
            const updatedVerification = await prisma.instituteVerifications.update({
                where: {
                    instituteId: instituteId.toString(),
                },
                data: {
                    status: VerificationStatus.PENDING,
                    telephone,
                    email,
                    adminName,
                    adminPhone,
                    registrationCertificate: registrationCertificateKey,
                },
            });

            await logActivity({
                module: ActivityLogsModule.INSTITUTE_VERIFICATIONS,
                action: ActivityActionType.UPDATE,
                newData: updatedVerification,
                description: 'Institute verification updated'
            });

            res.json({ message: "Institute verification updated successfully", instituteVerification: existingVerification });
            return;
        }

        const instituteVerification = await prisma.instituteVerifications.create({
            data: {
                instituteId: instituteId,
                status: VerificationStatus.PENDING,
                telephone,
                email,
                adminName,
                adminPhone,
                registrationCertificate: registrationCertificateKey,
            },
        });

        if (!instituteVerification) {
            return res.status(400).json({ error: "Failed to create institute verification" });
        }

        res.json({ message: "Institute verification created successfully", instituteVerification });
    } catch (error: any) {
        console.error(error);
        res.status(500).json({ error: "Failed to create institute verification", message: error.message });
    }
};

const getInstituteVerification = async (req: AuthRequest, res: Response) => {
    const instituteId = req.params.instituteId

    if (!instituteId) {
        return res.status(400).json({ error: "Institute ID is required" });
    }

    try {
        const instituteVerification = await prisma.instituteVerifications.findUnique({
            where: {
                instituteId: instituteId.toString(),
            },
        });

        if (!instituteVerification) {
            return res.status(404).json({ error: "Institute verification not found" });
        }

        if (instituteVerification.registrationCertificate) {
            instituteVerification.registrationCertificate = getCloudFrontUrl(instituteVerification.registrationCertificate);
        }

        if (instituteVerification.status === VerificationStatus.REJECTED) {
            const rejection = await prisma.instituteVerificationRejection.findFirst({
                where: { verificationId: instituteVerification.id }
            });
            return res.status(200).json({ status: instituteVerification.status, rejection });
        }

        res.json(instituteVerification.status);
    } catch (error: any) {
        console.error(error);
        res.status(500).json({ error: "Failed to get institute verification", message: error.message });
    }
};

const fetVerificationById = async (req: AuthRequest, res: Response) => {
    const id = req.params.id

    if (!id) {
        return res.status(400).json({ error: "Institute ID is required" });
    }

    try {
        const instituteVerification = await prisma.instituteVerifications.findUnique({
            where: {
                id: id.toString(),
            },
            include: {
                institute: {
                    select: {
                        id: true,
                    }
                }
            }
        });

        if (!instituteVerification) {
            return res.status(404).json({ error: "Institute verification not found" });
        }

        if (instituteVerification.registrationCertificate) {
            instituteVerification.registrationCertificate = getCloudFrontUrl(instituteVerification.registrationCertificate);
        }

        res.json(instituteVerification);
    } catch (error: any) {
        console.error(error);
        res.status(500).json({ error: "Failed to get institute verification", message: error.message });
    }
};

const approveInstituteVerification = async (req: AuthRequest, res: Response) => {
    const { instituteId } = req.params;

    if (!instituteId) {
        return res.status(400).json({ error: "Institute ID is required" });
    }

    try {
        const instituteVerification = await prisma.instituteVerifications.update({
            where: {
                instituteId: instituteId.toString(),
            },
            data: {
                status: VerificationStatus.APPROVED,
            },
        });

        if (!instituteVerification) {
            return res.status(400).json({ error: "Failed to verify institute verification" });
        }

        await logActivity({
            module: ActivityLogsModule.INSTITUTE_VERIFICATIONS,
            action: ActivityActionType.UPDATE,
            newData: instituteVerification,
            description: 'Institute verification approved'
        });

        res.json({ message: "Institute verification verified successfully", instituteVerification });
    } catch (error: any) {
        console.error(error);
        res.status(500).json({ error: "Failed to verify institute verification", message: error.message });
    }
};

const rejectInstituteVerification = async (req: AuthRequest, res: Response) => {
    const { instituteId } = req.params;
    const { documentField, customNote } = req.body;

    if (!documentField || !customNote) {
        return res.status(400).json({ error: 'documentField and customNote are required for rejection' });
    }

    if (!instituteId) {
        return res.status(400).json({ error: "Institute ID is required" });
    }

    try {
        const result = await prisma.$transaction(async (tx) => {
            const verification = await tx.instituteVerifications.findUnique({
                where: { instituteId: instituteId.toString() },
            });

            if (!verification) {
                throw new Error("Verification not found");
            }

            const updatedVerification = await tx.instituteVerifications.update({
                where: { instituteId: instituteId.toString() },
                data: {
                    status: VerificationStatus.REJECTED,
                },
            });

            await tx.institute.update({
                where: { id: instituteId.toString() },
                data: { verified: false }
            });

            await tx.instituteVerificationRejection.create({
                data: {
                    documentField,
                    customNote: customNote || null,
                    verificationId: verification.id,
                    instituteId: instituteId.toString()
                }
            });

            return updatedVerification;
        }, {
            maxWait: 5000,
            timeout: 10000
        });

        await logActivity({
            module: ActivityLogsModule.INSTITUTE_VERIFICATIONS,
            action: ActivityActionType.UPDATE,
            newData: result,
            description: `Institute verification rejected for ${documentField}`
        });

        res.json({ message: "Institute verification rejected successfully", instituteVerification: result });
    } catch (error: any) {
        console.error(error);
        if (error.message === "Verification not found") {
            return res.status(404).json({ error: error.message });
        }
        res.status(500).json({ error: "Failed to reject institute verification", message: error.message });
    }
};

const getAllInstituteVerifications = async (req: AuthRequest, res: Response) => {
    const { page, pageSize, status } = req.query;
    try {
        const instituteVerifications = await prisma.instituteVerifications.findMany({
            where: {
                status: status ? (status as string as VerificationStatus) : undefined,
            },
            include: {
                institute: {
                    select: {
                        id: true,
                        name: true,
                    }
                }
            }
        });

        if (!instituteVerifications) {
            return res.status(404).json({ error: "Institute verifications not found" });
        }

        const formattedVerifications = instituteVerifications.map(v => ({
            ...v,
            registrationCertificate: v.registrationCertificate ? getCloudFrontUrl(v.registrationCertificate) : v.registrationCertificate
        }));

        res.json(formattedVerifications);
    } catch (error: any) {
        console.error(error);
        res.status(500).json({ error: "Failed to get institute verifications", message: error.message });
    }
};

const checkInstituteVerificationStatus = async (req: AuthRequest, res: Response) => {
    const instituteId = req.user?.id?.toString();

    if (!instituteId) {
        return res.status(401).json({ error: "Unauthorized" });
    }

    try {
        const verification = await prisma.instituteVerifications.findUnique({
            where: { instituteId: instituteId },
        });

        if (!verification) {
            return res.status(200).json({
                success: true,
                verified: false,
                status: "NOT_FOUND"
            });
        }

        // await prisma.instituteVerifications.update({
        //     where: { instituteId: instituteId },
        //     data: { status: VerificationStatus.APPROVED }
        // });

        return res.status(200).json({
            success: true,
            verified: verification.status === VerificationStatus.APPROVED,
            status: verification.status
        });
    } catch (error: any) {
        console.error(error);
        res.status(500).json({ error: "Database error", message: error.message });
    }
};

const deleteInstituteVerificationById = async (req: AuthRequest, res: Response) => {
    const { id } = req.params;

    if (!id) {
        return res.status(400).json({ error: "Verification ID is required" });
    }

    try {
        const verification = await prisma.instituteVerifications.findUnique({
            where: { id: id.toString() }
        });

        if (!verification) {
            return res.status(404).json({ error: "Institute verification not found" });
        }

        if (verification.registrationCertificate) {
            try {
                await deleteFromS3(verification.registrationCertificate);
            } catch (s3Error: any) {
                console.error("Failed to delete from S3, proceeding with DB deletion:", s3Error);
            }
        }

        await prisma.instituteVerifications.delete({
            where: { id: id.toString() }
        });

        await logActivity({
            module: ActivityLogsModule.INSTITUTE_VERIFICATIONS,
            action: ActivityActionType.DELETE,
            oldData: verification,
            description: 'Institute verification deleted'
        });

        res.json({ message: "Institute verification deleted successfully" });
    } catch (error: any) {
        console.error(error);
        res.status(500).json({ error: "Failed to delete institute verification", message: error.message });
    }
};

export const getRecentOneInstituteVerification = async (req: AuthRequest, res: Response) => {
    const instituteId = req.params.instituteId;
    try {
        const verification = await prisma.instituteVerifications.findFirst({
            where: { instituteId: instituteId.toString() },
            include: {
                institute: {
                    select: {
                        id: true,
                        name: true,
                    }
                }
            }
        });

        if (!verification) {
            return res.status(404).json({ error: "Institute verification not found" });
        }

        if (verification.registrationCertificate) {
            verification.registrationCertificate = getCloudFrontUrl(verification.registrationCertificate);
        }

        res.json(verification);
    } catch (error: any) {
        console.error(error);
        res.status(500).json({ error: "Failed to get recent one institute verification", message: error.message });
    }
};

export {
    createInstituteVerification,
    getInstituteVerification,
    approveInstituteVerification,
    rejectInstituteVerification,
    getAllInstituteVerifications,
    checkInstituteVerificationStatus,
    deleteInstituteVerificationById,
    fetVerificationById
};
