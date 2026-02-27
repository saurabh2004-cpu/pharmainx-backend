import { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { getServiceLogger } from '../utils/logger.js';
import { z } from 'zod';
import { CreditHistoryAction, CreditHistoryType } from '../generated/prisma/enums.js';

const logger = getServiceLogger("InstituteCredits");

// Schemas
const CreateInstituteCreditsSchema = z.object({
    instituteId: z.string().uuid(),
    credits: z.number().int().nonnegative().default(0),
});

const UpdateInstituteCreditsSchema = z.object({
    credits: z.number().int().nonnegative(),
});

// Helper type
interface AuthRequest extends Request {
    user?: {
        id: number | string;
        role: string;
    };
}

// 1. Create credits record for an institute
export const createInstituteCredits = async (req: AuthRequest, res: Response) => {
    const parseResult = CreateInstituteCreditsSchema.safeParse(req.body);
    if (!parseResult.success) {
        return res.status(400).json({ error: 'Invalid input', details: parseResult.error.errors });
    }

    const { instituteId, credits } = parseResult.data;

    try {
        // Validation: Institute exists
        const institute = await prisma.institute.findUnique({
            where: { id: instituteId }
        });

        if (!institute) {
            return res.status(404).json({ error: 'Institute not found' });
        }



        // Validation: Only one credits record per institute
        const existingCredits = await prisma.instituteCredits.findFirst({
            where: { instituteId: instituteId }
        });

        if (existingCredits) {
            return res.status(400).json({ error: 'Credits record already exists for this institute' });
        }

        const result = await prisma.$transaction(async (tx) => {

            const newCredits = await tx.instituteCredits.create({
                data: {
                    instituteId,
                    credits
                },
                include: {
                    institute: {
                        select: {
                            id: true,
                            name: true,
                            role: true
                        }
                    }
                }
            });

            await tx.creditsHistory.create({
                data: {
                    instituteId,
                    currentCredits: credits,
                    purchasedCredits: credits,
                    action: CreditHistoryAction.CREDITS_PURCHASED,
                    type: CreditHistoryType.CREDIT
                }
            })

            logger.info({ instituteId, creditsId: newCredits.id }, 'Institute credits record created');
            return newCredits;
        });

        res.status(201).json(result);

    } catch (err: any) {
        logger.error({ err, message: err.message, instituteId }, 'Database error during createInstituteCredits');
        res.status(500).json({ error: 'Database error', message: err.message });
    }
};

// 2. Update credits for an institute
export const updateInstituteCredits = async (req: AuthRequest, res: Response) => {
    const { id } = req.params as { id: string }; // Can be InstituteCredits ID OR Institute ID

    const parseResult = UpdateInstituteCreditsSchema.safeParse(req.body);
    if (!parseResult.success) {
        return res.status(400).json({ error: 'Invalid input', details: parseResult.error.errors });
    }

    const { credits } = parseResult.data;

    try {
        // Strategy: Try to find by ID first, if not, try to find by instituteId
        // However, Prisma doesn't support "OR" in top-level update where clause easily if fields are unique vs non-unique unless we find first.

        let targetRecord = await prisma.instituteCredits.findUnique({
            where: { id }
        });

        if (!targetRecord) {
            // Try matching by instituteId
            // Note: instituteId is not marked @unique in schema for InstituteCredits, so we use findFirst.
            // But our create logic enforces logical uniqueness.
            targetRecord = await prisma.instituteCredits.findFirst({
                where: { instituteId: id }
            });
        }

        if (!targetRecord) {
            return res.status(404).json({ error: 'Institute credits record not found' });
        }

        const result = await prisma.$transaction(async (tx) => {
            const updatedRecord = await tx.instituteCredits.update({
                where: { id: targetRecord.id },
                data: { credits },
                include: {
                    institute: {
                        select: {
                            id: true,
                            name: true
                        }
                    }
                }
            });

            await tx.creditsHistory.create({
                data: {
                    instituteId: targetRecord.instituteId,
                    currentCredits: credits,
                    action: CreditHistoryAction.CREDITS_PURCHASED,
                    type: CreditHistoryType.CREDIT,
                    purchasedCredits: credits - targetRecord.credits
                }
            })

            logger.info({ creditsId: updatedRecord.id, newCredits: credits }, 'Institute credits updated');
            return updatedRecord;
        });

        res.status(200).json(result);


    } catch (err: any) {
        logger.error({ err, message: err.message, queryId: id }, 'Database error during updateInstituteCredits');
        res.status(500).json({ error: 'Database error', message: err.message });
    }
};

// 3. Fetch credits for a single institute
export const getInstituteCredits = async (req: Request, res: Response) => {
    const { id } = req.params as { id: string }; // Can be InstituteCredits ID OR Institute ID

    try {
        let record = await prisma.instituteCredits.findUnique({
            where: { id },
            include: {
                institute: {
                    select: {
                        id: true,
                        name: true,
                        contactEmail: true
                    }
                }
            }
        });

        if (!record) {
            record = await prisma.instituteCredits.findFirst({
                where: { instituteId: id },
                include: {
                    institute: {
                        select: {
                            id: true,
                            name: true,
                            contactEmail: true
                        }
                    }
                }
            });
        }

        if (!record) {
            return res.status(404).json({ error: 'Institute credits record not found' });
        }

        logger.info({ creditsId: record.id, instituteId: record.instituteId }, 'Fetched institute credits');
        res.status(200).json(record);

    } catch (err: any) {
        logger.error({ err, queryId: id }, 'Database error during getInstituteCredits');
        res.status(500).json({ error: 'Database error' });
    }
};

// 4. Fetch all InstituteCredits records
export const getAllInstituteCredits = async (req: Request, res: Response) => {
    const query = req.query as any;
    const page = parseInt((query.page as string) || '1');
    const limitParams = query.limit || query.pageSize;
    const limit = parseInt((limitParams as string) || '10');
    const skip = (page - 1) * limit;
    const take = limit;

    try {
        const [records, total] = await Promise.all([
            prisma.instituteCredits.findMany({
                skip,
                take,
                orderBy: { updated_at: 'desc' },
                include: {
                    institute: {
                        select: {
                            id: true,
                            name: true,
                            role: true,
                            city: true,
                            country: true
                        }
                    }
                }
            }),
            prisma.instituteCredits.count(),
        ]);

        logger.info({ page, limit, total }, 'Fetched all institute credits records');
        res.status(200).json({
            data: records,
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit)
        });

    } catch (err: any) {
        logger.error({ err, query }, 'Database error during getAllInstituteCredits');
        res.status(500).json({ error: 'Database error' });
    }
};

// 5. Delete InstituteCredits record
export const deleteInstituteCredits = async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const idStr = id as string;

    try {
        const existingRecord = await prisma.instituteCredits.findUnique({ where: { id: idStr } });
        if (!existingRecord) {
            return res.status(404).json({ error: 'Institute credits record not found' });
        }

        await prisma.instituteCredits.delete({ where: { id: idStr } });

        logger.info({ creditsId: idStr }, 'Institute credits record deleted');
        res.status(200).json({ message: 'Institute credits deleted successfully' });
    } catch (err: any) {
        logger.error({ err, id: idStr }, 'Database error during deleteInstituteCredits');
        res.status(500).json({ error: 'Database error', message: err.message });
    }
};
