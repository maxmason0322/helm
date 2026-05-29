import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Landmark, ArrowLeftRight, TrendingUp, Activity, LogOut } from 'lucide-react';
import { signOut, useSession } from '../auth';

interface NavItem {
  to: string;
  label: string;
  icon: React.ElementType;
}

const navItems: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/accounts', label: 'Accounts', icon: Landmark },
  { to: '/transactions', label: 'Transactions', icon: ArrowLeftRight },
  { to: '/investments', label: 'Investments', icon: TrendingUp },
  { to: '/activity', label: 'Activity Log', icon: Activity },
];

const focusRing = 'focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950';

function SidebarLink({ to, label, icon: Icon }: NavItem) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      className={({ isActive }) =>
        `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${focusRing} ${
          isActive
            ? 'bg-emerald-600/10 text-emerald-400'
            : 'text-neutral-400 hover:bg-neutral-800 hover:text-white'
        }`
      }
    >
      <Icon size={18} />
      <span>{label}</span>
    </NavLink>
  );
}

function MobileNavLink({ to, label, icon: Icon }: NavItem) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      className={({ isActive }) =>
        `flex min-h-[48px] min-w-[48px] flex-col items-center justify-center gap-1 text-xs transition-colors ${focusRing} rounded-lg ${
          isActive ? 'text-emerald-400' : 'text-neutral-500'
        }`
      }
    >
      <Icon size={20} />
      <span>{label}</span>
    </NavLink>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const navigate = useNavigate();
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await signOut();
      navigate('/login');
    } catch {
      setSigningOut(false);
    }
  }

  return (
    <div className="flex min-h-screen bg-neutral-950">
      {/* Desktop sidebar */}
      <aside aria-label="Sidebar" className="hidden w-60 flex-col border-r border-neutral-800 bg-neutral-950 p-4 md:flex">
        <div className="mb-8 px-3">
          <h1 className="text-xl font-bold text-white">Helm</h1>
        </div>

        <nav aria-label="Main navigation" className="flex-1 space-y-1">
          {navItems.map(item => (
            <SidebarLink key={item.to} {...item} />
          ))}
        </nav>

        <div className="border-t border-neutral-800 pt-4">
          <div className="mb-3 px-3">
            <p className="truncate text-sm font-medium text-white">
              {session?.user?.name || 'User'}
            </p>
            <p className="truncate text-xs text-neutral-500">
              {session?.user?.email}
            </p>
          </div>
          <button
            onClick={handleSignOut}
            disabled={signingOut}
            className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-neutral-400 transition-colors hover:bg-neutral-800 hover:text-white disabled:opacity-50 ${focusRing}`}
          >
            <LogOut size={18} />
            <span>{signingOut ? 'Signing out...' : 'Sign out'}</span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col pb-20 md:pb-0">
        {/* Mobile header */}
        <header className="flex items-center justify-between border-b border-neutral-800 px-4 py-3 md:hidden">
          <h1 className="text-lg font-bold text-white">Helm</h1>
          <div className="flex items-center gap-3">
            <span className="text-sm text-neutral-400">{session?.user?.name}</span>
            <button
              onClick={handleSignOut}
              disabled={signingOut}
              className={`text-neutral-400 transition-colors hover:text-white disabled:opacity-50 ${focusRing} rounded-lg p-1`}
              aria-label="Sign out"
            >
              <LogOut size={20} />
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {children}
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav
        aria-label="Tab bar"
        className="fixed inset-x-0 bottom-0 flex items-center justify-around border-t border-neutral-800 bg-neutral-950 py-1 pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        {navItems.map(item => (
          <MobileNavLink key={item.to} {...item} />
        ))}
      </nav>
    </div>
  );
}
