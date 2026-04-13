import { Router } from 'express';
import {
    createInstituteCredits,
    updateInstituteCredits,
    getInstituteCredits,
    getAllInstituteCredits,
    deleteInstituteCredits
} from '../controllers/institutesCredits.controller.js';
import { authenticateToken } from '../middlewares/auth.middleware.js';

const router = Router();

// Create new credits record
router.post('/create', authenticateToken, createInstituteCredits);

// Update existing credits record
router.put('/update/:id', authenticateToken, updateInstituteCredits);

// Get specific credits record by ID or Institute ID
router.get('/get/:id', authenticateToken, getInstituteCredits);

// Get all credits records (paginated)
router.get('/get-all', authenticateToken, getAllInstituteCredits);

// Delete specific credits record
router.delete('/delete/:id', authenticateToken, deleteInstituteCredits);

export default router;
