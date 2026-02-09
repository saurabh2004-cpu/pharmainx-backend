import express from 'express';
import { uploadInstituteImages, getInstituteImages, deleteInstituteImage } from '../controllers/instituteImages.controller.js';
import { authenticateToken } from '../middlewares/auth.middleware.js';
import { upload } from '../middlewares/upload.js';

const router = express.Router();

// Apply auth middleware
router.use(authenticateToken);

// Role check middleware
const isInstitute = (req: any, res: any, next: any) => {
    const allowedRoles = ['INSTITUTE', 'HOSPITAL', 'CLINIC'];
    if (req.user?.role && allowedRoles.includes(req.user.role)) {
        next();
    } else {
        return res.status(403).json({ error: 'Forbidden: Institutes only' });
    }
};

router.use(isInstitute);

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
