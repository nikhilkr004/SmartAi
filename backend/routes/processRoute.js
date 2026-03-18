import { Router } from "express";
import { processAudio } from "../controllers/processController.js";
import { upload } from "../utils/uploadHelper.js";

const router = Router();

router.post("/process", upload.single("file"), processAudio);

export default router;

