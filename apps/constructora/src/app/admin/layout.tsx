import SessionWrapper from '@/components/admin/SessionWrapper';
import AdminShell from '@/components/admin/AdminShell';

export const dynamic = 'force-dynamic';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <SessionWrapper>
      <AdminShell>{children}</AdminShell>
    </SessionWrapper>
  );
}
