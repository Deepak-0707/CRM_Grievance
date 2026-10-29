import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';
import { NotificationItem } from '../types';
import {
  ShieldCheck, User as UserIcon, Building2, AlertTriangle, KeyRound,
  FileText, BarChart3, Lock, CheckCircle2, Bell, ShieldAlert, Check,
  LogIn, UserPlus, LogOut, Sparkles
} from 'lucide-react';

interface NavbarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentTab, setCurrentTab }) => {
  const { currentUser, activeRole, logout, openAuthModal, setIsVerificationModalOpen } = useAuth();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [isNotifOpen, setIsNotifOpen] = useState(false);

  const fetchNotifications = async () => {
    if (!currentUser) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }
    try {
      const [list, countRes] = await Promise.all([
        api.getNotifications(),
        api.getUnreadNotificationCount()
      ]);
      setNotifications(list);
      setUnreadCount(countRes.unread_count);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 15000);
    return () => clearInterval(interval);
  }, [currentUser]);

  const handleMarkAsRead = async (id: string) => {
    try {
      await api.markNotificationRead(id);
      fetchNotifications();
    } catch {
      // ignore
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await api.markAllNotificationsRead();
      fetchNotifications();
    } catch {
      // ignore
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'CITIZEN':
        return <span className="text-[10px] bg-teal-500/20 text-teal-300 px-1.5 py-0.5 rounded font-mono">Citizen</span>;
      case 'DEPARTMENT_OFFICER':
        return <span className="text-[10px] bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded font-mono">Officer</span>;
      case 'TRUST_SAFETY_REVIEWER':
        return <span className="text-[10px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded font-mono">Reviewer</span>;
      case 'PRIVACY_OFFICER':
        return <span className="text-[10px] bg-rose-500/20 text-rose-300 px-1.5 py-0.5 rounded font-mono">Privacy Officer</span>;
      case 'ADMINISTRATOR':
        return <span className="text-[10px] bg-purple-500/20 text-purple-300 px-1.5 py-0.5 rounded font-mono">Administrator</span>;
      default:
        return null;
    }
  };

  return (
    <header className="sticky top-0 z-50 bg-slate-950/95 backdrop-blur-md border-b border-slate-800">
      {/* Main Navbar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Identity */}
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => setCurrentTab('home')}>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-teal-600 to-teal-400 flex items-center justify-center shadow-lg shadow-teal-500/20 border border-teal-300/30">
              <ShieldCheck className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-bold tracking-tight text-white">CivicTrust</span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-teal-500/20 text-teal-300 border border-teal-500/30">
                  CiRM
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-mono tracking-tight">Privacy-Preserving Grievance CRM</p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center gap-1">
            <button
              onClick={() => setCurrentTab('home')}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${currentTab === 'home' ? 'bg-slate-800 text-teal-400' : 'text-slate-300 hover:text-white hover:bg-slate-900'
                }`}
            >
              Overview
            </button>

            <button
              onClick={() => setCurrentTab('public')}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${currentTab === 'public' ? 'bg-slate-800 text-teal-400' : 'text-slate-300 hover:text-white hover:bg-slate-900'
                }`}
            >
              Public Registry
            </button>

            {activeRole === 'CITIZEN' && (
              <>
                <button
                  onClick={() => setCurrentTab('citizen')}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${currentTab === 'citizen' ? 'bg-slate-800 text-teal-400' : 'text-slate-300 hover:text-white hover:bg-slate-900'
                    }`}
                >
                  My Complaints
                </button>
                <button
                  onClick={() => setCurrentTab('submit')}
                  className={`px-3.5 py-1.5 rounded-lg text-sm font-semibold transition-all flex items-center gap-1.5 ${currentTab === 'submit'
                      ? 'bg-teal-500 text-slate-950 shadow-md shadow-teal-500/20'
                      : 'bg-teal-600 hover:bg-teal-500 text-white'
                    }`}
                >
                  <FileText className="w-4 h-4" />
                  Lodge Grievance
                </button>
              </>
            )}

            {(activeRole === 'DEPARTMENT_OFFICER' || activeRole === 'ADMINISTRATOR') && (
              <button
                onClick={() => setCurrentTab('crm')}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${currentTab === 'crm' ? 'bg-slate-800 text-teal-400' : 'text-slate-300 hover:text-white hover:bg-slate-900'
                  }`}
              >
                <Building2 className="w-4 h-4 text-blue-400" />
                Officer CRM
              </button>
            )}

            {(activeRole === 'TRUST_SAFETY_REVIEWER' || activeRole === 'ADMINISTRATOR') && (
              <button
                onClick={() => setCurrentTab('trust-safety')}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${currentTab === 'trust-safety' ? 'bg-slate-800 text-teal-400' : 'text-slate-300 hover:text-white hover:bg-slate-900'
                  }`}
              >
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                Trust & Safety
              </button>
            )}

            {activeRole === 'PRIVACY_OFFICER' && (
              <button
                onClick={() => setCurrentTab('disclosure')}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${currentTab === 'disclosure' ? 'bg-slate-800 text-teal-400' : 'text-slate-300 hover:text-white hover:bg-slate-900'
                  }`}
              >
                <KeyRound className="w-4 h-4 text-purple-400" />
                Identity Disclosure
              </button>
            )}

            {activeRole === 'ADMINISTRATOR' && (
              <button
                onClick={() => setCurrentTab('admin')}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${currentTab === 'admin' ? 'bg-slate-800 text-teal-400' : 'text-slate-300 hover:text-white hover:bg-slate-900'
                  }`}
              >
                <BarChart3 className="w-4 h-4 text-indigo-400" />
                Admin Analytics & Audit
              </button>
            )}
          </nav>

          {/* User Status / Auth Controls */}
          <div className="flex items-center gap-3">
            {currentUser && (
              <div className="relative">
                <button
                  onClick={() => setIsNotifOpen(!isNotifOpen)}
                  className="relative p-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
                  title="In-App Notifications"
                >
                  <Bell className="w-4 h-4" />
                  {unreadCount > 0 && (
                    <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center animate-pulse">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </button>

                {isNotifOpen && (
                  <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl p-3 z-50">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                      <div className="flex items-center gap-2">
                        <Bell className="w-4 h-4 text-teal-400" />
                        <span className="text-xs font-semibold text-white">Notifications</span>
                        {unreadCount > 0 && (
                          <span className="text-[10px] bg-teal-500/20 text-teal-300 px-1.5 py-0.5 rounded font-mono">
                            {unreadCount} new
                          </span>
                        )}
                      </div>
                      {unreadCount > 0 && (
                        <button
                          onClick={handleMarkAllRead}
                          className="text-[11px] text-teal-400 hover:text-teal-300 flex items-center gap-1"
                        >
                          <Check className="w-3 h-3" /> Mark all read
                        </button>
                      )}
                    </div>

                    <div className="max-h-80 overflow-y-auto divide-y divide-slate-800/60 my-2">
                      {notifications.length === 0 ? (
                        <div className="text-center py-6 text-xs text-slate-500">
                          No notifications received.
                        </div>
                      ) : (
                        notifications.map((n) => (
                          <div
                            key={n.id}
                            className={`py-2 px-1 text-xs transition-colors rounded ${!n.is_read ? 'bg-slate-800/40 text-slate-200' : 'text-slate-400'
                              }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <span className="font-semibold text-slate-200">{n.title}</span>
                              {!n.is_read && (
                                <button
                                  onClick={() => handleMarkAsRead(n.id)}
                                  className="text-[10px] text-teal-400 hover:underline shrink-0"
                                >
                                  Mark read
                                </button>
                              )}
                            </div>
                            <p className="mt-1 text-slate-300 text-[11px] leading-relaxed">{n.message}</p>
                            <div className="mt-1 text-[10px] text-slate-500 font-mono">
                              {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {currentUser ? (
              <div className="flex items-center gap-2.5">
                {currentUser.role === 'CITIZEN' && (
                  <button
                    onClick={() => setIsVerificationModalOpen(true)}
                    className={`text-xs px-2.5 py-1 rounded-full font-medium flex items-center gap-1.5 border transition-all ${currentUser.is_verified
                        ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/20'
                        : 'bg-amber-500/10 text-amber-300 border-amber-500/30 hover:bg-amber-500/20'
                      }`}
                  >
                    {currentUser.is_verified ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Verified Citizen</span>
                      </>
                    ) : (
                      <>
                        <Lock className="w-3.5 h-3.5 text-amber-400" />
                        <span>Verify Eligibility</span>
                      </>
                    )}
                  </button>
                )}

                <div className="text-right hidden sm:block">
                  <div className="text-xs font-semibold text-slate-200 flex items-center gap-1.5 justify-end">
                    <span>{currentUser.username}</span>
                    {getRoleBadge(currentUser.role)}
                  </div>
                  <div className="text-[10px] font-mono text-teal-400">
                    {currentUser.citizen_pseudonym_id || currentUser.role}
                  </div>
                </div>

                {/* Sign Out Button */}
                <button
                  onClick={logout}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white p-2 rounded-lg transition-colors border border-slate-700/60"
                  title="Sign Out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => openAuthModal('login')}
                  className="text-xs font-semibold text-slate-300 hover:text-white px-3 py-1.5 rounded-lg hover:bg-slate-800 transition-colors flex items-center gap-1.5"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>Sign In</span>
                </button>

                <button
                  onClick={() => openAuthModal('register')}
                  className="bg-gradient-to-r from-teal-500 to-teal-400 hover:from-teal-400 hover:to-teal-300 text-slate-950 font-bold text-xs px-3.5 py-1.5 rounded-lg transition-all shadow-md shadow-teal-500/20 flex items-center gap-1.5"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Register</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
