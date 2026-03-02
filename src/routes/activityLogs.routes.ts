import { Router } from "express";
import { authenticateToken } from "../middlewares/auth.middleware.js";
import { getAllActivityLogs, getActivityLogById } from "../controllers/activityLogs.controller.js";

const router = Router();

router.get("/", authenticateToken, getAllActivityLogs);
router.get("/:id", authenticateToken, getActivityLogById);

export default router;
