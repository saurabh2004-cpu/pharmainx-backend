import { Router } from 'express';
import {
    createJob,
    updateJob,
    deleteJob,
    getAllJobs,
    getJobById,
    getJobsByInstitution,
    searchJobs,
    renewJob,
    toggleJobStatus,
    getRecommendedJobs,
    getJobByIdInstitute
} from '../controllers/job.controller.js';
import { authenticateToken } from '../middlewares/auth.middleware.js';
import { viewTrackerMiddleware } from '../middlewares/view-tracker.middleware.js';

const router = Router();

// Public Routes
router.get('/search-job', searchJobs);

router.get('/institute-jobs/:instituteId', getJobsByInstitution);
router.get('/get-job/:id', viewTrackerMiddleware, authenticateToken, getJobById);

// Private Routes
router.get('/all-jobs', authenticateToken, getAllJobs);
router.post('/create-job', authenticateToken, createJob);
router.put('/update-job/:id', authenticateToken, updateJob);
router.delete('/delete-job/:id', authenticateToken, deleteJob);
router.put('/renew-job/:id', authenticateToken, renewJob);
router.patch('/toggle-job-status/:id', authenticateToken, toggleJobStatus);
router.get('/recommended-jobs', authenticateToken, getRecommendedJobs);

router.get('/get-job-institute/:jobId', authenticateToken, getJobByIdInstitute);


export default router;
