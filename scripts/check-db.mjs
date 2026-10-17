import assert from 'node:assert/strict';
import { neon } from '@neondatabase/serverless';
const sql = neon(process.env.DATABASE_URL);
try {
  const [current] = await sql`SELECT version, body->>'schema' AS schema FROM wedding.workspace WHERE id = 'our-wedding'`;
  assert.equal(current.schema, '1');
  // Test conditional version updates on an isolated, automatically dropped TEMP table.
  const result = await sql.transaction([
    sql`CREATE TEMP TABLE wedding_cas_probe(version integer NOT NULL) ON COMMIT DROP`,
    sql`INSERT INTO wedding_cas_probe VALUES (0)`,
    sql`UPDATE wedding_cas_probe SET version = version + 1 WHERE version = 0 RETURNING version`,
    sql`UPDATE wedding_cas_probe SET version = version + 1 WHERE version = 0 RETURNING version`,
  ]);
  assert.equal(result[2][0].version, 1); assert.equal(result[3].length, 0);
  const [tables] = await sql`SELECT to_regclass('wedding.push_jobs')::text AS jobs, to_regclass('wedding.changes')::text AS changes`;
  assert.ok(tables.jobs && tables.changes);
  console.log('DB 스키마·버전 조건 갱신 확인. 실제 공동 기록은 수정하지 않았어요.');
} catch { console.error('DB 검증 실패. 연결 설정과 마이그레이션을 확인해 주세요.'); process.exitCode = 1; }
