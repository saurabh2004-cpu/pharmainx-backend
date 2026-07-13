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
        const { type, search = '', page = 1, limit = 20 } = req.query;
        const skip = (Number(page) - 1) * Number(limit);
        const SUPER_ADMIN_ID = '00000000-0000-0000-0000-000000000000';

        const conversations = await prisma.conversation.findMany({
            where: {
                participants: {
                    some: {
                        participantType: 'SUPER_ADMIN',
                        participantId: SUPER_ADMIN_ID
                    }
                }
            },
            include: {
                participants: true,
                lastMessage: true
            },
            orderBy: { updatedAt: 'desc' }
        });

        const formattedConversations = await Promise.all(conversations.map(async conv => {
            const otherParticipant = conv.participants.find(p => p.participantId !== SUPER_ADMIN_ID);
            let participant: any = null;

            if (otherParticipant) {
                if (otherParticipant.participantType === 'USER') {
                    participant = await prisma.user.findUnique({
                        where: { id: otherParticipant.participantId },
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            userImages: true,
                            email: true
                        }
                    });
                } else if (otherParticipant.participantType === 'INSTITUTE') {
                    participant = await prisma.institute.findUnique({
                        where: { id: otherParticipant.participantId },
                        select: {
                            id: true,
                            name: true,
                            instituteImages: true,
                            contactEmail: true
                        }
                    });
                }
            }

            if (participant && otherParticipant) {
                if (otherParticipant.participantType === 'USER') {
                    const images = participant.userImages?.[0];
                    participant.profile_picture = images?.profileImage ? getCloudFrontUrl(images.profileImage) : null;
                    participant.displayName = `${participant.firstName} ${participant.lastName || ''}`;
                } else if (otherParticipant.participantType === 'INSTITUTE') {
                    const images = participant.instituteImages?.[0];
                    participant.profile_picture = images?.profileImage ? getCloudFrontUrl(images.profileImage) : null;
                    participant.displayName = participant.name;
                }
                participant.participantType = otherParticipant.participantType;
            }

            return {
                id: conv.id,
                participant,
                lastMessage: conv.lastMessage,
                unreadCount: otherParticipant ? (otherParticipant.participantType === 'USER' ? conv.instituteUnreadCount : conv.userUnreadCount) : 0,
                updatedAt: conv.updatedAt
            };
        }));

        let filtered = formattedConversations.filter(c => c.participant !== null);

        if (type === 'USER') {
            filtered = filtered.filter(c => c.participant.participantType === 'USER');
        } else if (type === 'INSTITUTE') {
            filtered = filtered.filter(c => c.participant.participantType === 'INSTITUTE');
        }

        if (search) {
            const query = (search as string).toLowerCase();
            filtered = filtered.filter(c => 
                c.participant.displayName.toLowerCase().includes(query) ||
                (c.participant.email && c.participant.email.toLowerCase().includes(query)) ||
                (c.participant.contactEmail && c.participant.contactEmail.toLowerCase().includes(query))
            );
        }

        const total = filtered.length;
        const paginated = filtered.slice(skip, skip + Number(limit));

        res.status(200).json({
            conversations: paginated,
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
