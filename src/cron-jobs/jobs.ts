import cron from 'node-cron';
import { prisma } from '../lib/prisma.js';
import { getServiceLogger } from '../utils/logger.js';
import { InstituteRoles } from '../controllers/job.controller.js';
import { Prisma } from '../generated/prisma/client.ts';

const logger = getServiceLogger('Cron:JobExpiry');

/**
 * Initialize the Job Expiry Cron Job
 * Frequency: Every day at midnight (00:00)
 */
export const initJobExpiryCron = () => {
    logger.info('Initializing Job Expiry Cron Job...');

    // Schedule: "0 0 * * *" = At minute 0 past hour 0 (Midnight)
    cron.schedule('0 0 * * *', async () => {
        logger.info('Running daily job expiry check and reminders...');

        try {
            const now = new Date();

            // --- 1. REMINDERS (7 Days and 1 Day before) ---
            const ranges = [1, 7]; // Days before expiry

            for (const days of ranges) {
                const targetStart = new Date();
                targetStart.setDate(targetStart.getDate() + days);
                targetStart.setHours(0, 0, 0, 0);

                const targetEnd = new Date();
                targetEnd.setDate(targetEnd.getDate() + days);
                targetEnd.setHours(23, 59, 59, 999);

                // Find active jobs expiring on this target day
                const jobsToRemind = await prisma.job.findMany({
                    where: {
                        status: 'active',
                        applicationDeadline: {
                            gte: targetStart,
                            lte: targetEnd
                        }
                    },
                    include: {
                        institute: true
                    }
                });

                if (jobsToRemind.length > 0) {
                    const title = `Job Expiry Reminder: ${days} Day${days > 1 ? 's' : ''} Left`;

                    // Filter out jobs that already have THIS notification
                    // We can't do a complex NOT EXISTS efficiently in one go for diverse JobIDs without raw SQL or loop.
                    // Loop is acceptable for cron volume usually. 

                    const notificationsToCreate: Prisma.NotificationCreateManyInput[] = [];

                    for (const job of jobsToRemind) {
                        const message = `Your job posting "${job.title}" will expire in ${days} day${days > 1 ? 's' : ''}. Please renew it if you wish to keep it active.`;

                        // Check duplicate
                        const exists = await prisma.notification.findFirst({
                            where: {
                                relatedJobId: job.id,
                                title: title,
                                // timestamp check usually not needed if title is unique per "event" type 
                                // and we only send once for this specific target window.
                                // But to be safe against re-runs same day:
                                createdAt: {
                                    gte: new Date(new Date().setHours(0, 0, 0, 0))
                                }
                            }
                        });

                        if (!exists) {
                            notificationsToCreate.push({
                                receiverId: job.instituteId,
                                receiverRole: 'INSTITUTE', // Assuming string literal or enum match
                                title: title,
                                message: message,
                                relatedJobId: job.id,
                                isRead: false,
                            });
                        }
                    }

                    if (notificationsToCreate.length > 0) {
                        await prisma.notification.createMany({
                            data: notificationsToCreate
                        });
                        logger.info({ count: notificationsToCreate.length, daysBefore: days }, 'Sent expiry reminders');
                    }
                }
            }

            // --- 2. EXPIRY (Deadlines Passed) --- 
            // Update all jobs where deadline < now AND status is not 'expired'
            const result = await prisma.job.updateMany({
                where: {
                    applicationDeadline: {
                        lt: now
                    },
                    status: {
                        not: 'expired'
                    }
                },
                data: {
                    status: 'expired'
                }
            });

            if (result.count > 0) {
                logger.info({ count: result.count }, 'Successfully expired outdated jobs');
            }
            // Reduced log noise for "No jobs found"

        } catch (error: any) {
            logger.error({ err: error, message: error.message }, 'Error running job expiry cron');
        }
    });

    logger.info('Job Expiry Cron scheduled (Daily at 00:00)');
};