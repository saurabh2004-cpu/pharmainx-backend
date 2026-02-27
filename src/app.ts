import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import path from 'path';

import cookieParser from 'cookie-parser';

// Load env vars
dotenv.config();

// Create Express app
const app: Express = express();

// Global Middlewares
app.use(helmet());
app.use(cors({
    origin: [
        "http://localhost:3000",
        "http://88.222.242.191:3000",
        "http://localhost:5173"
    ],
    credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(morgan('dev'));

// Health Check
app.get('/health', (req: Request, res: Response) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
import adminRoutes from './routes/admin.routes.js';
import userRoutes from './routes/user.routes.js';
import instituteRoutes from './routes/institute.routes.js';
import jobRoutes from './routes/job.routes.js';
import applicationRoutes from './routes/application.routes.js';
import specialtyRoutes from './routes/specialty.routes.js';
import savedJobRoutes from './routes/savedJobs.routes.js';
import creditsWalletRoutes from './routes/creditsWallet.routes.js';
import institutesCreditsRoutes from './routes/institutesCredits.routes.js';
import notificationRoutes from './routes/notification.routes.js';
import userImagesRoutes from './routes/userImages.routes.js';
import instituteImagesRoutes from './routes/instituteImages.routes.js';
import userVerificationsRoutes from './routes/userVerifications.routes.js';
import instituteVerificationsRoutes from './routes/institutesVerification.routes.js';
import conversationRoutes from './routes/conversations.routes.ts';
import messageRoutes from './routes/messages.routes.ts';
import creditsHistoryRoutes from './routes/creditsHistoryRoutes.ts';

app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/user', userRoutes);
app.use('/api/v1/institute', instituteRoutes);
app.use('/api/v1/job', jobRoutes);
app.use('/api/v1/application', applicationRoutes); // Note: Original was /v1/priv/application, checking index.ts
app.use('/api/v1/specialty', specialtyRoutes);
app.use('/api/v1/saved-job', savedJobRoutes);
app.use('/api/v1/credits-wallet', creditsWalletRoutes);
app.use('/api/v1/institute-credits', institutesCreditsRoutes);
app.use('/api/v1/notifications', notificationRoutes);

// Image Routes
app.use('/api/v1/user-images', userImagesRoutes);
app.use('/api/v1/institute-images', instituteImagesRoutes);
app.use('/api/v1/user-verifications', userVerificationsRoutes);
app.use('/api/v1/institute-verifications', instituteVerificationsRoutes);
app.use('/api/v1/conversations', conversationRoutes);
app.use('/api/v1/messages', messageRoutes);
app.use('/api/v1/credits-history', creditsHistoryRoutes);
// Static Uploads removed - Served via CloudFront

// Global Error Handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    console.error(err.stack);
    res.status(500).json({
        error: 'Internal Server Error',
        message: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

import { createServer } from 'http';
import { initializeSocket } from './lib/socket.js';
import { initJobExpiryCron } from './cron-jobs/jobs.js';

const PORT = 3001;
const server = createServer(app);

initializeSocket(server);

server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);

    // Initialize Cron Jobs
    initJobExpiryCron();
});

export default app;
