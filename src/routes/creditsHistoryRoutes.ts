import { Router } from "express";
import {
    getCreditsHistoryById,
    getCreditsHistoryByInstituteId,
    getAllCreditsHistory
} from "../controllers/creditsHistory.controller ";
import { authenticateToken } from "../middlewares/auth.middleware";
const router = Router();

router.get("/credits-history/:id", authenticateToken, getCreditsHistoryById);

router.get("/credits-history/institute/:id", authenticateToken, getCreditsHistoryByInstituteId);

router.get("/all-credits-history", authenticateToken, getAllCreditsHistory);

export default router;
