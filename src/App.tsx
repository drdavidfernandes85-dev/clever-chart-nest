import { Suspense } from "react";
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
import ExitIntentPopup from "@/components/lead/ExitIntentPopup";
import FloatingMobileCTA from "@/components/lead/FloatingMobileCTA";
import Admin from "./pages/Admin.tsx";
import Analytics from "./pages/Analytics.tsx";
import Chatroom from "./pages/Chatroom.tsx";
import CommandDeck from "./pages/CommandDeck.tsx";
import ConnectMT from "./pages/ConnectMT.tsx";
import Dashboard from "./pages/Dashboard.tsx";
import Education from "./pages/Education.tsx";
import EducationModule from "./pages/EducationModule.tsx";
import ForgotPassword from "./pages/ForgotPassword.tsx";
import HeroQA from "./pages/HeroQA.tsx";
import Index from "./pages/Index.tsx";
import Leaderboard from "./pages/Leaderboard.tsx";
import LiveChart from "./pages/LiveChart.tsx";
import Login from "./pages/Login.tsx";
import News from "./pages/News.tsx";
import NotFound from "./pages/NotFound.tsx";
import Profile from "./pages/Profile.tsx";
import PublicProfile from "./pages/PublicProfile.tsx";
import Register from "./pages/Register.tsx";
import ResetPassword from "./pages/ResetPassword.tsx";
import TradingSignals from "./pages/TradingSignals.tsx";
import VideoLibrary from "./pages/VideoLibrary.tsx";
import Webinars from "./pages/Webinars.tsx";

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
            <FloatingMobileCTA />
            <ExitIntentPopup />
            </QuickTradeProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </LanguageProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
