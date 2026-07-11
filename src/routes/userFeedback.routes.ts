import { Router } from 'express';
import { createFeedBack, getFeedBacks, getFeedbackById } from '../controllers/userFeedback.controller.ts';
import { authenticateToken } from '../middlewares/auth.middleware.ts';
const router = Router();


router.post('/create-feedback', authenticateToken, createFeedBack);
router.get('/get-feedbacks', authenticateToken, getFeedBacks);
router.get('/get-feedback/:id', authenticateToken, getFeedbackById);

export default router;