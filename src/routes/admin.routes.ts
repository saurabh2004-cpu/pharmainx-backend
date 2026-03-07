import { signUp, login, logout, getAdminById, editAdmin, deleteAdmin, getAllAdmins } from "../controllers/admin.controller";
import { Router } from "express";
import { authenticateToken } from "../middlewares/auth.middleware";
const router = Router();

router.post("/signup", signUp);
router.post("/login", login);
router.post("/logout", authenticateToken, logout);
router.get("/get-admin/:id", authenticateToken, getAdminById);
router.put("/edit-admin/:id", authenticateToken, editAdmin);
router.delete("/delete-admin/:id", authenticateToken, deleteAdmin);
router.get("/get-all-admins", authenticateToken, getAllAdmins);

export default router;