import { Router } from 'express';
import {
    getMyNotifications,
    getUnreadCount,
    markAsRead,
    markAllAsRead
} from '../controllers/notification.controller.js';
import { authenticateToken } from '../middlewares/auth.middleware.js';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// Get paginated notifications for authenticated user/institute
router.get('/my-notifications', getMyNotifications);

// Get unread notification count
router.get('/unread-count', getUnreadCount);

// Mark specific notification as read
router.put('/:id/mark-as-read', markAsRead);

// Mark all notifications as read
router.put('/mark-all-as-read', markAllAsRead);

export default router;
