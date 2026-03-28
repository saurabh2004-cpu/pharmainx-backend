import { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { getServiceLogger } from '../utils/logger.js';
import { CreditHistoryAction, CreditHistoryType } from '../generated/prisma/enums.js';
const logger = getServiceLogger('transactions.controller');


export const createTransaction = async (req: Request, res: Response) => {
    // Cast to any since standard Express Request doesn't have user
    const instituteId = (req as any).user?.id;
    const { amount } = req.body;
    const { packageId } = req.params;

    try {
        const pkg = await prisma.packages.findUnique({
            where: { id: String(packageId) }
        });

        if (!pkg) {
            return res.status(404).json({ message: 'Package not found' });
        }


        const [transaction, creditsHistory] = await prisma.$transaction(async (tx) => {
            const t = await tx.transactions.create({
                data: {
                    instituteId: String(instituteId),
                    amount: Number(amount),
                    packageId: String(packageId),
                },
            });

            // Get existing credits or create new record
            let wallet = await tx.instituteCredits.findFirst({
                where: { instituteId: String(instituteId) }
            });

            if (!wallet) {
                wallet = await tx.instituteCredits.create({
                    data: {
                        instituteId: String(instituteId),
                        credits: Number(pkg.credits)
                    }
                });
            } else {
                wallet = await tx.instituteCredits.update({
                    where: { id: wallet.id },
                    data: {
                        credits: { increment: Number(pkg.credits) }
                    }
                });
            }

            const ch = await tx.creditsHistory.create({
                data: {
                    instituteId: String(instituteId),
                    type: CreditHistoryType.CREDIT,
                    action: CreditHistoryAction.CREDITS_PURCHASED,
                    purchasedCredits: Number(pkg.credits),
                    currentCredits: wallet.credits,
                },
            });

            return [t, ch];
        });

        res.status(201).json({
            message: 'Transaction created and credits added successfully',
            data: { transaction, creditsHistory }
        });

    } catch (error: any) {
        logger.error({ error, instituteId, packageId }, 'Error creating transaction');
        res.status(500).json({ error: 'Database error', message: error.message });
    }
};

export const getAllTransactions = async (req: Request, res: Response) => {
    try {
        const transactions = await prisma.transactions.findMany({
            orderBy: {
                createdAt: 'desc'
            },
            include: {
                institute: true,
                package: true
            }
        })


        if (!transactions) {
            return res.status(404).json({ message: 'Transactions not found' });
        }

        res.status(200).json({
            data: transactions
        })
    } catch (error: any) {
        logger.error({ error }, 'Error fetching transactions');
        res.status(500).json({ error: 'Database error', message: error.message });
    }
}

export const getTransactionsByInstituteId = async (req: Request, res: Response) => {
    const instituteId = (req as any).user?.id;
    try {
        const transactions = await prisma.transactions.findMany({
            where: { instituteId: String(instituteId) },
            orderBy: {
                createdAt: 'desc'
            },
            include: {
                institute: true,
                package: true
            },
        })


        if (!transactions) {
            return res.status(404).json({ message: 'Transactions not found' });
        }

        res.status(200).json({
            data: transactions
        })
    } catch (error: any) {
        logger.error({ error }, 'Error fetching transactions');
        res.status(500).json({ error: 'Database error', message: error.message });
    }
}

export const getTransactionsByPackageId = async (req: Request, res: Response) => {
    const { packageId } = req.params;
    try {
        const transactions = await prisma.transactions.findMany({
            where: { packageId: String(packageId) },
            orderBy: {
                createdAt: 'desc'
            },
            include: {
                institute: true,
                package: true
            }
        })

        if (!transactions) {
            return res.status(404).json({ message: 'Transactions not found' });
        }

        res.status(200).json({
            data: transactions
        })
    } catch (error: any) {
        logger.error({ error }, 'Error fetching transactions');
        res.status(500).json({ error: 'Database error', message: error.message });
    }
}

