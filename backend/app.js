const express = require('express');
const { Pool } = require('pg');

const app = express();
app.use(express.json());

const pool = new Pool({
  host: process.env.DB_HOST || 'doku-db',
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER || 'doku',
  password: process.env.DB_PASSWORD || 'doku1234',
  database: process.env.DB_NAME || 'doku',
});

// DB 초기화 - todos 테이블 없으면 생성
async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS todos (
      id SERIAL PRIMARY KEY,
      text TEXT NOT NULL,
      done BOOLEAN DEFAULT false,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  console.log('DB 초기화 완료');
}

// 헬스체크
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// 전체 조회
app.get('/todos', async (req, res) => {
  const result = await pool.query('SELECT * FROM todos ORDER BY created_at ASC');
  res.json(result.rows);
});

// 추가
app.post('/todos', async (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'text는 필수예요!' });
  const result = await pool.query(
    'INSERT INTO todos (text) VALUES ($1) RETURNING *',
    [text]
  );
  res.status(201).json(result.rows[0]);
});

// 완료 토글
app.patch('/todos/:id/toggle', async (req, res) => {
  const { id } = req.params;
  const result = await pool.query(
    'UPDATE todos SET done = NOT done WHERE id = $1 RETURNING *',
    [id]
  );
  res.json(result.rows[0]);
});

// 삭제
app.delete('/todos/:id', async (req, res) => {
  const { id } = req.params;
  await pool.query('DELETE FROM todos WHERE id = $1', [id]);
  res.status(204).end();
});

const PORT = process.env.PORT || 4000;

async function startWithRetry(retries = 10, delay = 3000) {
  for (let i = 1; i <= retries; i++) {
    try {
      await initDB();
      app.listen(PORT, () => console.log(`백엔드 서버 실행 중 (포트 ${PORT})`));
      return;
    } catch (err) {
      console.error(`DB 연결 시도 ${i}/${retries} 실패:`, err.message);
      if (i === retries) {
        console.error('DB 연결 최대 재시도 초과. 종료합니다.');
        process.exit(1);
      }
      console.log(`${delay / 1000}초 후 재시도...`);
      await new Promise(res => setTimeout(res, delay));
    }
  }
}

startWithRetry();
