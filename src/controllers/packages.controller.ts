import { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { getServiceLogger } from '../utils/logger.js';

const logger = getServiceLogger("Packages");

export const createPackage = async (req: Request, res: Response) => {
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

        res.status(201).json({
            message: 'Package created successfully',
            data: newPackage
        });
    } catch (err: any) {
        logger.error({ err }, 'Error creating package');
        res.status(500).json({ error: 'Database error', message: err.message });
    }
};

export const getAllPackages = async (req: Request, res: Response) => {
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

export const getPackageById = async (req: Request, res: Response) => {
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

export const updatePackage = async (req: Request, res: Response) => {
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

        res.status(200).json({
            message: 'Package updated successfully',
            data: updatedPackage
        });
    } catch (err: any) {
        logger.error({ err, id: req.params.id }, 'Error updating package');
        res.status(500).json({ error: 'Database error', message: err.message });
    }
};

export const deletePackage = async (req: Request, res: Response) => {
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

        res.status(200).json({
            message: 'Package deleted successfully'
        });
    } catch (err: any) {
        logger.error({ err, id: req.params.id }, 'Error deleting package');
        res.status(500).json({ error: 'Database error', message: err.message });
    }
};



