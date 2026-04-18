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
router.get("/sessions", authMiddleware, getSessions);
router.get("/sessions/:id", authMiddleware, getSessionDetails);

export default router;
