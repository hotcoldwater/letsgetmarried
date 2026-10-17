import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { neon } from '@neondatabase/serverless';
import { initialState } from '../lib/domain.mjs';
import { digest, tokenValid } from '../lib/auth-core.mjs';
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL을 .env.local에 입력해 주세요.');
const sql = neon(process.env.DATABASE_URL);
try {
  await sql`CREATE SCHEMA IF NOT EXISTS wedding`;
  await sql`CREATE TABLE IF NOT EXISTS wedding.migrations (name text PRIMARY KEY, hash text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())`;
  for (const name of (await readdir(new URL('../db/', import.meta.url))).filter(f => f.endsWith('.sql')).sort()) {
    const source = await readFile(new URL('../db/' + name, import.meta.url), 'utf8');
    const hash = createHash('sha256').update(source).digest('hex');
    const [existing] = await sql`SELECT hash FROM wedding.migrations WHERE name = ${name}`;
    if (existing) { if (existing.hash !== hash) throw new Error('기존 마이그레이션과 파일이 달라요: ' + name); console.log('유지:', name); continue; }
    // These migration files contain plain DDL, no procedural blocks or quoted semicolons.
    const statements = source.replace(/^\s*--.*$/gm, '').split(';').map(s => s.trim()).filter(Boolean);
    await sql.transaction([...statements.map(s => sql.query(s)), sql`INSERT INTO wedding.migrations(name, hash) VALUES (${name}, ${hash})`]);
    console.log('적용:', name);
  }
  await sql`INSERT INTO wedding.workspace(id, body) VALUES ('our-wedding', ${JSON.stringify(initialState())}::jsonb) ON CONFLICT(id) DO NOTHING`;
  for (const [role, name] of [['groom', 'GROOM_SETUP_TOKEN'], ['bride', 'BRIDE_SETUP_TOKEN']]) {
    const token = process.env[name];
    if (!tokenValid(token)) throw new Error('SETUP_TOKEN_REQUIRED');
    await sql`INSERT INTO wedding.account_invites(role, token_hash) SELECT role, ${digest(token)} FROM wedding.accounts
      WHERE role = ${role} AND password_hash IS NULL ON CONFLICT(role) DO NOTHING`;
  }
  await sql`DELETE FROM wedding.sessions WHERE expires_at < now()`;
  await sql`DELETE FROM wedding.auth_attempts WHERE expires_at < now()`;
  console.log('초기화 완료. 기존 공동 기록은 덮어쓰지 않았어요.');
} catch (error) { console.error('DB 초기화 실패. 연결 주소·권한·db/ 파일을 확인해 주세요.'); console.error('오류 종류:', error.name); process.exitCode = 1; }
