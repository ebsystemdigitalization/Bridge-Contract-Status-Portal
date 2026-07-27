import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { LogOut, Search, Database, Shield, Settings } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Logo } from './Logo';
import { cn } from '../lib/utils';

export const Navbar = () => {
  const { user, profile, isAdmin, logout, loginWithADB2C } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const navItems = [
    { label: 'Search', path: '/', icon: Search, adminOnly: false },
    { label: 'Admin', path: '/admin', icon: Shield, adminOnly: true },
    { label: 'Maintenance', path: '/maintenance', icon: Settings, adminOnly: true },
  ];

  return (
    <nav className="bg-[#001871] border-b border-white/5 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-20">
          <div className="flex items-center gap-10">
            
            <div className="hidden md:flex items-center gap-1">
              {navItems.filter(item => !item.adminOnly || isAdmin).map(item => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={cn(
                    "px-4 py-2 text-sm font-bold rounded-xl transition-all duration-300 flex items-center gap-2 relative group",
                    "hover:text-[#FFE000] hover:bg-[#FFE000]/10 hover:shadow-[0_0_20px_-5px_rgba(255,224,0,0.4)]",
                    location.pathname === item.path
                      ? "text-white bg-white/20 shadow-[0_0_15px_-5px_rgba(255,255,255,0.3)]"
                      : "text-slate-300"
                  )}
                >
                  <item.icon className={cn(
                    "w-4 h-4 transition-transform duration-300 group-hover:scale-110",
                    location.pathname === item.path ? "text-white group-hover:text-[#FFE000]" : "group-hover:text-[#FFE000]"
                  )} />
                  {item.label}
                  
                  {/* Modern Underline Glow Effect */}
                  <div className={cn(
                    "absolute bottom-[2px] left-4 right-4 h-[2px] bg-[#FFE000] transition-all duration-300 rounded-full shadow-[0_0_10px_#FFE000]",
                    location.pathname === item.path 
                      ? "scale-x-100 opacity-100" 
                      : "scale-x-0 opacity-0 group-hover:scale-x-100 group-hover:opacity-100"
                  )} />
                </Link>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="hidden sm:flex flex-col items-end">
              <span className="text-sm font-black text-white">{user?.displayName || profile?.username}</span>
              <span className="text-[10px] font-black uppercase tracking-widest text-cd-cyan">{profile?.role} Level</span>
            </div>

            <button
              onClick={handleLogout}
              className="p-3 text-slate-400 hover:text-rose-400 hover:bg-white/10 rounded-xl transition-all"
              title="Logout"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
};
