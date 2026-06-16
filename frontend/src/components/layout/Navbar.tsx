import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <nav className="border-b bg-white sticky top-0 z-10">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
        <div
          className="text-lg font-bold cursor-pointer"
          onClick={() => navigate('/dashboard')}
        >
          SplitEasy
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600">{user?.name}</span>
          <Button variant="outline" size="sm" onClick={logout}>
            Sign Out
          </Button>
        </div>
      </div>
    </nav>
  );
}
