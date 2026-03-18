import { Router } from "express";
import { processAudio } from "../controllers/processController.js";
import { verifyAuth } from "../middleware/authMiddleware.js";

const router = Router();

router.post("/process", verifyAuth, upload.single("file"), processAudio);

export default router;

