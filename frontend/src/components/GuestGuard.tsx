import { Navigate } from 'react-router-dom';
import { useSession } from '../auth';

export default function GuestGuard({ children }: { children: React.ReactNode }) {
  const { data: session, isPending } = useSession();

  if (isPending) return null;
  if (session) return <Navigate to="/" replace />;

  return <>{children}</>;
}
