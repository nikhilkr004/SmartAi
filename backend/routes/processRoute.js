import { Router } from "express";
import { processAudio } from "../controllers/processController.js";
import { verifyAuth } from "../middleware/authMiddleware.js";
import upload from "../config/multer.js";

const router = Router();

router.post("/process", verifyAuth, processAudio);

export default router;

