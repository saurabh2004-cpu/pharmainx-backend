import { Router } from 'express';
import { addToSavedJobs, getSavedJobsByUserId, removeFromSavedJobs } from '../controllers/savedJobs.controller.js';
import { authenticateToken } from '../middlewares/auth.middleware.js';

const router = Router();

router.post('/add', authenticateToken, addToSavedJobs);
router.delete('/remove/:jobId', authenticateToken, removeFromSavedJobs);
router.get('/get-saved-jobs/:userId', authenticateToken, getSavedJobsByUserId);

export default router;
