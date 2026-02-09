import { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { getServiceLogger } from '../utils/logger.js';
import { z } from 'zod';

const logger = getServiceLogger("CreditsWallet");

const CreditsWalletSchema = z.object({
    totalCredits: z.number().int().nonnegative().optional().default(0),
    newJobCreditsPrice: z.number().int().nonnegative().optional().default(0),
    renewJobCreditsPrice: z.number().int().nonnegative().optional().default(0),
});

const UpdateCreditsWalletSchema = z.object({
    totalCredits: z.number().int().nonnegative().optional(),
    newJobCreditsPrice: z.number().int().nonnegative().optional(),
    renewJobCreditsPrice: z.number().int().nonnegative().optional(),
});

interface AuthRequest extends Request {
    user?: {
        id: number | string;
        role: string;
    };
}

// Create a new credits wallet
export const createCreditsWallet = async (req: AuthRequest, res: Response) => {
    const parseResult = CreditsWalletSchema.safeParse(req.body);
    if (!parseResult.success) {
        return res.status(400).json({ error: 'Invalid input', details: parseResult.error.errors });
    }

    const { newJobCreditsPrice, renewJobCreditsPrice } = parseResult.data;

    try {
        const wallet = await prisma.creditsWallet.create({
            data: {
                newJobCreditsPrice,
                renewJobCreditsPrice,
            },
        });

        logger.info({ walletId: wallet.id }, 'Credits wallet created');
        res.status(201).json(wallet);
    } catch (err) {
        logger.error({ err, body: req.body }, 'Database error during createCreditsWallet');
        res.status(500).json({ error: 'Database error' });
    }
};

// Fetch a single credits wallet by id
export const getCreditsWallet = async (req: Request, res: Response) => {
    const { id } = req.params;
    const idStr = id as string;

    try {
        const wallet = await prisma.creditsWallet.findUnique({
            where: { id: idStr },
        });

        if (!wallet) {
            return res.status(404).json({ error: 'Credits wallet not found' });
        }

        res.status(200).json(wallet);
    } catch (err) {
        logger.error({ err, id }, 'Database error during getCreditsWallet');
        res.status(500).json({ error: 'Database error' });
    }
};

// Fetch all credits wallets
export const getAllCreditsWallets = async (req: Request, res: Response) => {
    const query = req.query as any;
    const page = parseInt((query.page as string) || '1');
    const pageSize = parseInt((query.pageSize as string) || '20');
    const skip = (page - 1) * pageSize;
    const take = pageSize;


    try {
        const [wallets, total] = await Promise.all([
            prisma.creditsWallet.findMany({
                skip,
                take,
                orderBy: { created_at: 'desc' },
            }),
            prisma.creditsWallet.count(),
        ]);

        logger.info({ page, pageSize, total }, 'Fetched credits wallets');
        res.status(200).json({ wallets, page, pageSize, total });
    } catch (err) {
        logger.error({ err, query }, 'Database error during getAllCreditsWallets');
        res.status(500).json({ error: 'Database error' });
    }
};

// Update credits wallet
export const updateCreditsWallet = async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const idStr = id as string;

    const parseResult = UpdateCreditsWalletSchema.safeParse(req.body);
    if (!parseResult.success) {
        return res.status(400).json({ error: 'Invalid input', details: parseResult.error.errors });
    }

    const updateData = parseResult.data;

    try {
        const existingWallet = await prisma.creditsWallet.findUnique({ where: { id: idStr } });
        if (!existingWallet) {
            return res.status(404).json({ error: 'Credits wallet not found' });
        }

        const updatedWallet = await prisma.creditsWallet.update({
            where: { id: idStr },
            data: updateData,
        });

        logger.info({ walletId: id }, 'Credits wallet updated');
        res.status(200).json(updatedWallet);
    } catch (err) {
        logger.error({ err, id, body: req.body }, 'Database error during updateCreditsWallet');
        res.status(500).json({ error: 'Database error' });
    }
};

// Delete credits wallet
export const deleteCreditsWallet = async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const idStr = id as string;

    try {
        const existingWallet = await prisma.creditsWallet.findUnique({ where: { id: idStr } });
        if (!existingWallet) {
            return res.status(404).json({ error: 'Credits wallet not found' });
        }

        await prisma.creditsWallet.delete({ where: { id: idStr } });

        logger.info({ walletId: id }, 'Credits wallet deleted');
        res.status(200).json({ message: 'Credits wallet deleted successfully' });
    } catch (err) {
        logger.error({ err, id }, 'Database error during deleteCreditsWallet');
        res.status(500).json({ error: 'Database error' });
    }
};
