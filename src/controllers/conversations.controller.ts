import { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { getIO } from '../lib/socket.js';
import { InstituteRoles, UserRoles } from '../generated/prisma/client.ts';
import { getCloudFrontUrl } from '../services/aws.service.js';

// Initiate Conversation (Institute Only)
export const initiateConversation = async (req: Request, res: Response): Promise<void> => {
    try {
        const { applicationId, message, mediaUrl, mediaType } = req.body;
        // @ts-ignore
        const instituteId = req.user.id;
        // @ts-ignore
        const role = req.user.role;

        // if (!InstituteRoles.includes(role)) {
        //     res.status(403).json({ error: 'Only institutes can initiate conversations.' });
        //     return;
        // }

        // 1. Get Application to find User
        const application = await prisma.application.findUnique({
            where: { id: applicationId },
            include: { job: true }
        });

        if (!application) {
            res.status(404).json({ error: 'Application not found.' });
            return;
        }

        // Verify Institute owns the job
        if (application.job.instituteId !== instituteId) {
            res.status(403).json({ error: 'You are not authorized to message this candidate.' });
            return;
        }

        const userId = application.userId;

        // 2. Check if conversation exists
        let conversation = await prisma.conversation.findFirst({
            where: {
                instituteId: instituteId,
                userId: userId
            }
        });

        const io = getIO();

        if (!conversation) {
            // Create new conversation
            conversation = await prisma.conversation.create({
                data: {
                    instituteId: instituteId,
                    userId: userId,
                    instituteUnreadCount: 0,
                    userUnreadCount: 0
                }
            });

            // Emit Socket Events
            io.to(userId).emit('new_conversation', conversation);

            res.status(201).json({ conversation });
        } else {
            // Conversation exists, just return it
            res.status(200).json({ conversation });
        }

    } catch (error) {
        console.error('Error initiating conversation:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

// Get All Conversations for Logged In Entity
export const getConversations = async (req: Request, res: Response): Promise<void> => {
    try {
        // @ts-ignore
        const id = req.user.id;
        // @ts-ignore
        const role = req.user.role; // USER or INSTITUTE

        const getRoleType = (role: string) => {
            const instituteRoles = ['HOSPITAL', 'CLINIC', 'LAB', 'PHARMACY', 'INSTITUTE'];
            return instituteRoles.includes(role) ? 'INSTITUTE' : 'USER';
        };

        const roleType = getRoleType(role as string);
        const isInstituteUser = roleType === 'INSTITUTE';

        let whereClause = {};
        if (isInstituteUser) {
            whereClause = { instituteId: id };
        } else {
            whereClause = { userId: id };
        }

        const conversations = await prisma.conversation.findMany({
            where: whereClause,
            include: {
                user: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        userImages: true,
                    }
                },
                institute: {
                    select: {
                        id: true,
                        name: true,
                        instituteImages: true,
                    }
                },
                lastMessage: true
            },
            orderBy: { updatedAt: 'desc' }
        });

        const formattedConversations = conversations.map(conv => {
            const participant: any = isInstituteUser ? conv.user : conv.institute;
            // Map images
            if (participant) {
                const images = isInstituteUser ? participant.userImages?.[0] : participant.instituteImages?.[0];
                participant.profile_picture = images?.profileImage ? getCloudFrontUrl(images.profileImage) : null;
            }

            return {
                id: conv.id,
                participant,
                lastMessage: conv.lastMessage,
                unreadCount: isInstituteUser ? conv.instituteUnreadCount : conv.userUnreadCount,
                updatedAt: conv.updatedAt
            };
        });

        res.status(200).json(formattedConversations);

    } catch (error) {
        console.error('Error fetching conversations:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

// Get Unread Messages Count
export const getUnreadMessagesCount = async (req: Request, res: Response): Promise<void> => {
    try {
        // @ts-ignore
        const id = req.user.id;
        // @ts-ignore
        const role = req.user.role; // USER or INSTITUTE

        const getRoleType = (role: string) => {
            const instituteRoles = ['HOSPITAL', 'CLINIC', 'LAB', 'PHARMACY', 'INSTITUTE'];
            return instituteRoles.includes(role) ? 'INSTITUTE' : 'USER';
        };

        const roleType = getRoleType(role as string);
        let whereClause = {};
        let countField = '';

        if (roleType === 'INSTITUTE') {
            whereClause = { instituteId: id };
            countField = 'instituteUnreadCount';
        } else {
            whereClause = { userId: id };
            countField = 'userUnreadCount';
        }

        const conversations = await prisma.conversation.findMany({
            where: whereClause
        });

        const totalUnread = conversations.reduce((sum, conv: any) => {
            const val = conv[countField];
            return sum + (typeof val === 'number' ? val : 0);
        }, 0);

        res.status(200).json({ unreadCount: totalUnread });

    } catch (error) {
        console.error('Error fetching unread messages count:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};
