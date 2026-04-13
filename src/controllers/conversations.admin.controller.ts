import { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { getCloudFrontUrl } from '../services/aws.service.js';
import { AuthRequest } from '../middlewares/auth.middleware.js';

/**
 * Fetch list of institutes for admin conversation filters
 */
export const getAdminInstitutes = async (req: AuthRequest, res: Response) => {
    try {
        const { search = '' } = req.query;

        const institutes = await prisma.institute.findMany({
            where: {
                name: {
                    contains: search as string,
                    mode: 'insensitive'
                }
            },
            select: {
                id: true,
                name: true
            },
            take: 20
        });

        res.status(200).json(institutes);
    } catch (error) {
        console.error('Error fetching admin institutes:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

/**
 * Fetch list of users for admin conversation filters
 */
export const getAdminUsers = async (req: AuthRequest, res: Response) => {
    try {
        const { search = '' } = req.query;

        const users = await prisma.user.findMany({
            where: {
                OR: [
                    { firstName: { contains: search as string, mode: 'insensitive' } },
                    { lastName: { contains: search as string, mode: 'insensitive' } },
                    { email: { contains: search as string, mode: 'insensitive' } }
                ]
            },
            select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true
            },
            take: 20
        });

        res.status(200).json(users);
    } catch (error) {
        console.error('Error fetching admin users:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

/**
 * Fetch all conversations with optional filters for admin
 */
export const getAdminConversations = async (req: AuthRequest, res: Response) => {
    try {
        const { instituteId, userId, page = 1, limit = 20 } = req.query;
        const skip = (Number(page) - 1) * Number(limit);

        const where: any = {};
        if (instituteId) where.instituteId = instituteId as string;
        if (userId) where.userId = userId as string;

        const [conversations, total] = await Promise.all([
            prisma.conversation.findMany({
                where,
                include: {
                    user: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            userImages: true
                        }
                    },
                    institute: {
                        select: {
                            id: true,
                            name: true,
                            instituteImages: true
                        }
                    },
                    lastMessage: true,
                    _count: {
                        select: { messages: true }
                    }
                },
                orderBy: { updatedAt: 'desc' },
                skip,
                take: Number(limit)
            }),
            prisma.conversation.count({ where })
        ]);

        const formattedConversations = conversations.map(conv => {
            const userImg = conv.user.userImages?.[0];
            const instImg = conv.institute.instituteImages?.[0];

            return {
                id: conv.id,
                user: {
                    ...conv.user,
                    profileImage: userImg?.profileImage ? getCloudFrontUrl(userImg.profileImage) : null
                },
                institute: {
                    ...conv.institute,
                    profileImage: instImg?.profileImage ? getCloudFrontUrl(instImg.profileImage) : null
                },
                lastMessage: conv.lastMessage,
                totalMessages: conv._count.messages,
                updatedAt: conv.updatedAt
            };
        });

        res.status(200).json({
            conversations: formattedConversations,
            total,
            page: Number(page),
            totalPages: Math.ceil(total / Number(limit))
        });
    } catch (error) {
        console.error('Error fetching admin conversations:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

/**
 * Fetch messages for a specific conversation for admin (Infinite Scroll)
 */
export const getAdminMessages = async (req: AuthRequest, res: Response) => {
    try {
        const { conversationId } = req.params;
        const { cursor, limit = 20 } = req.query;

        const messages = await prisma.message.findMany({
            where: { conversationId: conversationId.toString() },
            take: Number(limit),
            ...(cursor && {
                skip: 1, // Skip the cursor itself
                cursor: { id: cursor as string }
            }),
            orderBy: { createdAt: 'desc' }
        });

        // The next cursor is the ID of the last element in the returned array
        const nextCursor = messages.length === Number(limit) ? messages[messages.length - 1].id : null;

        res.status(200).json({
            messages: messages.reverse(), // Reverse to show oldest first in UI
            nextCursor
        });
    } catch (error) {
        console.error('Error fetching admin messages:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};
