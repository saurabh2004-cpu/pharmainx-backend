import { Router } from 'express';
import {
    createCreditsWallet,
    getCreditsWallet,
    getAllCreditsWallets,
    updateCreditsWallet,
    deleteCreditsWallet
} from '../controllers/creditsWallet.controller.js';
import { authenticateToken } from '../middlewares/auth.middleware.js';

const router = Router();

router.post('/create', createCreditsWallet);
router.get('/get-all', getAllCreditsWallets);
router.get('/get/:id', getCreditsWallet);
router.put('/update/:id', updateCreditsWallet);
router.delete('/delete/:id', deleteCreditsWallet);

export default router;
