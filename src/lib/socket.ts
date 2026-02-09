import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HttpServer } from 'http';
import jwt from 'jsonwebtoken';
import { prisma } from './prisma.js';

interface AuthSocket extends Socket {
    user?: {
        id: string;
        role: string;
    };
}

let io: SocketIOServer;

export const initializeSocket = (httpServer: HttpServer) => {
    io = new SocketIOServer(httpServer, {
        cors: {
            origin: "http://localhost:3000",
            methods: ["GET", "POST", "PUT", "DELETE"],
            credentials: true
        }
    });

    io.use((socket: AuthSocket, next) => {
        const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];

        if (!token) {
            return next(new Error("Authentication error: No token provided"));
        }

        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret') as { id: string; role: string };
            socket.user = decoded;
            next();
        } catch (err) {
            next(new Error("Authentication error: Invalid token"));
        }
    });

    io.on('connection', async (socket: AuthSocket) => {
        const userId = socket.user?.id;
        const role = socket.user?.role;

        if (userId) {
            console.log(`User connected: ${userId} (${role})`);
            socket.join(userId); // Join room based on ID (works for both User and Institute)

            // Fetch pending notifications
            try {
                const notifications = await prisma.notification.findMany({
                    where: {
                        receiverId: userId,
                        isRead: false
                    },
                    orderBy: { createdAt: 'asc' }
                });

                if (notifications.length > 0) {
                    notifications.forEach((notification) => {
                        socket.emit('notification', notification);
                    });

                    // Update them to read
                    await prisma.notification.updateMany({
                        where: {
                            id: { in: notifications.map(n => n.id) }
                        },
                        data: { isRead: true }
                    });
                }
            } catch (error) {
                console.error("Error fetching offline notifications:", error);
            }
        }

        socket.on('disconnect', () => {
            console.log(`User disconnected: ${userId}`);
        });
    });

    return io;
};

export const getIO = () => {
    if (!io) {
        throw new Error("Socket.io not initialized!");
    }
    return io;
};
