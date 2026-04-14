import Groq from "groq-sdk";
import { AuthRequest } from "../middleware/auth";
import type { Response } from "express";
import pool from "../db";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

async function askGroq(prompt: string):Promise<string>{
  const response = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [{role: "user", content: prompt}],
    max_tokens: 1024
  });
  return response.choices[0].message.content?.trim() ?? "";
}
export const startInterview = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  const { role, interview_type } = req.body;
  const userId = req.userId;

  if (!userId) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
  if (!role || !interview_type) {
    res.status(400).json({ message: `Role and interview type are required!` });
    return;
  }

  try {
    const session = await pool.query(
      `
      INSERT INTO sessions (user_id, role, interview_type)
      VALUES ($1, $2, $3) RETURNING *
      `,
      [userId, role, interview_type],
    );
    const sessionId = session.rows[0].id;

    const prompt = `You are an expert technical interviewer. Generate 1 interview question for a ${role} position.
    Interview type: ${interview_type}.
    Return ONLY the question, nothing else. No numbering, no intro, just the question.
    `;

    let question = "";

    try {
      const result = await askGroq(prompt);
      question = result;
    } catch {
      question = "Tell me about yourself";
    }

    const savedQuestion = await pool.query(
      `
      INSERT INTO questions (session_id, question_text, order_index)
      VALUES ($1, $2, $3) RETURNING *
      `,
      [sessionId, question, 1],
    );

    res.status(201).json({
      sessionId,
      question: {
        id: savedQuestion.rows[0].id,
        text: question,
        order: 1,
      },
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server error" });
  }
};

export const submitAnswer = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  const {
    sessionId,
    questionId,
    answerText,
    role,
    interview_type,
    questionText,
    questionNumber,
  } = req.body;
  if (
    !sessionId ||
    !questionId ||
    !answerText ||
    !role ||
    !interview_type ||
    !questionText ||
    questionNumber === undefined
  ) {
    res.status(400).json({ message: "All fields are required" });
    return;
  }

  try {
    const feedbackPrompt = `You are an expert interviewer. Evaluate this interview answer.
    Role: ${role}
    Question: ${questionText}
    Answer: ${answerText}

    Give a feedback score out of 10 and brief constructive feedback (2-3 sentences).
    Respond in this format:

    SCORE: [number]
    FEEDBACK: [your feedback]
    `;

    const feedbackResult = await askGroq(feedbackPrompt);
    const feedbackText = feedbackResult;

    const scoreMatch = feedbackText.match(/SCORE:\s*(\d+)/);
    const feedbackMatch = feedbackText.match(/FEEDBACK:\s*(.+)/s);
    const score = scoreMatch ? parseInt(scoreMatch[1]) : 5;
    const feedback = feedbackMatch ? feedbackMatch[1].trim() : feedbackText;

    await pool.query(
      `
      INSERT INTO answers (question_id, answer_text, ai_feedback, score) VALUES ($1, $2, $3, $4)
      `,
      [questionId, answerText, feedback, score],
    );

    if (questionNumber < 5) {
      const nextPrompt = `You are an expert interviewer. Generate 1 interview question for a ${role} position.
      Interview type: ${interview_type}.
      This is question number ${questionNumber + 1} of 5.
      Return ONLY the question, nothing else.
      `;

      let nextQuestion = "";
      try {
        const nextResult = await askGroq(nextPrompt);
        nextQuestion = nextResult;
      } catch {
        nextQuestion = "Explain a challenging project that you worked on.";
      }

      const savedNext = await pool.query(
        `
        INSERT INTO questions (session_id, question_text, order_index) VALUES ($1, $2, $3) RETURNING *
        `,
        [sessionId, nextQuestion, questionNumber + 1],
      );
      res.status(200).json({
        feedback,
        score,
        nextQuestion: {
          id: savedNext.rows[0].id,
          text: nextQuestion,
          order: questionNumber + 1,
        },
      });
    } else {
      const scoresResult = await pool.query(
        `
        SELECT AVG(a.score) as avg_score
        FROM answers a
        JOIN questions q ON a.question_id = q.id
        where q.session_id = $1
        `,
        [sessionId],
      );
      const overallScore = Math.round(scoresResult.rows[0].avg_score);

      await pool.query(
        `
        UPDATE sessions SET overall_score = $1, completed_at = NOW() where id = $2
        `,
        [overallScore, sessionId],
      );
      res.status(200).json({
        feedback,
        score,
        interviewComplete: true,
        overallScore,
      });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

export const getSessions = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  const userId = req.userId;
  if (!userId) {
    res.status(401).json({
      message: "Unauthorized",
    });
    return;
  }

  try {
    const result = await pool.query(
      `
      SELECT * FROM sessions WHERE user_id = $1 ORDER BY completed_at DESC
      `,
      [userId],
    );
    res.status(200).json({ sessions: result.rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

//for details of one session
export const getSessionDetails = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  const { id } = req.params;
  const userId = req.userId;
  if (!userId) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  try {
    const questions = await pool.query(
      `
      SELECT q.*, a.answer_text, a.ai_feedback, a.score
      FROM questions q
      LEFT JOIN answers a ON a.question_id = q.id
      WHERE q.session_id = $1
      ORDER BY q.order_index
      `,
      [id],
    );
    res.status(200).json({ questions: questions.rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};
