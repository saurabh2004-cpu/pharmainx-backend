import express from 'express';
import { uploadInstituteImages, getInstituteImages, deleteInstituteImage } from '../controllers/instituteImages.controller.js';
import { authenticateToken } from '../middlewares/auth.middleware.js';
import { upload } from '../middlewares/upload.js';
const router = express.Router();

router.use(authenticateToken);

// Upload/Update images
router.post('/upload', upload.fields([
    { name: 'profileImage', maxCount: 1 },
    { name: 'coverImage', maxCount: 1 }
]), uploadInstituteImages);

// Get images
router.get('/', getInstituteImages);

// Delete specific image
router.delete('/:type', deleteInstituteImage);

export default router;
