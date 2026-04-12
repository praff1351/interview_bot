import dotenv from "dotenv";
import { Pool } from "pg";
dotenv.config();

const pool = new Pool({
  user: "postgres",
  host: "localhost",
  database: "interview_prep",
  password: process.env.PASSWORD,
  port: 5432,
});

pool
  .connect()
  .then(() => console.log("Connected to PostgreSql"))
  .catch((err) => console.error("DB connection error: ", err));

export default pool;
