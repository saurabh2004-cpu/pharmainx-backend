import express from 'express';
import { initiateConversation, getConversations, getUnreadMessagesCount } from '../controllers/conversations.controller.js';
import { authenticateToken } from '../middlewares/auth.middleware.js';

const router = express.Router();

router.use(authenticateToken);

router.get('/unread-count', getUnreadMessagesCount);
router.post('/initiate', initiateConversation);
router.get('/', getConversations);

export default router;
