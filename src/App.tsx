import { Suspense, type ReactNode } from "react";
import { lazyWithRetry as lazy } from "@/lib/lazyWithRetry";

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
import PageTransition from "@/components/PageTransition";
import RouteOverlayLoader from "@/components/RouteOverlayLoader";
import MobileBottomNav from "@/components/MobileBottomNav";
import OnboardingTour from "@/components/onboarding/OnboardingTour";
import CyberpunkBackground from "@/components/CyberpunkBackground";
import Index from "./pages/Index.tsx";

const FloatingJoinLive = lazy(() => import("@/components/webinars/FloatingJoinLive"));
const FloatingMobileCTA = lazy(() => import("@/components/lead/FloatingMobileCTA"));
const ExitIntentPopup = lazy(() => import("@/components/lead/ExitIntentPopup"));
const DashboardLayout = lazy(() => import("@/components/dashboard/DashboardLayout"));
const Admin = lazy(() => import("./pages/Admin"));
const Analytics = lazy(() => import("./pages/Analytics"));
const Chatroom = lazy(() => import("./pages/Chatroom"));
const CommandDeck = lazy(() => import("./pages/CommandDeck"));
const ConnectMT = lazy(() => import("./pages/ConnectMT"));
const ConnectMyMT5 = lazy(() => import("./pages/ConnectMyMT5"));
const Community = lazy(() => import("./pages/Community"));
const CommunityGuidelines = lazy(() => import("./pages/CommunityGuidelines"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Education = lazy(() => import("./pages/Education"));
const EducationModule = lazy(() => import("./pages/EducationModule"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const HeroQA = lazy(() => import("./pages/HeroQA"));
const Leaderboard = lazy(() => import("./pages/Leaderboard"));
const LiveChart = lazy(() => import("./pages/LiveChart"));
const Login = lazy(() => import("./pages/Login"));
const News = lazy(() => import("./pages/News"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Profile = lazy(() => import("./pages/Profile"));
const PublicProfile = lazy(() => import("./pages/PublicProfile"));
const Register = lazy(() => import("./pages/Register"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const TradingSignals = lazy(() => import("./pages/TradingSignals"));
const VideoLibrary = lazy(() => import("./pages/VideoLibrary"));
const Webinars = lazy(() => import("./pages/Webinars"));
const WebinarLanding = lazy(() => import("./pages/WebinarLanding"));

const DashboardShell = ({ children }: { children: ReactNode }) => (
  <ProtectedRoute>
    <DashboardLayout>{children}</DashboardLayout>
  </ProtectedRoute>
);

const GatedDashboardShell = ({ children }: { children: ReactNode }) => (
  <ProtectedRoute>
    <EligibilityGate>
      <DashboardLayout>{children}</DashboardLayout>
    </EligibilityGate>
  </ProtectedRoute>
);

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
                  <Route path="/dashboard" element={<GatedDashboardShell><Dashboard /></GatedDashboardShell>} />
                  <Route path="/command" element={<DashboardShell><CommandDeck /></DashboardShell>} />
                  <Route path="/profile" element={<DashboardShell><Profile /></DashboardShell>} />
                  <Route path="/videos" element={<DashboardShell><VideoLibrary /></DashboardShell>} />
                  <Route path="/connect-mt" element={<DashboardShell><ConnectMT /></DashboardShell>} />
                  <Route path="/connect" element={<ConnectMyMT5 />} />
                  <Route path="/webinar" element={<WebinarLanding />} />
                  <Route path="/community" element={<ProtectedRoute><Community /></ProtectedRoute>} />
                  <Route path="/webinars" element={<DashboardShell><Webinars /></DashboardShell>} />
                  <Route path="/webinars/:id" element={<DashboardShell><Webinars /></DashboardShell>} />

                  {/* Eligibility-gated routes: requires verified live Infinox account + $100 USD min balance */}
                  <Route path="/live-chart" element={<GatedDashboardShell><LiveChart /></GatedDashboardShell>} />
                  <Route path="/chatroom" element={<GatedDashboardShell><Chatroom /></GatedDashboardShell>} />
                  <Route path="/signals" element={<GatedDashboardShell><TradingSignals /></GatedDashboardShell>} />
                  <Route path="/leaderboard" element={<GatedDashboardShell><Leaderboard /></GatedDashboardShell>} />
                  <Route path="/analytics" element={<GatedDashboardShell><Analytics /></GatedDashboardShell>} />
                  <Route path="/news" element={<GatedDashboardShell><News /></GatedDashboardShell>} />
                  <Route path="/calendar" element={<Navigate to="/news" replace />} />
                  <Route path="/education" element={<GatedDashboardShell><Education /></GatedDashboardShell>} />
                  <Route path="/education/:slug" element={<GatedDashboardShell><EducationModule /></GatedDashboardShell>} />

                  <Route path="/admin" element={<AdminRoute><DashboardLayout><Admin /></DashboardLayout></AdminRoute>} />
                  <Route path="/u/:userId" element={<DashboardShell><PublicProfile /></DashboardShell>} />
                  <Route path="/__qa/hero" element={<HeroQA />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
            </PageTransition>
            <OnboardingTour />
            <MobileBottomNav />
            <Suspense fallback={null}>
              <FloatingJoinLive />
              <FloatingMobileCTA />
              <ExitIntentPopup />
            </Suspense>
            </QuickTradeProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </LanguageProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
