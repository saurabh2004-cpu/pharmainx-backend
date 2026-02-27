import { signUp, login, logout } from "../controllers/admin.controller";
import { Router } from "express";
import { authenticateToken } from "../middlewares/auth.middleware";
const router = Router();

router.post("/signup", signUp);
router.post("/login", login);
router.post("/logout", authenticateToken, logout);

export default router;