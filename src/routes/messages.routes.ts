import express from 'express';
import { sendMessage, getMessages, markAsRead } from '../controllers/messages.controller.js';
import { authenticateToken } from '../middlewares/auth.middleware.js';
import { upload } from '../middleware/upload.js';

const router = express.Router();

router.use(authenticateToken);

router.post('/', upload.single('media'), sendMessage);
router.get('/:conversationId', getMessages);
router.patch('/:conversationId/read', markAsRead);

export default router;
