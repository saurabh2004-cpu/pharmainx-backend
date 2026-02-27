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
router.post('/create', createInstituteCredits);

// Update existing credits record
router.put('/update/:id', updateInstituteCredits);

// Get specific credits record by ID or Institute ID
router.get('/get/:id', getInstituteCredits);

// Get all credits records (paginated)
router.get('/get-all', getAllInstituteCredits);

// Delete specific credits record
router.delete('/delete/:id', deleteInstituteCredits);

export default router;
