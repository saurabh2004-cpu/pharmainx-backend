import express from 'express';
import {
    createUserSocialMediaLink,
    deleteUserSocialMediaLink,
    getUserSocialMediaLinks,
    createInstituteSocialMediaLink,
    deleteInstituteSocialMediaLink,
    getInstituteSocialMediaLinks
} from '../controllers/socialMedia.controller.js';
import { authenticateToken } from '../middlewares/auth.middleware.js';

const router = express.Router();

// ==========================================
// USER ROUTES
// ==========================================

router.post('/user', authenticateToken, createUserSocialMediaLink);
router.delete('/user/:id', authenticateToken, deleteUserSocialMediaLink);
router.get('/user/:userId', getUserSocialMediaLinks); // Anyone can view links

// ==========================================
// INSTITUTE ROUTES
// ==========================================

router.post('/institute', authenticateToken, createInstituteSocialMediaLink);
router.delete('/institute/:id', authenticateToken, deleteInstituteSocialMediaLink);
router.get('/institute/:instituteId', getInstituteSocialMediaLinks); // Anyone can view links

export default router;
