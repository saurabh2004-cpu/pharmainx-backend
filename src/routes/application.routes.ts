import { Router } from 'express';
import {
    applyForJob, // Replaces createApplication
    requestNextRound,
    respondNextRound,
    scheduleInterview,
    interviewDecision,
    hire,
    deleteApplication,
    getApplicationsByJobId,
    getApplicationsByUserId,
    getUserApplicationByJobId,
    getApplicationById,
    getUserApplicationStats,
    shortList,
    reject,
} from '../controllers/application.controller.js';
import { authenticateToken } from '../middlewares/auth.middleware.js';
import { uploadRecursive } from '../middlewares/multer.js';

const router = Router();

router.use(authenticateToken); // All routes require auth

// Read Routes
router.get('/my-stats', getUserApplicationStats); // Stats endpoint
router.get('/get-applications-by-job/:jobId', authenticateToken, getApplicationsByJobId);
router.get('/get-applications-by-user/:userId', authenticateToken, getApplicationsByUserId);
router.get('/get-user-application-by-job/:userId/:jobId', authenticateToken, getUserApplicationByJobId);
router.get('/get-application/:id', authenticateToken, getApplicationById); // Changed param to :id for consistency or keep :applicationId if controller uses it. Controller uses :id in simple calls but getApplicationById uses :applicationId? Let's check controller.

// Controller getApplicationById uses { applicationId } = req.params.
// Wait, my new controller code (which I overwrote) used { id } for lifecycle events but kept getApplicationById with { applicationId }? 
// Actually I overwrote generic getApplicationById in Step 68: "const { id } = req.params as any;".
// So I should use :id.

// Application Lifecycle Routes
router.post('/apply', authenticateToken, uploadRecursive.single('resume'), applyForJob); // New standard route
router.post('/create-application', authenticateToken, uploadRecursive.single('resume'), applyForJob); // Backward compatibility

router.put('/:id/request-next-round', authenticateToken, requestNextRound);
router.put('/:id/respond-next-round', authenticateToken, respondNextRound);
router.put('/:id/schedule-interview', authenticateToken, scheduleInterview);
router.put('/:id/interview-decision', authenticateToken, interviewDecision);
router.put('/:id/hire', authenticateToken, hire);
router.put('/:id/shortlist', authenticateToken, shortList);
router.put('/:id/reject', authenticateToken, reject);

// Delete
router.delete('/delete-application/:id', authenticateToken, deleteApplication);


export default router;
