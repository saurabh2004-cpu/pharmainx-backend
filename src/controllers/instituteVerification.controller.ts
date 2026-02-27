import { AuthRequest } from "../middlewares/auth.middleware";
import { Response } from "express";
import { prisma } from '../lib/prisma.js';
import { VerificationStatus } from "../generated/prisma/enums";


const createInstituteVerification = async (req: AuthRequest, res: Response) => {
    const instituteId = req.user?.id?.toString()

    if (!instituteId) {
        return res.status(400).json({ error: "Institute ID is required" });
    }

    const { telephone, email, adminName, adminPhone } = req.body;
    const registrationCertificate = req.file?.path;

    try {
        const instituteVerification = await prisma.instituteVerifications.create({
            data: {
                instituteId: instituteId,
                status: VerificationStatus.PENDING,
                telephone,
                email,
                adminName,
                adminPhone,
                registrationCertificate: registrationCertificate || "",
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

        res.json(instituteVerification.status);
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

        res.json({ message: "Institute verification verified successfully", instituteVerification });
    } catch (error: any) {
        console.error(error);
        res.status(500).json({ error: "Failed to verify institute verification", message: error.message });
    }
};

const rejectInstituteVerification = async (req: AuthRequest, res: Response) => {
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
                status: VerificationStatus.REJECTED,
            },
        });

        if (!instituteVerification) {
            return res.status(400).json({ error: "Failed to reject institute verification" });
        }

        res.json({ message: "Institute verification rejected successfully", instituteVerification });
    } catch (error: any) {
        console.error(error);
        res.status(500).json({ error: "Failed to reject institute verification", message: error.message });
    }
};

const getAllInstituteVerifications = async (req: AuthRequest, res: Response) => {
    try {
        const instituteVerifications = await prisma.instituteVerifications.findMany();

        if (!instituteVerifications) {
            return res.status(404).json({ error: "Institute verifications not found" });
        }


        res.json(instituteVerifications);
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

        await prisma.instituteVerifications.update({
            where: { instituteId: instituteId },
            data: { status: VerificationStatus.APPROVED }
        });

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

export {
    createInstituteVerification,
    getInstituteVerification,
    approveInstituteVerification,
    rejectInstituteVerification,
    getAllInstituteVerifications,
    checkInstituteVerificationStatus
};
