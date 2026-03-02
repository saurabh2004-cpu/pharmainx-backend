import { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { getServiceLogger } from '../utils/logger.js';
import { ActivityLogsModule, ActivityActionType } from '../generated/prisma/client.ts';

const logger = getServiceLogger("ActivityLogs");

export const getAllActivityLogs = async (req: Request, res: Response) => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;
        const module = req.query.module as string | undefined;
        const action = req.query.action as string | undefined;

        const where: any = {};
        if (module && module !== 'All') where.module = module;
        if (action && action !== 'All') where.action = action;

        const total = await prisma.activityLogs.count({ where });
        const logs = await prisma.activityLogs.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            skip: (page - 1) * limit,
            take: limit
        });

        const totalPages = Math.ceil(total / limit);

        res.status(200).json({
            data: logs,
            pagination: {
                total,
                page,
                limit,
                totalPages
            }
        });
    } catch (err: any) {
        logger.error({ err }, 'Error fetching activity logs');
        res.status(500).json({ error: 'Database error', message: err.message });
    }
};

export const getActivityLogById = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const log = await prisma.activityLogs.findUnique({
            where: { id: String(id) }
        });

        if (!log) {
            return res.status(404).json({ message: 'Activity log not found' });
        }

        res.status(200).json(log);
    } catch (err: any) {
        logger.error({ err, id: req.params.id }, 'Error fetching activity log by id');
        res.status(500).json({ error: 'Database error', message: err.message });
    }
};
