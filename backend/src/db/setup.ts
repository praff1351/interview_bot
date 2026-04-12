import dotenv from "dotenv";
import { Client } from "pg";

dotenv.config();

async function setup() {
  // connect kar raha hu to the postgres db:
  const client = new Client({
    user: "postgres",
    host: "localhost",
    database: "postgres",
    password: process.env.PASSWORD,
    port: 5432,
  });
  await client.connect();
  console.log(`Connected to the database `);

  //database create krte hai only if it does not already exist:

  const res = await client.query(`
    SELECT 1 FROM pg_database WHERE datname = 'interview_prep'
    `);
  if (res.rowCount === 0) {
    await client.query(`
        CREATE DATABASE interview_prep
        `);
    console.log(`Database created`);
  } else {
    console.log("Database already exists, skipping this step");
  }
  await client.end();

  //naye db se connect krke tables create krte hai ab:
  const appClient = new Client({
    user: "postgres",
    host: "localhost",
    database: "interview_prep",
    password: process.env.PASSWORD,
    port: 5432,
  });
  await appClient.connect();
  console.log(`Connected to interview_prep`);

  await appClient.query(`
    CREATE TABLE users(
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(100) NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE sessions(
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES users(id) on DELETE CASCADE,
      role VARCHAR(100) NOT NULL,
      interview_type VARCHAR(50) NOT NULL,
      overall_score INTEGER,
      completed_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE questions(
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      session_id UUID REFERENCES sessions(id) on DELETE CASCADE,
      question_text TEXT NOT NULL,
      order_index INTEGER NOT NULL
    );

    CREATE TABLE answers(
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      question_id UUID REFERENCES questions(id) on DELETE CASCADE,
      answer_text TEXT NOT NULL,
      ai_feedback TEXT,
      score INTEGER,
      created_at TIMESTAMP DEFAULT NOW()
    );
    `);
  console.log("All tables created");
  await appClient.end();
}

setup().catch((err) => {
  console.error("Error:", err);
});
