import { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { getServiceLogger } from '../utils/logger.js';
import { AuthRoles, UserRoles, InstituteRoles } from '../generated/prisma/client.ts';

const logger = getServiceLogger('Notification');

interface AuthRequest extends Request {
    user?: {
        id: string;
        role: string;
    };
}

/**
 * Helper to map specific roles (DOCTOR, LAB, etc.) to generic notification roles (USER, INSTITUTE)
 */
const getNotificationRole = (role: string): string => {
    if (Object.values(UserRoles).includes(role as any) || role === 'USER') {
        return 'USER';
    }
    if (Object.values(InstituteRoles).includes(role as any) || role === 'INSTITUTE') {
        return 'INSTITUTE';
    }
    return role;
};

/**
 * Get paginated notifications for the authenticated user/institute
 */
export const getMyNotifications = async (req: AuthRequest, res: Response) => {
    const authId = req.user?.id;
    const authRole = req.user?.role;

    if (!authId || !authRole) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const notificationRole = getNotificationRole(authRole);

    const query = req.query as any;
    const page = parseInt((query.page as string) || '1');
    const pageSize = parseInt((query.pageSize as string) || '20');
    const skip = (page - 1) * pageSize;
    const take = pageSize;

    try {
        const [notifications, total] = await Promise.all([
            prisma.notification.findMany({
                where: {
                    receiverId: authId,
                    receiverRole: notificationRole
                },
                skip,
                take,
                orderBy: { createdAt: 'desc' },
                include: {
                    job: true,
                    application: true
                }
            }),
            prisma.notification.count({
                where: {
                    receiverId: authId,
                    receiverRole: notificationRole
                }
            })
        ]);

        logger.info({ userId: authId, page, pageSize, total }, 'Fetched notifications');
        res.status(200).json({ notifications, page, pageSize, total });
    } catch (err) {
        logger.error({ err, userId: authId }, 'Error fetching notifications');
        res.status(500).json({ error: 'Database error' });
    }
};

/**
 * Get count of unread notifications for the authenticated user/institute
 */
export const getUnreadCount = async (req: AuthRequest, res: Response) => {
    const authId = req.user?.id;
    const authRole = req.user?.role;

    if (!authId || !authRole) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const notificationRole = getNotificationRole(authRole);

    try {
        const count = await prisma.notification.count({
            where: {
                receiverId: authId,
                receiverRole: notificationRole,
                isRead: false
            }
        });

        logger.info({ userId: authId, count }, 'Fetched unread notification count');
        res.status(200).json({ count });
    } catch (err) {
        logger.error({ err, userId: authId }, 'Error fetching unread count');
        res.status(500).json({ error: 'Database error' });
    }
};

/**
 * Mark a specific notification as read
 */
export const markAsRead = async (req: AuthRequest, res: Response) => {
    const { id } = req.params as any;
    const authId = req.user?.id;
    const authRole = req.user?.role;

    if (!authId || !authRole) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const notificationRole = getNotificationRole(authRole);

    try {
        // Verify ownership before updating
        const notification = await prisma.notification.findUnique({
            where: { id }
        });

        if (!notification) {
            return res.status(404).json({ error: 'Notification not found' });
        }

        if (notification.receiverId !== authId || notification.receiverRole !== notificationRole) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        const updated = await prisma.notification.update({
            where: { id },
            data: { isRead: true }
        });

        logger.info({ notificationId: id, userId: authId }, 'Marked notification as read');
        res.status(200).json(updated);
    } catch (err: any) {
        logger.error({ err, notificationId: id, userId: authId }, 'Error marking notification as read');
        if (err.code === 'P2025') {
            return res.status(404).json({ error: 'Notification not found' });
        }
        res.status(500).json({ error: 'Database error' });
    }
};

/**
 * Mark all notifications as read for the authenticated user/institute
 */
export const markAllAsRead = async (req: AuthRequest, res: Response) => {

    console.log("mark all as read request received")
    const authId = req.user?.id;
    const authRole = req.user?.role;

    if (!authId || !authRole) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const notificationRole = getNotificationRole(authRole);

    try {
        const result = await prisma.notification.updateMany({
            where: {
                receiverId: authId,
                receiverRole: notificationRole,
                isRead: false
            },
            data: { isRead: true }
        });

        logger.info({ userId: authId, count: result.count }, 'Marked all notifications as read');
        res.status(200).json({ success: true, count: result.count });
    } catch (err) {
        logger.error({ err, userId: authId }, 'Error marking all notifications as read');
        res.status(500).json({ error: 'Database error' });
    }
};

export const getAllMyUnreadNotifications = async (req: AuthRequest, res: Response) => {
    const authId = req.user?.id;
    const authRole = req.user?.role;

    if (!authId || !authRole) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const notificationRole = getNotificationRole(authRole);

    try {
        const notifications = await prisma.notification.findMany({
            where: {
                receiverId: authId,
                receiverRole: notificationRole,
                isRead: false
            },
            orderBy: { createdAt: 'desc' },
            include: {
                job: true,
                application: true
            }
        });

        console.log("unread notifications", notifications);

        logger.info({ userId: authId, count: notifications.length }, 'Fetched unread notifications');
        res.status(200).json({ notifications });
    } catch (err) {
        logger.error({ err, userId: authId }, 'Error fetching unread notifications');
        res.status(500).json({ error: 'Database error' });
    }
};