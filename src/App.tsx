import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { Layout } from './components/Layout';
import { PageLoader } from './components/PageLoader';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { ForgotPassword } from './pages/ForgotPassword';
import { ResetPassword } from './pages/ResetPassword';
import { Landing } from './pages/Landing';
import { PatientAccess } from './pages/PatientAccess';
import { SubscriptionSuccess } from './pages/SubscriptionSuccess';
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

const Dashboard = lazy(() => import('./pages/Dashboard').then(m => ({ default: m.Dashboard })));
const Patients = lazy(() => import('./pages/Patients').then(m => ({ default: m.Patients })));
const PatientProfile = lazy(() => import('./pages/PatientProfile').then(m => ({ default: m.PatientProfile })));
const MealPlanEdit = lazy(() => import('./pages/MealPlanEdit').then(m => ({ default: m.MealPlanEdit })));
const Schedule = lazy(() => import('./pages/Schedule').then(m => ({ default: m.Schedule })));
const Financial = lazy(() => import('./pages/Financial').then(m => ({ default: m.Financial })));
const Settings = lazy(() => import('./pages/Settings').then(m => ({ default: m.Settings })));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard').then(m => ({ default: m.AdminDashboard })));
const Recipes = lazy(() => import('./pages/Recipes').then(m => ({ default: m.Recipes })));

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
                <Route path="/reset-password" element={<ResetPassword />} />
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
                  <Route path="/recipes" element={<Recipes />} />
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
