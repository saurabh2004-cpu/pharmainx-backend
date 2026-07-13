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
    const allowedOrigins = [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://88.222.242.191:3000",
        "http://88.222.242.191:5173",
        "https://pharmainc.in",
        "https://admin.pharminc.in",
        "https://pharmincdev.in"
    ];

    if (process.env.SOCKET_ALLOWED_ORIGIN) {
        allowedOrigins.push(process.env.SOCKET_ALLOWED_ORIGIN);
    }

    io = new SocketIOServer(httpServer, {
        cors: {
            origin: allowedOrigins,
            methods: ["GET", "POST", "PUT", "DELETE"],
            credentials: true
        }
    });

    io.use((socket: AuthSocket, next) => {
        let token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];

        if (!token && socket.handshake.headers.cookie) {
            const cookies = socket.handshake.headers.cookie.split(';').reduce((acc: any, cookie) => {
                const [key, value] = cookie.trim().split('=');
                if (key && value) acc[key] = value;
                return acc;
            }, {});
            token = cookies.adminAccessToken || cookies.accessToken;
        }

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

            // Let Admin/Super Admin join the general SUPER_ADMIN room
            if (role === 'MASTER_ADMIN' || role === 'ADMIN' || role === 'SUPER_ADMIN') {
                const SUPER_ADMIN_ID = '00000000-0000-0000-0000-000000000000';
                socket.join(SUPER_ADMIN_ID);
                console.log(`Admin ${userId} joined system SUPER_ADMIN channel`);
            }

            // Conversation Events
            socket.on('join_conversation', (conversationId: string) => {
                socket.join(conversationId);
                console.log(`User ${userId} joined conversation ${conversationId}`);
            });

            socket.on('leave_conversation', (conversationId: string) => {
                socket.leave(conversationId);
                console.log(`User ${userId} left conversation ${conversationId}`);
            });

            socket.on('typing_start', (conversationId: string) => {
                socket.to(conversationId).emit('typing_start', { conversationId, userId });
            });

            socket.on('typing_stop', (conversationId: string) => {
                socket.to(conversationId).emit('typing_stop', { conversationId, userId });
            });

            // Fetch pending notifications
            try {
                const notifications = await prisma.notification.findMany({
                    where: {
                        receiverId: userId,
                        isRead: false
                    },
                    orderBy: { createdAt: 'asc' },
                    include: {
                        application: {
                            include: {
                                job: {
                                    include: {
                                        institute: {
                                            include: { instituteImages: true }
                                        }
                                    }
                                }
                            }
                        }
                    }
                });

                if (notifications.length > 0) {
                    notifications.forEach((notification) => {
                        socket.emit('notification', notification);
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
