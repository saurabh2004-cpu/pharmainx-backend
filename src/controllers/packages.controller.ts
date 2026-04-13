import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware.js';
import { prisma } from '../lib/prisma.js';
import { getServiceLogger } from '../utils/logger.js';
import { logActivity } from '../utils/activityLogger.js';
import { AdminRoles, ActivityLogsModule, ActivityActionType } from '../generated/prisma/client.ts';

const logger = getServiceLogger("Packages");

export const createPackage = async (req: AuthRequest, res: Response) => {
    try {
        const { name, price, credits } = req.body;

        if (!name || price === undefined || credits === undefined) {
            return res.status(400).json({ message: 'Name, price, and credits are required' });
        }

        const newPackage = await prisma.packages.create({
            data: {
                name,
                price: Number(price),
                credits: Number(credits)
            }
        });

        await logActivity({
            module: ActivityLogsModule.PACKAGES,
            action: ActivityActionType.CREATE,
            adminId: req.user?.id?.toString(),
            newData: newPackage,
            description: `Package created: ${newPackage.name}`
        });

        res.status(201).json({
            message: 'Package created successfully',
            data: newPackage
        });
    } catch (err: any) {
        logger.error({ err }, 'Error creating package');
        res.status(500).json({ error: 'Database error', message: err.message });
    }
};

export const getAllPackages = async (req: AuthRequest, res: Response) => {
    try {
        const packages = await prisma.packages.findMany({
            orderBy: { createdAt: 'desc' }
        });

        res.status(200).json({
            data: packages
        });
    } catch (err: any) {
        logger.error({ err }, 'Error fetching packages');
        res.status(500).json({ error: 'Database error', message: err.message });
    }
};

export const getPackageById = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const pkg = await prisma.packages.findUnique({
            where: { id: String(id) }
        });

        if (!pkg) {
            return res.status(404).json({ message: 'Package not found' });
        }

        res.status(200).json({
            data: pkg
        });
    } catch (err: any) {
        logger.error({ err, id: req.params.id }, 'Error fetching package by id');
        res.status(500).json({ error: 'Database error', message: err.message });
    }
};

export const updatePackage = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const { name, price, credits } = req.body;

        const pkg = await prisma.packages.findUnique({
            where: { id: String(id) }
        });

        if (!pkg) {
            return res.status(404).json({ message: 'Package not found' });
        }

        const updatedPackage = await prisma.packages.update({
            where: { id: String(id) },
            data: {
                name: name !== undefined ? name : pkg.name,
                price: price !== undefined ? Number(price) : pkg.price,
                credits: credits !== undefined ? Number(credits) : pkg.credits
            }
        });

        const isAdminUpdate = req.user?.role === AdminRoles.MASTER_ADMIN || req.user?.role === AdminRoles.ADMIN;
        const actorIdUpdate = req.user?.id?.toString();

        await logActivity({
            module: ActivityLogsModule.PACKAGES,
            action: ActivityActionType.UPDATE,
            adminId: isAdminUpdate ? actorIdUpdate : undefined,
            userId: !isAdminUpdate ? actorIdUpdate : undefined,
            oldData: pkg,
            newData: updatedPackage,
            description: `Package updated: ${updatedPackage.name}`
        });

        res.status(200).json({
            message: 'Package updated successfully',
            data: updatedPackage
        });
    } catch (err: any) {
        logger.error({ err, id: req.params.id }, 'Error updating package');
        res.status(500).json({ error: 'Database error', message: err.message });
    }
};

export const deletePackage = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;

        const pkg = await prisma.packages.findUnique({
            where: { id: String(id) }
        });

        if (!pkg) {
            return res.status(404).json({ message: 'Package not found' });
        }

        await prisma.packages.delete({
            where: { id: String(id) }
        });

        const isAdminDelete = req.user?.role === AdminRoles.MASTER_ADMIN || req.user?.role === AdminRoles.ADMIN;
        const actorIdDelete = req.user?.id?.toString();

        await logActivity({
            module: ActivityLogsModule.PACKAGES,
            action: ActivityActionType.DELETE,
            adminId: isAdminDelete ? actorIdDelete : undefined,
            userId: !isAdminDelete ? actorIdDelete : undefined,
            oldData: pkg,
            description: `Package deleted: ${pkg.name}`
        });

        res.status(200).json({
            message: 'Package deleted successfully'
        });
    } catch (err: any) {
        logger.error({ err, id: req.params.id }, 'Error deleting package');
        res.status(500).json({ error: 'Database error', message: err.message });
    }
};



