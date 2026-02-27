import { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { getServiceLogger } from '../utils/logger.js';
const logger = getServiceLogger("CreditsHistory");

export const getCreditsHistoryById = async (req: Request, res: Response) => {
    const { id } = req.params as { id: string };

    try {
        const creditsHistory = await prisma.creditsHistory.findUnique({
            where: { id },
            include: {
                institute: true,
                job: true
            }
        });

        if (!creditsHistory) {
            return res.status(404).json({ error: 'Credits history not found' });
        }

        res.status(200).json(creditsHistory);
    } catch (err: any) {
        logger.error({ err, message: err.message, queryId: id }, 'Database error during getCreditsHistoryById');
        res.status(500).json({ error: 'Database error', message: err.message });
    }
};

export const getCreditsHistoryByInstituteId = async (req: Request, res: Response) => {
    const { id } = req.params as { id: string };

    try {
        const creditsHistory = await prisma.creditsHistory.findMany({
            where: { instituteId: id },
            include: {
                institute: {
                    select: {
                        id: true,
                        name: true,
                        instituteImages: true,
                    }
                },
                job: {
                    select: {
                        id: true,
                        title: true,
                    }
                }
            },
            orderBy: { created_at: 'desc' }
        });

        res.status(200).json(creditsHistory);
    } catch (err: any) {
        logger.error({ err, message: err.message, queryId: id }, 'Database error during getCreditsHistoryByInstituteId');
        res.status(500).json({ error: 'Database error', message: err.message });
    }
};

export const getAllCreditsHistory = async (req: Request, res: Response) => {
    const query = req.query as any;
    const page = parseInt((query.page as string) || '1');
    const limit = parseInt((query.limit as string) || '10');
    const skip = (page - 1) * limit;
    const take = limit;

    try {
        const [creditsHistory, total] = await Promise.all([
            prisma.creditsHistory.findMany({
                skip,
                take,
                orderBy: { created_at: 'desc' },
                include: {
                    institute: {
                        select: {
                            id: true,
                            name: true,
                            instituteImages: true,
                        }
                    },
                    job: {
                        select: {
                            id: true,
                            title: true,
                        }
                    }
                }
            }),
            prisma.creditsHistory.count()
        ]);

        res.status(200).json({
            data: creditsHistory,
            total,
            page,
            totalPages: Math.ceil(total / limit)
        });
    } catch (err: any) {
        logger.error({ err, message: err.message }, 'Database error during getAllCreditsHistory');
        res.status(500).json({ error: 'Database error', message: err.message });
    }
};
