import Brand from './brand';
import Planner from './planner';
import { missingConfig } from '../lib/server/config';
export const dynamic = 'force-dynamic';
export default function Home() {
  const missing = missingConfig();
  if (missing.length) return <main className="setup-page surface"><Brand welcome /><h1>두 사람의 공간을 준비하고 있어요</h1><p>연결 설정을 마치면 두 분의 계정으로 시작할 수 있어요.</p><p>잠시 후 다시 방문해 주세요.</p></main>;
  return <Planner />;
}
