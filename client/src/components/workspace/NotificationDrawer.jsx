import React, { useState, useEffect } from 'react';
import { 
  X, 
  Bell, 
  CheckCircle2, 
  AlertTriangle, 
  Info, 
  AlertCircle, 
  Trash2, 
  CheckCheck 
} from 'lucide-react';
import { useLabStore } from '../../store/useLabStore';

export default function NotificationDrawer() {
  const { 
    notifications, 
    notificationDrawerOpen, 
    setNotificationDrawerOpen, 
    markAllNotificationsRead, 
    clearNotifications 
  } = useLabStore();

  const [filter, setFilter] = useState('all'); // 'all' | 'alerts' | 'success'

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && notificationDrawerOpen) {
        setNotificationDrawerOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [notificationDrawerOpen, setNotificationDrawerOpen]);

  if (!notificationDrawerOpen) return null;

  const filteredNotifications = notifications.filter((n) => {
    if (filter === 'alerts') return n.type === 'error' || n.type === 'warning';
    if (filter === 'success') return n.type === 'success';
    return true;
  });

  const getIcon = (type) => {
    switch (type) {
      case 'success':
        return <CheckCircle2 className="w-4 h-4 text-[#3CD5AA] flex-shrink-0" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-[#F3B65E] flex-shrink-0" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-[#FF5C8A] flex-shrink-0" />;
      default:
        return <Info className="w-4 h-4 text-[#46D7F2] flex-shrink-0" />;
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 overflow-hidden bg-black/50 backdrop-blur-sm flex justify-end animate-fadeIn"
      onClick={() => setNotificationDrawerOpen(false)}
      role="dialog"
      aria-modal="true"
      aria-label="Notification History"
    >
      <div 
        className="w-full max-w-md bg-[#0D1422] border-l border-white/10 h-full flex flex-col shadow-2xl animate-slideLeft"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-white/10 flex items-center justify-between bg-[#151E30]/70">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-[#46D7F2]" />
            <h2 className="text-sm font-semibold text-white">Notification History</h2>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-white/10 text-[#9EACC4]">
              {notifications.length}
            </span>
          </div>
          <button
            onClick={() => setNotificationDrawerOpen(false)}
            className="p-1 rounded-md text-[#9EACC4] hover:text-white hover:bg-white/10 transition-colors"
            aria-label="Close notification drawer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Filter & Actions Bar */}
        <div className="p-3 border-b border-white/5 flex items-center justify-between gap-2 bg-[#080D18]/60 text-xs font-mono">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setFilter('all')}
              className={`px-2 py-1 rounded text-[11px] transition-colors ${
                filter === 'all' ? 'bg-[#46D7F2]/20 text-[#46D7F2] font-semibold' : 'text-[#9EACC4] hover:text-white'
              }`}
            >
              All ({notifications.length})
            </button>
            <button
              onClick={() => setFilter('alerts')}
              className={`px-2 py-1 rounded text-[11px] transition-colors ${
                filter === 'alerts' ? 'bg-[#F3B65E]/20 text-[#F3B65E] font-semibold' : 'text-[#9EACC4] hover:text-white'
              }`}
            >
              Alerts
            </button>
            <button
              onClick={() => setFilter('success')}
              className={`px-2 py-1 rounded text-[11px] transition-colors ${
                filter === 'success' ? 'bg-[#3CD5AA]/20 text-[#3CD5AA] font-semibold' : 'text-[#9EACC4] hover:text-white'
              }`}
            >
              Success
            </button>
          </div>

          <div className="flex items-center gap-2">
            {notifications.length > 0 && (
              <>
                <button
                  onClick={markAllNotificationsRead}
                  className="flex items-center gap-1 text-[11px] text-[#9EACC4] hover:text-white transition-colors"
                  title="Mark all as read"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  <span>Read</span>
                </button>
                <button
                  onClick={clearNotifications}
                  className="flex items-center gap-1 text-[11px] text-[#FF5C8A]/80 hover:text-[#FF5C8A] transition-colors"
                  title="Clear all notifications"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Clear</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          {filteredNotifications.length === 0 ? (
            <div className="h-48 flex flex-col items-center justify-center text-center text-[#9EACC4] space-y-2">
              <Bell className="w-8 h-8 text-white/10" />
              <p className="text-xs">No notifications recorded.</p>
              <p className="text-[11px] text-[#9EACC4]/60">Operations, training updates, and alerts appear here.</p>
            </div>
          ) : (
            filteredNotifications.map((notif) => (
              <div
                key={notif.id}
                className={`p-3 rounded-xl border transition-all text-xs flex gap-3 ${
                  notif.read 
                    ? 'bg-[#151E30]/40 border-white/5 opacity-80' 
                    : 'bg-[#151E30] border-white/10 shadow-sm'
                }`}
              >
                <div className="pt-0.5">{getIcon(notif.type)}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="font-semibold text-white truncate">{notif.title}</span>
                    <span className="text-[10px] font-mono text-[#9EACC4]/60 flex-shrink-0">
                      {new Date(notif.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-[#9EACC4] leading-relaxed break-words">{notif.message}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
