import type { Request, Response } from "express";
import pool from "../db/index";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

export const register = async (req: Request, res: Response): Promise<void> => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    res.status(400).json({ message: "All fields are required" });
    return;
  }
  const trimmedEmail = email.trim().toLowerCase();
  const trimmedName = name.trim();

  if (password.length < 6) {
    res
      .status(400)
      .json({ message: "Password must be at least 6 characters long." });
    return;
  }

  try {
    const existing = await pool.query(
      `
      SELECT id FROM users WHERE email = $1
    `,
      [trimmedEmail],
    );
    if (existing.rows.length > 0) {
      res.status(400).json({ message: "Email already in use " });
      return;
    }
    const hashed = await bcrypt.hash(password, 10);
    const result = await pool.query(
      `
      INSERT INTO users (name, email, password) 
        VALUES ($1, $2, $3) 
        RETURNING 
        id, name, email
      `,
      [trimmedName, trimmedEmail, hashed],
    );
    const user = result.rows[0];
    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET as string,
      { expiresIn: "7d" },
    );
    res.status(201).json({ token, user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400).json({ message: "All fields are required!" });
    return;
  }
  const trimmedEmail = email.trim().toLowerCase();

  try {
    const result = await pool.query(
      `
      SELECT * FROM users WHERE email = $1
      `,
      [trimmedEmail],
    );
    if (result.rows.length === 0) {
      res.status(400).json({ message: "Invalid credentials" });
      return;
    }

    const user = result.rows[0];
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      res.status(400).json({ message: "Invalid credentials" });
      return;
    }
    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET as string,
      { expiresIn: "7d" },
    );
    res.status(200).json({
      token,
      user: { id: user.id, name: user.name, email: user.email },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};
