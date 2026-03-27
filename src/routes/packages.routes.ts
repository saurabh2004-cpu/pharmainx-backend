import { Router } from "express";
import { authenticateToken } from "../middlewares/auth.middleware.js";
import {
    createPackage,
    getAllPackages,
    getPackageById,
    updatePackage,
    deletePackage,

} from "../controllers/packages.controller.js";

const router = Router();

// Public route to view packages (useful for frontend to display options)
router.get("/get-all-packages", getAllPackages);
router.get("/get-package-by-id/:id", getPackageById);

// Protected routes for management (Admins)
router.post("/create-package", authenticateToken, createPackage);
router.put("/update-package/:id", authenticateToken, updatePackage);
router.delete("/delete-package/:id", authenticateToken, deletePackage);

// Protected routes for transactions

export default router;
