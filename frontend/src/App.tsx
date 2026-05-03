import { Routes, Route, Navigate } from 'react-router-dom';
import AuthGuard from './components/AuthGuard';
import GuestGuard from './components/GuestGuard';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Dashboard from './pages/Dashboard';
import Transactions from './pages/Transactions';
import Accounts from './pages/Accounts';
import Investments from './pages/Investments';

export default function App() {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <Routes>
        <Route path="/login" element={<GuestGuard><Login /></GuestGuard>} />
        <Route path="/signup" element={<GuestGuard><Signup /></GuestGuard>} />
        <Route
          path="/*"
          element={
            <AuthGuard>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/transactions" element={<Transactions />} />
                <Route path="/accounts" element={<Accounts />} />
                <Route path="/investments" element={<Investments />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </AuthGuard>
          }
        />
      </Routes>
    </div>
  );
}
