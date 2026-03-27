import { Router } from 'express';
const router = Router();
import { authenticateToken } from '../middlewares/auth.middleware.js';
import { createTransaction, getAllTransactions, getTransactionsByInstituteId, getTransactionsByPackageId } from '../controllers/transactions.controlller.js';


router.post("/create-transaction/:packageId", authenticateToken, createTransaction);
router.get("/get-all-transactions", authenticateToken, getAllTransactions);
router.get("/get-transactions-by-institute-id", authenticateToken, getTransactionsByInstituteId);
router.get("/get-transactions-by-package-id/:packageId", authenticateToken, getTransactionsByPackageId);

export default router;