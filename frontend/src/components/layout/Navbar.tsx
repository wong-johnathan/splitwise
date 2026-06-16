import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <nav className="border-b bg-white sticky top-0 z-10 safe-top">
      <div className="max-w-5xl mx-auto px-3 sm:px-4 h-12 sm:h-14 flex items-center justify-between">
        <div
          className="text-base sm:text-lg font-bold cursor-pointer"
          onClick={() => navigate('/dashboard')}
        >
          SplitEasy
        </div>
        <div className="flex items-center gap-2 sm:gap-4 min-w-0">
          <span className="text-xs sm:text-sm text-gray-600 truncate max-w-[120px] sm:max-w-[200px]">
            {user?.name}
          </span>
          <Button variant="outline" size="sm" className="text-xs h-8 px-2 sm:px-3" onClick={logout}>
            Sign Out
          </Button>
        </div>
      </div>
    </nav>
  );
}
