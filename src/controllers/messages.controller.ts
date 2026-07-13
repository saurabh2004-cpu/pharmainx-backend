import { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { getIO } from '../lib/socket.js';
import { uploadToS3, getCloudFrontUrl } from '../services/aws.service.js';
import path from 'path';
import crypto from 'crypto';

import { ParticipantType } from '../generated/prisma/client.js';

export const SUPER_ADMIN_ID = '00000000-0000-0000-0000-000000000000';

export const getMessagingEntity = (role: string, id: string) => {
    const instituteRoles = ['HOSPITAL', 'CLINIC', 'LAB', 'PHARMACY', 'INSTITUTE'];
    const adminRoles = ['MASTER_ADMIN', 'ADMIN', 'SUPER_ADMIN'];

    if (adminRoles.includes(role)) {
        return {
            role: 'SUPER_ADMIN',
            id: SUPER_ADMIN_ID
        };
    }
    if (instituteRoles.includes(role)) {
        return {
            role: 'INSTITUTE',
            id: id
        };
    }
    return {
        role: 'USER',
        id: id
    };
};

// Send Message
export const sendMessage = async (req: Request, res: Response): Promise<void> => {
    try {
        const { conversationId, content, mediaType } = req.body;
        // @ts-ignore
        const entity = getMessagingEntity(req.user.role, req.user.id);
        const senderId = entity.id;
        const senderRole = entity.role;
        const mediaFile = req.file;


        let mediaUrl = null;
        if (mediaFile) {
            const fileExt = path.extname(mediaFile.originalname);
            const uniqueName = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
            const s3Key = `conversation-media/${uniqueName}${fileExt}`;

            // Upload to S3
            await uploadToS3(mediaFile.buffer, s3Key, mediaFile.mimetype);

            // Get CloudFront URL
            mediaUrl = getCloudFrontUrl(s3Key);
        }

        // Verify participant
        const conversation = await prisma.conversation.findUnique({
            where: { id: conversationId },
            include: { participants: true }
        });

        if (!conversation) {
            res.status(404).json({ error: 'Conversation not found' });
            return;
        }

        if (!conversation.participants.some((p) => p.participantType === senderRole && p.participantId === senderId)) {
            res.status(403).json({ error: 'Unauthorized' });
            return;
        }

        // Create Message
        const message = await prisma.message.create({
            data: {
                conversationId,
                senderType: senderRole as any,
                senderId,
                content: content || '',
                mediaUrl: mediaUrl,
                mediaType: mediaType || (mediaFile ? (mediaFile.mimetype.startsWith('image') ? 'IMAGE' : mediaFile.mimetype.startsWith('video') ? 'VIDEO' : 'PDF') : null),
                isRead: false
            }
        });

        // Update Conversation (Last Message & Unread Count)
        let updateData: any = { lastMessageId: message.id };
        const otherParticipant = conversation.participants.find(p => p.participantId !== senderId);
        if (otherParticipant) {
            if (otherParticipant.participantType === 'USER') {
                updateData.userUnreadCount = { increment: 1 };
            } else if (otherParticipant.participantType === 'INSTITUTE') {
                updateData.instituteUnreadCount = { increment: 1 };
            } else if (otherParticipant.participantType === 'SUPER_ADMIN') {
                if (senderRole === 'USER') {
                    updateData.instituteUnreadCount = { increment: 1 };
                } else if (senderRole === 'INSTITUTE') {
                    updateData.userUnreadCount = { increment: 1 };
                }
            }
        }

        await prisma.conversation.update({
            where: { id: conversationId },
            data: updateData
        });

        // Emit Socket Event
        const io = getIO();
        const receiverId = otherParticipant ? otherParticipant.participantId : '';

        // Emit to both the specific receiver's room and the conversation room
        io.to(receiverId).emit('new_message', message);
        io.to(conversationId).emit('new_message', message);

        res.status(201).json(message);

    } catch (error) {
        console.error('Error sending message:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

// Send Feedback Message (to SUPER_ADMIN)
export const sendFeedbackMessage = async (req: Request, res: Response): Promise<void> => {
    try {
        const { feedbackType, message: feedbackText } = req.body;
        // @ts-ignore
        const entity = getMessagingEntity(req.user.role, req.user.id);
        const senderId = entity.id;
        const senderRole = entity.role;

        if (!feedbackType || !feedbackText) {
            res.status(400).json({ error: 'Feedback type and message are required' });
            return;
        }

        // 1. Check if conversation with SUPER_ADMIN exists
        let conversation = await prisma.conversation.findFirst({
            where: {
                AND: [
                    {
                        participants: {
                            some: {
                                participantType: senderRole as any,
                                participantId: senderId
                            }
                        }
                    },
                    {
                        participants: {
                            some: {
                                participantType: ParticipantType.SUPER_ADMIN,
                                participantId: SUPER_ADMIN_ID
                            }
                        }
                    }
                ]
            },
            include: { participants: true }
        });

        const io = getIO();

        // 2. Create if not exists
        if (!conversation) {
            conversation = await prisma.conversation.create({
                data: {
                    instituteUnreadCount: 0,
                    userUnreadCount: 0,
                    participants: {
                        create: [
                            {
                                participantType: senderRole as any,
                                participantId: senderId
                            },
                            {
                                participantType: ParticipantType.SUPER_ADMIN,
                                participantId: SUPER_ADMIN_ID
                            }
                        ]
                    }
                },
                include: { participants: true }
            });

            // Emit Socket Events for new conversation
            io.to(senderId).emit('new_conversation', conversation);
            io.to(SUPER_ADMIN_ID).emit('new_conversation', conversation);
        }

        // 3. Format Message
        const titleMap: Record<string, string> = {
            'JOB_LOOKING': 'What jobs are you looking for?',
            'FEATURE': 'What would you like to see added?',
            'CHAT': 'Chat with us'
        };
        const title = titleMap[feedbackType] || feedbackType;
        const content = `**Feedback Type:**\n${title}\n\n**Message:**\n${feedbackText}`;

        // 4. Create Message
        const message = await prisma.message.create({
            data: {
                conversationId: conversation.id,
                senderType: senderRole as any,
                senderId: senderId,
                content: content,
                isRead: false
            }
        });

        // 5. Update Conversation (Last Message & Unread Count)
        let updateData: any = { lastMessageId: message.id };
        if (senderRole === 'USER') {
            updateData.instituteUnreadCount = { increment: 1 };
        } else if (senderRole === 'INSTITUTE') {
            updateData.userUnreadCount = { increment: 1 };
        }

        await prisma.conversation.update({
            where: { id: conversation.id },
            data: updateData
        });

        // 6. Emit message socket event
        io.to(SUPER_ADMIN_ID).emit('new_message', message);
        io.to(conversation.id).emit('new_message', message);
        io.to(senderId).emit('new_message', message);

        res.status(201).json(message);

    } catch (error) {
        console.error('Error sending feedback message:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

// Get Messages
export const getMessages = async (req: Request, res: Response): Promise<void> => {
    try {
        const { conversationId } = req.params as { conversationId: string };
        const { page = 1, limit = 20 } = req.query as any;
        // @ts-ignore
        const entity = getMessagingEntity(req.user.role, req.user.id);

        // Verify access
        const conversation = await prisma.conversation.findUnique({
            where: { id: conversationId },
            include: { participants: true }
        });

        if (!conversation) {
            res.status(404).json({ error: 'Conversation not found' });
            return;
        }

        if (!conversation.participants.some((p) => p.participantType === entity.role && p.participantId === entity.id)) {
            res.status(403).json({ error: 'Unauthorized' });
            return;
        }

        const messages = await prisma.message.findMany({
            where: { conversationId },
            orderBy: { createdAt: 'desc' }, // Get newest first
            skip: (Number(page) - 1) * Number(limit),
            take: Number(limit)
        });

        // Reverse to send oldest to newest for the frontend chat view
        res.status(200).json(messages.reverse());

    } catch (error) {
        console.error('Error getting messages:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

// Mark as Read
export const markAsRead = async (req: Request, res: Response): Promise<void> => {
    try {
        const { conversationId } = req.params as { conversationId: string };
        // @ts-ignore
        const entity = getMessagingEntity(req.user.role, req.user.id);

        const conversation = await prisma.conversation.findUnique({
            where: { id: conversationId },
            include: { participants: true }
        });

        if (!conversation) {
            res.status(404).json({ error: 'Conversation not found' });
            return;
        }

        if (!conversation.participants.some((p) => p.participantType === entity.role && p.participantId === entity.id)) {
            res.status(403).json({ error: 'Unauthorized' });
            return;
        }

        // Update Messages as Read. 
        // We only mark messages sent by the OTHER party as read.
        await prisma.message.updateMany({
            where: {
                conversationId,
                senderId: { not: entity.id },
                isRead: false
            },
            data: { isRead: true }
        });

        // Reset Unread Count
        let updateData: any = {};
        if (entity.role === 'USER') {
            updateData.userUnreadCount = 0;
        } else if (entity.role === 'INSTITUTE') {
            updateData.instituteUnreadCount = 0;
        } else if (entity.role === 'SUPER_ADMIN') {
            const other = conversation.participants.find(p => p.participantId !== entity.id);
            if (other?.participantType === 'USER') {
                updateData.instituteUnreadCount = 0;
            } else if (other?.participantType === 'INSTITUTE') {
                updateData.userUnreadCount = 0;
            }
        }

        await prisma.conversation.update({
            where: { id: conversationId },
            data: updateData,
            include: { participants: true }
        });

        // Emit socket event to the SENDER that their messages were read
        const io = getIO();
        const other = conversation.participants.find(p => p.participantId !== entity.id);
        const senderId = other ? other.participantId : '';
        io.to(senderId).emit('messages_read', { conversationId, readerId: entity.id });

        res.status(200).json({ success: true });

    } catch (error) {
        console.error('Error marking read:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

// Send Voice Message
export const sendVoiceMessage = async (req: Request, res: Response): Promise<void> => {
    try {
        const { conversationId } = req.body;
        // @ts-ignore
        const entity = getMessagingEntity(req.user.role, req.user.id);
        const senderId = entity.id;
        const senderRole = entity.role;
        const audioFile = req.file;

        if (!audioFile) {
            res.status(400).json({ error: 'Audio file is required' });
            return;
        }

        // Validate file size (10MB)
        if (audioFile.size > 10 * 1024 * 1024) {
            res.status(400).json({ error: 'Audio file size exceeds 10MB limit' });
            return;
        }

        const fileExt = path.extname(audioFile.originalname) || '.webm';
        const uniqueName = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
        const s3Key = `conversation-media/voice-${uniqueName}${fileExt}`;

        // Upload to S3
        await uploadToS3(audioFile.buffer, s3Key, audioFile.mimetype);

        // Get CloudFront URL
        const mediaUrl = getCloudFrontUrl(s3Key);

        // Verify participant
        const conversation = await prisma.conversation.findUnique({
            where: { id: conversationId },
            include: { participants: true }
        });

        if (!conversation) {
            res.status(404).json({ error: 'Conversation not found' });
            return;
        }

        if (!conversation.participants.some((p) => p.participantType === senderRole && p.participantId === senderId)) {
            res.status(403).json({ error: 'Unauthorized' });
            return;
        }

        // Create Message
        const message = await prisma.message.create({
            data: {
                conversationId,
                senderType: senderRole as any,
                senderId,
                content: '',
                mediaUrl: mediaUrl,
                mediaType: 'VOICE',
                isRead: false
            }
        });

        // Update Conversation (Last Message & Unread Count)
        let updateData: any = { lastMessageId: message.id };
        const otherParticipant = conversation.participants.find(p => p.participantId !== senderId);
        if (otherParticipant) {
            if (otherParticipant.participantType === 'USER') {
                updateData.userUnreadCount = { increment: 1 };
            } else if (otherParticipant.participantType === 'INSTITUTE') {
                updateData.instituteUnreadCount = { increment: 1 };
            } else if (otherParticipant.participantType === 'SUPER_ADMIN') {
                if (senderRole === 'USER') {
                    updateData.instituteUnreadCount = { increment: 1 };
                } else if (senderRole === 'INSTITUTE') {
                    updateData.userUnreadCount = { increment: 1 };
                }
            }
        }

        await prisma.conversation.update({
            where: { id: conversationId },
            data: updateData,
            include: { participants: true }
        });

        // Emit Socket Event
        const io = getIO();
        const receiverId = otherParticipant ? otherParticipant.participantId : '';

        io.to(receiverId).emit('new_message', message);
        io.to(conversationId).emit('new_message', message);

        res.status(201).json(message);

    } catch (error) {
        console.error('Error sending voice message:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};
