import {
    createInstituteVerification,
    getInstituteVerification,
    approveInstituteVerification,
    rejectInstituteVerification,
    getAllInstituteVerifications
} from "../controllers/instituteVerification.controller.js";
import { Router } from "express";
import { upload } from '../middlewares/upload.js';
import { authenticateToken } from '../middlewares/auth.middleware.js';

const router = Router();

router.post("/create-verification",
    authenticateToken,
    upload.single("registrationCertificate"),
    createInstituteVerification
);

router.get("/get-verification/:instituteId", authenticateToken, getInstituteVerification);
router.put("/approve-verification/:instituteId", authenticateToken, approveInstituteVerification);
router.put("/reject-verification/:instituteId", authenticateToken, rejectInstituteVerification);
router.get("/get-all-verifications", authenticateToken, getAllInstituteVerifications);

export default router;