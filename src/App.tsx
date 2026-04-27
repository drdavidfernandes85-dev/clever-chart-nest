import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { LanguageProvider } from "@/i18n/LanguageContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { QuickTradeProvider } from "@/contexts/QuickTradeContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import AdminRoute from "@/components/AdminRoute";
import EligibilityGate from "@/components/EligibilityGate";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import PageTransition from "@/components/PageTransition";
import RouteOverlayLoader from "@/components/RouteOverlayLoader";
import MobileBottomNav from "@/components/MobileBottomNav";
import OnboardingTour from "@/components/onboarding/OnboardingTour";
import FloatingJoinLive from "@/components/webinars/FloatingJoinLive";
import CyberpunkBackground from "@/components/CyberpunkBackground";
import Index from "./pages/Index.tsx";

// Retry dynamic imports with backoff before giving up. Handles stale Vite
// transform URLs (?t=...) and post-deploy chunk misses without nuking session.
const lazyWithRetry = <T,>(factory: () => Promise<{ default: React.ComponentType<T> }>) =>
  lazy(async () => {
    const reloadKey = "lovable:chunk-reloaded";
    const attempt = async (n: number): Promise<{ default: React.ComponentType<T> }> => {
      try {
        const mod = await factory();
        sessionStorage.removeItem(reloadKey);
        return mod;
      } catch (err) {
        if (n < 3) {
          await new Promise((r) => setTimeout(r, 250 * (n + 1)));
          return attempt(n + 1);
        }
        if (!sessionStorage.getItem(reloadKey)) {
          sessionStorage.setItem(reloadKey, "1");
          window.location.reload();
          return new Promise(() => {}) as never;
        }
        throw err;
      }
    };
    return attempt(0);
  });

// Code-split heavier authenticated routes
const Dashboard = lazyWithRetry(() => import("./pages/Dashboard.tsx"));
const CommandDeck = lazyWithRetry(() => import("./pages/CommandDeck.tsx"));
const LiveChart = lazyWithRetry(() => import("./pages/LiveChart.tsx"));
const Chatroom = lazyWithRetry(() => import("./pages/Chatroom.tsx"));
const Login = lazyWithRetry(() => import("./pages/Login.tsx"));
const Register = lazyWithRetry(() => import("./pages/Register.tsx"));
const ForgotPassword = lazyWithRetry(() => import("./pages/ForgotPassword.tsx"));
const ResetPassword = lazyWithRetry(() => import("./pages/ResetPassword.tsx"));
const Profile = lazyWithRetry(() => import("./pages/Profile.tsx"));
const VideoLibrary = lazyWithRetry(() => import("./pages/VideoLibrary.tsx"));
const TradingSignals = lazyWithRetry(() => import("./pages/TradingSignals.tsx"));
const Leaderboard = lazyWithRetry(() => import("./pages/Leaderboard.tsx"));
const Admin = lazyWithRetry(() => import("./pages/Admin.tsx"));
const Analytics = lazyWithRetry(() => import("./pages/Analytics.tsx"));
const PublicProfile = lazyWithRetry(() => import("./pages/PublicProfile.tsx"));
const News = lazyWithRetry(() => import("./pages/News.tsx"));
// CalendarPage merged into News (single combined page)
const ConnectMT = lazyWithRetry(() => import("./pages/ConnectMT.tsx"));
const Webinars = lazyWithRetry(() => import("./pages/Webinars.tsx"));
const Education = lazyWithRetry(() => import("./pages/Education.tsx"));
const EducationModule = lazyWithRetry(() => import("./pages/EducationModule.tsx"));
const NotFound = lazyWithRetry(() => import("./pages/NotFound.tsx"));
const HeroQA = lazyWithRetry(() => import("./pages/HeroQA.tsx"));

const queryClient = new QueryClient();

const RouteFallback = () => <RouteOverlayLoader />;

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
    <LanguageProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <QuickTradeProvider>
            <CyberpunkBackground />
            <PageTransition>
              <Suspense fallback={<RouteFallback />}>
                <Routes>
                  <Route path="/" element={<Index />} />
                  <Route path="/login" element={<Login />} />
                  <Route path="/register" element={<Register />} />
                  <Route path="/forgot-password" element={<ForgotPassword />} />
                  <Route path="/reset-password" element={<ResetPassword />} />
                  {/* Open to all logged-in users (no eligibility required) */}
                  <Route path="/dashboard" element={<ProtectedRoute><EligibilityGate><DashboardLayout><Dashboard /></DashboardLayout></EligibilityGate></ProtectedRoute>} />
                  <Route path="/command" element={<ProtectedRoute><DashboardLayout><CommandDeck /></DashboardLayout></ProtectedRoute>} />
                  <Route path="/profile" element={<ProtectedRoute><DashboardLayout><Profile /></DashboardLayout></ProtectedRoute>} />
                  <Route path="/videos" element={<ProtectedRoute><DashboardLayout><VideoLibrary /></DashboardLayout></ProtectedRoute>} />
                  <Route path="/connect-mt" element={<ProtectedRoute><DashboardLayout><ConnectMT /></DashboardLayout></ProtectedRoute>} />
                  <Route path="/webinars" element={<ProtectedRoute><DashboardLayout><Webinars /></DashboardLayout></ProtectedRoute>} />
                  <Route path="/webinars/:id" element={<ProtectedRoute><DashboardLayout><Webinars /></DashboardLayout></ProtectedRoute>} />

                  {/* Eligibility-gated routes: requires verified live Infinox account + $100 USD min balance */}
                  <Route path="/live-chart" element={<ProtectedRoute><EligibilityGate><DashboardLayout><LiveChart /></DashboardLayout></EligibilityGate></ProtectedRoute>} />
                  <Route path="/chatroom" element={<ProtectedRoute><EligibilityGate><DashboardLayout><Chatroom /></DashboardLayout></EligibilityGate></ProtectedRoute>} />
                  <Route path="/signals" element={<ProtectedRoute><EligibilityGate><DashboardLayout><TradingSignals /></DashboardLayout></EligibilityGate></ProtectedRoute>} />
                  <Route path="/leaderboard" element={<ProtectedRoute><EligibilityGate><DashboardLayout><Leaderboard /></DashboardLayout></EligibilityGate></ProtectedRoute>} />
                  <Route path="/analytics" element={<ProtectedRoute><EligibilityGate><DashboardLayout><Analytics /></DashboardLayout></EligibilityGate></ProtectedRoute>} />
                  <Route path="/news" element={<ProtectedRoute><EligibilityGate><DashboardLayout><News /></DashboardLayout></EligibilityGate></ProtectedRoute>} />
                  <Route path="/calendar" element={<Navigate to="/news" replace />} />
                  <Route path="/education" element={<ProtectedRoute><EligibilityGate><DashboardLayout><Education /></DashboardLayout></EligibilityGate></ProtectedRoute>} />
                  <Route path="/education/:slug" element={<ProtectedRoute><EligibilityGate><DashboardLayout><EducationModule /></DashboardLayout></EligibilityGate></ProtectedRoute>} />

                  <Route path="/admin" element={<AdminRoute><DashboardLayout><Admin /></DashboardLayout></AdminRoute>} />
                  <Route path="/u/:userId" element={<ProtectedRoute><DashboardLayout><PublicProfile /></DashboardLayout></ProtectedRoute>} />
                  <Route path="/__qa/hero" element={<HeroQA />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
            </PageTransition>
            <OnboardingTour />
            <MobileBottomNav />
            <FloatingJoinLive />
            </QuickTradeProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </LanguageProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
