import { Router } from 'express';
import { searchSpecialties, createSpecialty } from '../controllers/specialty.controller.js';
import { authenticateToken } from '../middlewares/auth.middleware.js';

const router = Router();

// Public
router.get('/search', searchSpecialties);

// Private
router.post('/', authenticateToken, createSpecialty);

export default router;
