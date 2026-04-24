import { Link, useNavigate } from 'react-router';
import { Shield, User, LogOut, Crown } from 'lucide-react';
import { Button } from './ui/button';
import { useAuth } from '../context/AuthContext';

export function Header() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <header className="bg-gradient-to-r from-gray-900/90 to-gray-800/90 backdrop-blur-md border-b border-gray-700/50 sticky top-0 z-50">
      <div className="container mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3 group">
            <Shield className="w-8 h-8 text-cyan-400 group-hover:text-cyan-300 transition-colors" />
            <h1 className="text-2xl font-bold bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-500 bg-clip-text text-transparent">
              BitTruth
            </h1>
          </Link>

          {/* User Section */}
          <div className="flex items-center gap-4">
            {user ? (
              <>
                <div className="flex items-center gap-3 bg-gray-800/50 px-4 py-2 rounded-lg border border-gray-700">
                  <User className="w-5 h-5 text-gray-400" />
                  <div className="text-left">
                    <p className="text-sm font-semibold text-white">{user.name}</p>
                    <p className="text-xs text-gray-400 capitalize">{user.subscription} Plan</p>
                    {user.uploadLimit !== null && (
                      <p className="text-[11px] text-orange-300">
                        {user.uploadsRemaining} upload{user.uploadsRemaining === 1 ? '' : 's'} left
                      </p>
                    )}
                  </div>
                </div>
                {user.subscription === 'free' && (
                  <Link to="/subscription">
                    <Button className="bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white">
                      <Crown className="w-4 h-4 mr-2" />
                      Upgrade
                    </Button>
                  </Link>
                )}
                <Button 
                  onClick={handleLogout}
                  variant="ghost" 
                  className="text-gray-300 hover:text-white hover:bg-gray-800"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Logout
                </Button>
              </>
            ) : (
              <>
                <Link to="/login">
                  <Button variant="ghost" className="text-gray-300 hover:text-white hover:bg-gray-800">
                    Login
                  </Button>
                </Link>
                <Link to="/signup">
                  <Button className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white">
                    Sign Up
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
