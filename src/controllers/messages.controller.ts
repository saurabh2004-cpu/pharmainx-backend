import { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { getIO } from '../lib/socket.js';

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
            // Generate full URL
            mediaUrl = `${process.env.BACKEND_URL || 'http://localhost:3001'}/uploads/messages/${mediaFile.filename}`;
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
        const { conversationId } = req.params;
        const { page = 1, limit = 20 } = req.query;
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
        const { conversationId } = req.params;
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
