import { Router } from 'express';
import {
    createVerification,
    getVerificationById,
    getAllUserVerifications,
    deleteVerificationById,
    deleteAllVerifications,
    approveVerification,
    rejectVerification,
    getVerificationByUserId
} from '../controllers/userVerifications.controller.js';
import { upload } from '../middlewares/upload.js';
import { authenticateToken } from '../middlewares/auth.middleware.js';

const router = Router();

// Create Verification
router.post('/create-verification', authenticateToken, upload.fields([
    { name: 'governMentId', maxCount: 1 },
    { name: 'degreeCertificate', maxCount: 1 },
    { name: 'postGraduateDegreeCertificate', maxCount: 1 }
]), createVerification);

// Get All Verifications (with pagination and status filter)
router.get('/get-all-verifications', authenticateToken, getAllUserVerifications);

// Get Verification By Id
router.get('/get-verification-by-id/:id', authenticateToken, getVerificationById);

// Delete All Verifications
router.delete('/delete-all-verifications', authenticateToken, deleteAllVerifications);

// Delete Verification By Id
router.delete('/delete-verification-by-id/:id', authenticateToken, deleteVerificationById);

// Approve Verification
router.patch('/approve-verification/:id', authenticateToken, approveVerification);

// Reject Verification
router.patch('/reject-verification/:id', authenticateToken, rejectVerification);

// Get Verification By User Id
router.get('/get-verification-by-user-id/:userId', authenticateToken, getVerificationByUserId);

export default router;
