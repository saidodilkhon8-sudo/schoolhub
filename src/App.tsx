import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { LanguageProvider } from './contexts/LanguageContext';
import { ToastProvider } from './contexts/ToastContext';
import { NotificationProvider, useNotifications } from './contexts/NotificationContext';
import { SupabaseSetupBanner } from './components/SupabaseSetupBanner';
import { MobileNavigation, DesktopSidebar, NavTab } from './components/Navigation';
import { Header } from './components/Header';
import { NotificationCenter } from './components/NotificationCenter';
import { RealtimeAlertBanner } from './components/RealtimeAlertBanner';
import { AuthPage } from './pages/AuthPage';
import { OnboardingPage } from './pages/OnboardingPage';
import { DashboardPage } from './pages/DashboardPage';
import { SchedulePage } from './pages/SchedulePage';
import { HomeworkPage } from './pages/HomeworkPage';
import { GradesPage } from './pages/GradesPage';
import { ClassPage } from './pages/ClassPage';
import { ProfilePage } from './pages/ProfilePage';
import { AdminPage } from './pages/AdminPage';
import { Sparkles } from 'lucide-react';

function AppContent() {
  const { user, profile, loading } = useAuth();
  const [currentTab, setCurrentTab] = useState<NavTab>('dashboard');
  const { registerNavigationHandler } = useNotifications();

  useEffect(() => {
    return registerNavigationHandler(setCurrentTab);
  }, [registerNavigationHandler]);

  // Loading indicator on initial session check
  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-xl shadow-blue-500/20 mb-3 animate-pulse">
          <Sparkles className="w-6 h-6" />
        </div>
        <div className="w-32 h-1 bg-zinc-800 rounded-full overflow-hidden">
          <div className="w-full h-full bg-blue-500 animate-[indeterminate_1.5s_infinite_linear]" />
        </div>
      </div>
    );
  }

  // Not authenticated
  if (!user) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
        <SupabaseSetupBanner />
        <AuthPage />
      </div>
    );
  }

  // Needs onboarding (name or grade not set)
  const needsOnboarding = !profile || !profile.first_name || !profile.grade;
  if (needsOnboarding) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
        <SupabaseSetupBanner />
        <OnboardingPage />
      </div>
    );
  }

  // Main application view
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex">
      {/* Desktop Sidebar */}
      <DesktopSidebar currentTab={currentTab} onTabChange={setCurrentTab} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <SupabaseSetupBanner />
        <Header
          onOpenProfile={() => setCurrentTab('profile')}
          onOpenAdmin={() => setCurrentTab('admin')}
        />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {currentTab === 'dashboard' && <DashboardPage onNavigate={setCurrentTab} />}
          {currentTab === 'schedule' && <SchedulePage />}
          {currentTab === 'homework' && <HomeworkPage />}
          {currentTab === 'grades' && <GradesPage onNavigate={setCurrentTab} />}
          {currentTab === 'class' && <ClassPage />}
          {currentTab === 'profile' && <ProfilePage />}
          {currentTab === 'admin' && <AdminPage onNavigateHome={() => setCurrentTab('dashboard')} />}
        </main>
      </div>

      {/* Real-time Alerts and Notification Center */}
      <RealtimeAlertBanner />
      <NotificationCenter />

      {/* Mobile Bottom Navigation */}
      <MobileNavigation currentTab={currentTab} onTabChange={setCurrentTab} />
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <ToastProvider>
          <AuthProvider>
            <NotificationProvider>
              <AppContent />
            </NotificationProvider>
          </AuthProvider>
        </ToastProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}
