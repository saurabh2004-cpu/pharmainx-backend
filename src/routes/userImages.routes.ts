import express from 'express';
import { uploadUserImages, getUserImages, deleteUserImage } from '../controllers/userImages.controller.js';
import { authenticateToken } from '../middlewares/auth.middleware.js';
import { upload } from '../middlewares/upload.js';

const router = express.Router();

// Apply auth middleware to all routes
router.use(authenticateToken);

// Upload/Update images
// Accepts 'profileImage' and/or 'coverImage'
router.post('/upload-images', upload.fields([
    { name: 'profileImage', maxCount: 1 },
    { name: 'coverImage', maxCount: 1 }
]), uploadUserImages);

// Get images
router.get('/get-user-images', getUserImages);

// Delete specific image
router.delete('/delete-user-image/:type', deleteUserImage);

export default router;
