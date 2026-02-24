import { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { getIO } from '../lib/socket.js';
import { uploadToS3, getCloudFrontUrl } from '../services/aws.service.js';
import path from 'path';
import crypto from 'crypto';

const getRoleType = (role: string) => {
    const instituteRoles = ['HOSPITAL', 'CLINIC', 'LAB', 'PHARMACY', 'INSTITUTE'];
    return instituteRoles.includes(role) ? 'INSTITUTE' : 'USER';
};

// Send Message
export const sendMessage = async (req: Request, res: Response): Promise<void> => {
    try {
        const { conversationId, content, mediaType } = req.body;
        // @ts-ignore
        const senderId = req.user.id;
        // @ts-ignore
        const senderRole = getRoleType(req.user.role); // USER or INSTITUTE
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
            where: { id: conversationId }
        });

        if (!conversation) {
            res.status(404).json({ error: 'Conversation not found' });
            return;
        }

        if (senderRole === 'USER' && conversation.userId !== senderId) {
            res.status(403).json({ error: 'Unauthorized' });
            return;
        }

        if (senderRole === 'INSTITUTE' && conversation.instituteId !== senderId) {
            res.status(403).json({ error: 'Unauthorized' });
            return;
        }

        // Create Message
        const message = await prisma.message.create({
            data: {
                conversationId,
                senderType: senderRole,
                senderId,
                content: content || '',
                mediaUrl: mediaUrl,
                mediaType: mediaType || (mediaFile ? (mediaFile.mimetype.startsWith('image') ? 'IMAGE' : mediaFile.mimetype.startsWith('video') ? 'VIDEO' : 'PDF') : null),
                isRead: false
            }
        });

        // Update Conversation (Last Message & Unread Count)
        let updateData: any = { lastMessageId: message.id };
        if (senderRole === 'USER') {
            updateData.instituteUnreadCount = { increment: 1 };
        } else {
            updateData.userUnreadCount = { increment: 1 };
        }

        await prisma.conversation.update({
            where: { id: conversationId },
            data: updateData
        });

        // Emit Socket Event
        const io = getIO();
        const receiverId = senderRole === 'USER' ? conversation.instituteId : conversation.userId;

        io.to(receiverId).emit('new_message', message);

        // Also emit to sender logic (handled by frontend typically, but good to acknowledge)
        // io.to(senderId).emit('message_sent', message);

        res.status(201).json(message);

    } catch (error) {
        console.error('Error sending message:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

// Get Messages
export const getMessages = async (req: Request, res: Response): Promise<void> => {
    try {
        const { conversationId } = req.params as { conversationId: string };
        const { page = 1, limit = 20 } = req.query as any;
        // @ts-ignore
        const userId = req.user.id;
        // @ts-ignore
        const role = getRoleType(req.user.role);

        // Verify access
        const conversation = await prisma.conversation.findUnique({
            where: { id: conversationId }
        });

        if (!conversation) {
            res.status(404).json({ error: 'Conversation not found' });
            return;
        }

        if (role === 'USER' && conversation.userId !== userId) {
            res.status(403).json({ error: 'Unauthorized' });
            return;
        }
        if (role === 'INSTITUTE' && conversation.instituteId !== userId) {
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
        const userId = req.user.id;
        // @ts-ignore
        const role = getRoleType(req.user.role);

        const conversation = await prisma.conversation.findUnique({
            where: { id: conversationId }
        });

        if (!conversation) {
            res.status(404).json({ error: 'Conversation not found' });
            return;
        }

        if ((role === 'USER' && conversation.userId !== userId) ||
            (role === 'INSTITUTE' && conversation.instituteId !== userId)) {
            res.status(403).json({ error: 'Unauthorized' });
            return;
        }

        // Update Messages as Read. 
        // We only mark messages sent by the OTHER party as read.
        const senderTypeToMark = role === 'USER' ? 'INSTITUTE' : 'USER';

        await prisma.message.updateMany({
            where: {
                conversationId,
                senderType: senderTypeToMark,
                isRead: false
            },
            data: { isRead: true }
        });

        // Reset Unread Count
        let updateData: any = {};
        if (role === 'USER') {
            updateData.userUnreadCount = 0;
        } else {
            updateData.instituteUnreadCount = 0;
        }

        await prisma.conversation.update({
            where: { id: conversationId },
            data: updateData
        });

        // Emit socket event to the SENDER that their messages were read
        const io = getIO();
        const senderId = role === 'USER' ? conversation.instituteId : conversation.userId;
        io.to(senderId).emit('messages_read', { conversationId, readerId: userId });

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
        const senderId = req.user.id;
        // @ts-ignore
        const senderRole = getRoleType(req.user.role);
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
            where: { id: conversationId }
        });

        if (!conversation) {
            res.status(404).json({ error: 'Conversation not found' });
            return;
        }

        if (senderRole === 'USER' && conversation.userId !== senderId) {
            res.status(403).json({ error: 'Unauthorized' });
            return;
        }

        if (senderRole === 'INSTITUTE' && conversation.instituteId !== senderId) {
            res.status(403).json({ error: 'Unauthorized' });
            return;
        }

        // Create Message
        const message = await prisma.message.create({
            data: {
                conversationId,
                senderType: senderRole,
                senderId,
                content: '',
                mediaUrl: mediaUrl,
                mediaType: 'VOICE',
                isRead: false
            }
        });

        // Update Conversation (Last Message & Unread Count)
        let updateData: any = { lastMessageId: message.id };
        if (senderRole === 'USER') {
            updateData.instituteUnreadCount = { increment: 1 };
        } else {
            updateData.userUnreadCount = { increment: 1 };
        }

        await prisma.conversation.update({
            where: { id: conversationId },
            data: updateData
        });

        // Emit Socket Event
        const io = getIO();
        const receiverId = senderRole === 'USER' ? conversation.instituteId : conversation.userId;

        io.to(receiverId).emit('new_message', message);

        res.status(201).json(message);

    } catch (error) {
        console.error('Error sending voice message:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};
