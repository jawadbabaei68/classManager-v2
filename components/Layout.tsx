import React, { useState } from 'react';
import { useLocation, Link, useNavigate } from 'react-router-dom';
import { Menu, X, LogOut, ChevronRight } from 'lucide-react';
import { APP_NAME, MENU_ITEMS } from '../constants';
import { getSupabase } from '../services/supabaseClient';

interface LayoutProps {
  children: React.ReactNode;
  userRole?: string | null;
}

const Layout: React.FC<LayoutProps> = ({ children, userRole }) => {
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const supabase = getSupabase();

  const handleLogout = async () => {
    if (supabase) {
      await supabase.auth.signOut();
      navigate('/login');
    }
  };

  // Filter menu items based on role
  const filteredMenu = MENU_ITEMS.filter(item => 
    !userRole || item.roles.includes(userRole)
  );

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* Mobile Header */}
      <header className="bg-white shadow-sm p-4 sticky top-0 z-20 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setSidebarOpen(true)}
            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            <Menu size={24} />
          </button>
          <h1 className="text-xl font-bold text-gray-800">{APP_NAME}</h1>
        </div>
        <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold">
          {userRole ? userRole[0].toUpperCase() : 'U'}
        </div>
      </header>

      {/* Sidebar / Drawer */}
      {isSidebarOpen && (
        <div className="fixed inset-0 z-30 flex">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
          
          {/* Drawer Content */}
          <div className="relative w-[80%] max-w-xs bg-white h-full shadow-2xl flex flex-col">
            <div className="p-5 border-b flex items-center justify-between">
              <span className="font-bold text-lg text-gray-700">منوی کاربری</span>
              <button onClick={() => setSidebarOpen(false)} className="text-gray-500">
                <X size={24} />
              </button>
            </div>
            
            <nav className="flex-1 overflow-y-auto p-4 space-y-2">
              {filteredMenu.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname.startsWith(item.path);
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setSidebarOpen(false)}
                    className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${
                      isActive 
                        ? 'bg-blue-50 text-blue-600 font-bold' 
                        : 'text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <Icon size={20} />
                    <span>{item.label}</span>
                    {isActive && <ChevronRight className="mr-auto" size={16} />}
                  </Link>
                );
              })}
            </nav>

            <div className="p-4 border-t">
              <button 
                onClick={handleLogout}
                className="flex items-center gap-2 w-full p-3 text-red-600 hover:bg-red-50 rounded-xl"
              >
                <LogOut size={20} />
                <span>خروج از حساب</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 p-4 pb-20">
        {children}
      </main>
    </div>
  );
};

export default Layout;