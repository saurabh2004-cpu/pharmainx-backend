import { Router } from 'express';
import {
    createInstitute,
    updateInstitute,
    deleteInstitute,
    getMyInstitute,
    getInstituteStats,
    searchInstitutes,
    getAllInstitutes,
    getInstituteById,
    loginInstitute,
    getInstituteJobs,
    getInstituteCredits
} from '../controllers/institute.controller.js';
import { authenticateToken } from '../middlewares/auth.middleware.js';
import { instituteViewTrackerMiddleware } from '../middlewares/institute-view-tracker.middleware.js';

const router = Router();

// Public Routes
router.get('/search-institutes', searchInstitutes);
router.get('/get-all-institutes', getAllInstitutes);
router.get('/get-institute/:id', instituteViewTrackerMiddleware, getInstituteById);

// Private Routes   
router.post('/create-institute', createInstitute);
router.post('/signin-institute', loginInstitute);
router.get('/my-profile', authenticateToken, getMyInstitute);
router.get('/my-stats', authenticateToken, getInstituteStats);
router.put('/update-institute/:id', authenticateToken, updateInstitute);
router.delete('/delete-institute/:id', authenticateToken, deleteInstitute);
router.get('/institutions/jobs', authenticateToken, getInstituteJobs);
router.get('/my-wallet', authenticateToken, getInstituteCredits);

export default router;
