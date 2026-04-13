import { Router } from "express";
import { authMiddleware } from "../middleware/auth";
import {
  getSessionDetails,
  getSessions,
  startInterview,
  submitAnswer,
} from "../controllers/interviewController";
const router = Router();

router.post("/start", authMiddleware, startInterview);
router.post("/answer", authMiddleware, submitAnswer);
router.post("/sessions", authMiddleware, getSessions);
router.post("/sessions:id", authMiddleware, getSessionDetails);

export default router;
