import { ApplicationStatus } from '../generated/prisma/enums.js';
import { prisma } from '../lib/prisma.js';
import { getIO } from '../lib/socket.js';
import { getServiceLogger } from './logger.js';

const logger = getServiceLogger('NotificationService');

interface SendNotificationParams {
    receiverId: string;
    receiverRole: 'USER' | 'INSTITUTE';
    title: string;
    message: string;
    applicationId: string;
    status: ApplicationStatus;
    interviewType?: string;
    interviewTime?: string;
    interviewLink?: string;
}

/**
 * Centralized notification service
 * Creates a notification in the database and emits it via Socket.IO
 */
export const sendNotification = async (params: SendNotificationParams): Promise<void> => {
    const {
        receiverId,
        receiverRole,
        title,
        message,
        applicationId,
        interviewType,
        interviewTime,
        interviewLink
    } = params;

    console.log("notification params", params);

    try {
        // Create notification in database
        const notification = await prisma.notification.create({
            data: {
                receiverId,
                receiverRole,
                title,
                message,
                applicationId,
                isRead: false,
                status: params.status
            },
            include: {
                application: {
                    select: {
                        id: true,
                        job: {
                            select: {
                                id: true,
                                title: true,
                                institute: {
                                    select: {
                                        id: true,
                                        name: true
                                    }
                                }
                            }
                        }
                    }
                }
            }
        });

        // Emit notification via Socket.IO to the receiver
        try {
            const io = getIO();
            
            // Prepare payload with transient interview details if they exist
            const emitPayload = {
                ...notification,
                interviewType: interviewType || undefined,
                interviewTime: interviewTime || undefined,
                interviewLink: interviewLink || undefined,
                interviewDetails: interviewType ? {
                    interviewType,
                    interviewTime,
                    interviewLink
                } : undefined
            };

            io.to(receiverId).emit('notification', emitPayload, params.status);
            logger.info({ notificationId: notification.id, receiverId }, 'Notification sent via Socket.IO');
        } catch (socketError) {
            // Socket.IO might not be initialized in some contexts (e.g., tests)
            // Log but don't fail the notification creation
            logger.warn({ socketError, notificationId: notification.id }, 'Failed to emit notification via Socket.IO');
        }

        logger.info({ notificationId: notification.id, receiverId, receiverRole }, 'Notification created successfully');
    } catch (err) {
        logger.error({ err, receiverId, receiverRole }, 'Failed to create notification');
        // Don't throw - notification failure shouldn't break the main flow
    }
};
