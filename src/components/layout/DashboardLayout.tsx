'use client';

import { ReactNode, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Menu, 
  X, 
  User, 
  LogOut, 
  Bell, 
  ChevronRight,
  LayoutDashboard,
  ShieldCheck,
  Briefcase,
  FileText
} from 'lucide-react';

interface SidebarItem {
  label: string;
  icon: any;
  active?: boolean;
  onClick?: () => void;
}

interface DashboardLayoutProps {
  children: ReactNode;
  sidebarItems: SidebarItem[];
  userProfile?: {
    name: string;
    role: string;
  };
  title: string;
  onLogout?: () => void;
}

export default function DashboardLayout({
  children,
  sidebarItems,
  userProfile,
  title,
  onLogout
}: DashboardLayoutProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar Desktop */}
      <aside className="hidden lg:flex flex-col w-64 bg-slate-900 text-white fixed h-full z-50 shadow-2xl">
        <div className="p-6 flex items-center gap-3 border-b border-slate-800">
          <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center font-black text-xl">C</div>
          <span className="font-black tracking-tighter text-xl uppercase">CECANI</span>
        </div>
        
        <nav className="flex-1 py-6 space-y-1 overflow-y-auto">
          {sidebarItems.map((item, idx) => (
            <div 
              key={idx} 
              onClick={item.onClick}
              className={`sidebar-item ${item.active ? 'sidebar-item-active text-white' : 'text-slate-400'}`}
            >
              <item.icon size={20} />
              <span className="font-bold text-sm">{item.label}</span>
              {item.active && <ChevronRight size={14} className="ml-auto" />}
            </div>
          ))}
        </nav>

        {userProfile && (
          <div className="p-6 border-t border-slate-800 bg-slate-900/50">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-slate-800 rounded-full flex items-center justify-center text-slate-400">
                <User size={20} />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-bold truncate">{userProfile.name}</span>
                <span className="text-[10px] uppercase font-black tracking-widest text-slate-500">{userProfile.role}</span>
              </div>
            </div>
            <button 
              onClick={onLogout}
              className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-slate-800 hover:bg-red-500/10 hover:text-red-400 rounded-lg transition-all text-xs font-bold text-slate-400"
            >
              <LogOut size={14} /> Cerrar Sesión
            </button>
          </div>
        )}
      </aside>

      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSidebarOpen(false)}
              className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[60] lg:hidden"
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 left-0 w-72 bg-slate-900 text-white z-[70] shadow-2xl lg:hidden"
            >
              <div className="p-6 flex items-center justify-between border-b border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center font-black text-xl">C</div>
                  <span className="font-black tracking-tighter text-xl uppercase">CECANI</span>
                </div>
                <button onClick={() => setIsSidebarOpen(false)} className="text-slate-400 hover:text-white transition-colors">
                  <X size={24} />
                </button>
              </div>
              <nav className="flex-1 py-8 px-4 space-y-2">
                {sidebarItems.map((item, idx) => (
                  <div 
                    key={idx} 
                    onClick={() => { item.onClick?.(); setIsSidebarOpen(false); }}
                    className={`sidebar-item mx-0 ${item.active ? 'sidebar-item-active' : ''}`}
                  >
                    <item.icon size={20} />
                    <span className="font-bold">{item.label}</span>
                  </div>
                ))}
              </nav>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main Content Area */}
      <div className="flex-1 lg:ml-64 flex flex-col min-h-screen">
        {/* Top Header */}
        <header className="sticky top-0 z-40 bg-white border-b border-slate-100 shadow-sm h-16 flex items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="lg:hidden p-2 text-slate-500 hover:bg-slate-50 rounded-lg transition-colors"
            >
              <Menu size={24} />
            </button>
            <h2 className="text-lg font-bold text-slate-800 hidden md:block">{title}</h2>
          </div>

          <div className="flex items-center gap-4">
            <button className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-all relative">
              <Bell size={20} />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
            </button>
            <div className="h-8 w-px bg-slate-100 mx-2 hidden sm:block"></div>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 border border-slate-200">
                <User size={18} />
              </div>
              <span className="text-sm font-bold text-slate-700 hidden sm:block">{userProfile?.name.split(' ')[0]}</span>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-6 lg:p-10 max-w-7xl w-full mx-auto">
          {children}
        </main>

        <footer className="p-6 text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest border-t border-slate-100 bg-white">
          &copy; {new Date().getFullYear()} CECANI LEGAL &bull; Portal Corporativo
        </footer>
      </div>
    </div>
  );
}
