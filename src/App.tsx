import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { ForgotPassword } from './pages/ForgotPassword';
import { Landing } from './pages/Landing';
import { Dashboard } from './pages/Dashboard';
import { Patients } from './pages/Patients';
import { PatientProfile } from './pages/PatientProfile';
import { Schedule } from './pages/Schedule';
import { Settings } from './pages/Settings';
import { Financial } from './pages/Financial';
import { AdminDashboard } from './pages/AdminDashboard';
import { PatientAccess } from './pages/PatientAccess';
import { SubscriptionSuccess } from './pages/SubscriptionSuccess';
import { MealPlanEdit } from './pages/MealPlanEdit';
import { Privacidade } from './pages/Privacidade';
import { Termos } from './pages/Termos';
import { Cookies } from './pages/Cookies';
import { Contato } from './pages/Contato';
import { Toaster } from './components/ui/sonner';
import { TooltipProvider } from './components/ui/tooltip';
import { ThemeProvider } from './components/theme-provider';
import { InactivityWarningModal } from './components/InactivityWarningModal';
import { TutorialProvider } from './contexts/TutorialContext';
import { TutorialModal } from './components/TutorialModal';
import { CookieConsentProvider } from './contexts/CookieConsentContext';
import { CookieConsentBanner } from './components/CookieConsentBanner';

export default function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <CookieConsentProvider>
      <AuthProvider>
        <TutorialProvider>
        <TooltipProvider>
            <InactivityWarningModal />
            <TutorialModal />
            <BrowserRouter>
              <Routes>
                <Route path="/" element={<Landing />} />
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/subscription-success" element={<SubscriptionSuccess />} />
                <Route path="/patient-access/:id" element={<PatientAccess />} />
                <Route path="/privacidade" element={<Privacidade />} />
                <Route path="/termos" element={<Termos />} />
                <Route path="/cookies" element={<Cookies />} />
                <Route path="/contato" element={<Contato />} />

                <Route element={<Layout />}>
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/patients" element={<Patients />} />
                  <Route path="/patients/:id" element={<PatientProfile />} />
                  <Route path="/patients/:patientId/meal-plan/:planId" element={<MealPlanEdit />} />
                  <Route path="/schedule" element={<Schedule />} />
                  <Route path="/financial" element={<Financial />} />
                  <Route path="/settings" element={<Settings />} />
                  <Route path="/admin" element={<AdminDashboard />} />
                </Route>

                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
              <CookieConsentBanner />
              <Toaster position="top-right" />
            </BrowserRouter>
        </TooltipProvider>
        </TutorialProvider>
      </AuthProvider>
      </CookieConsentProvider>
    </ThemeProvider>
  );
}
