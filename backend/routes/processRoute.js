import { Router } from "express";
import { processAudio } from "../controllers/processController.js";

const router = Router();

router.post("/process", processAudio);

export default router;

