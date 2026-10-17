import PasswordForm from '../password-form';
import { member } from '../../lib/server/auth';
import { redirect } from 'next/navigation';
export const dynamic = 'force-dynamic';
export default async function Account() {
  try { await member(); } catch { redirect('/'); }
  return <PasswordForm />;
}
