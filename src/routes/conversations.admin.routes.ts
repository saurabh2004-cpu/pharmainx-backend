import { Router } from 'express';
import { authenticateToken } from '../middlewares/auth.middleware.js';
import { 
    getAdminInstitutes, 
    getAdminUsers, 
    getAdminConversations, 
    getAdminMessages 
} from '../controllers/conversations.admin.controller.js';

const router = Router();

// All routes here are protected and intended for Admins
router.use(authenticateToken);

router.get('/institutes', getAdminInstitutes);
router.get('/users', getAdminUsers);
router.get('/all', getAdminConversations);
router.get('/:conversationId/messages', getAdminMessages);

export default router;
