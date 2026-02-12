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
    relatedJobId?: string;
    relatedApplicationId?: string;
    status: ApplicationStatus;
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
        relatedJobId,
        relatedApplicationId
    } = params;

    try {
        // Create notification in database
        const notification = await prisma.notification.create({
            data: {
                receiverId,
                receiverRole,
                title,
                message,
                relatedJobId: relatedJobId || null,
                relatedApplicationId: relatedApplicationId || null
            }
        });

        // Emit notification via Socket.IO to the receiver
        try {
            const io = getIO();
            io.to(receiverId).emit('notification', notification, params.status);
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
