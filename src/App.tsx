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
import ReviewAccessBadge from "@/components/ReviewAccessBadge";
import ErrorBoundary from "@/components/ErrorBoundary";
import InternalPreviewBanner from "@/components/InternalPreviewBanner";
import PreviewRouteLoader from "@/components/PreviewRouteLoader";
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
const CopyTrading = lazy(() => import("./pages/CopyTrading"));
const LiveChart = lazy(() => import("./pages/LiveChart"));
const Login = lazy(() => import("./pages/Login"));
const News = lazy(() => import("./pages/News"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Profile = lazy(() => import("./pages/Profile"));
const PublicProfile = lazy(() => import("./pages/PublicProfile"));
const Register = lazy(() => import("./pages/Register"));
const Signup = lazy(() => import("./pages/Signup"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const AuthCallback = lazy(() => import("./pages/AuthCallback"));
const TradingSignals = lazy(() => import("./pages/TradingSignals"));
const TradingDashboard = lazy(() => import("./pages/TradingDashboard"));
const VideoLibrary = lazy(() => import("./pages/VideoLibrary"));
const Webinars = lazy(() => import("./pages/Webinars"));
const WebinarLanding = lazy(() => import("./pages/WebinarLanding"));
const Ideas = lazy(() => import("./pages/Ideas"));
const Terms = lazy(() => import("./pages/Terms"));
const RiskDisclosure = lazy(() => import("./pages/RiskDisclosure"));
const ComplianceReview = lazy(() => import("./pages/ComplianceReview"));

const DashboardShell = ({ children, scope }: { children: ReactNode; scope?: string }) => (
  <ProtectedRoute>
    <DashboardLayout>
      <ErrorBoundary scope={scope}>{children}</ErrorBoundary>
    </DashboardLayout>
  </ProtectedRoute>
);

const GatedDashboardShell = ({ children, scope }: { children: ReactNode; scope?: string }) => (
  <ProtectedRoute>
    <EligibilityGate>
      <DashboardLayout>
        <ErrorBoundary scope={scope}>{children}</ErrorBoundary>
      </DashboardLayout>
    </EligibilityGate>
  </ProtectedRoute>
);

/**
 * Wrapper for routes hidden from launch navigation but reachable by URL.
 * Adds:
 *   - an ErrorBoundary scoped to the route (no black-screen on render crash)
 *   - a dedicated Suspense fallback with 12s timeout + retry UI so the
 *     lazy chunk download can never spin forever.
 */
const InternalPreviewShell = ({ children, scope, label }: { children: ReactNode; scope?: string; label?: string }) => (
  <ProtectedRoute>
    <DashboardLayout>
      <ErrorBoundary scope={scope}>
        <div className="p-4">
          <InternalPreviewBanner label={label} />
        </div>
        <Suspense fallback={<PreviewRouteLoader label={label} />}>
          <ErrorBoundary scope={`${scope}-content`}>
            {children}
          </ErrorBoundary>
        </Suspense>
      </ErrorBoundary>
    </DashboardLayout>
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
              <ErrorBoundary scope="route-root">
                <Suspense fallback={<RouteFallback />}>
                  <Routes>
                    <Route path="/" element={<Index />} />
                    <Route path="/login" element={<Login />} />
                    <Route path="/signup" element={<Signup />} />
                    {/* Legacy English routes redirected to the new Spanish auth flow */}
                    <Route path="/register" element={<Navigate to="/signup" replace />} />
                    <Route path="/forgot-password" element={<Navigate to="/reset-password" replace />} />
                    <Route path="/reset-password" element={<ResetPassword />} />
                    <Route path="/auth/callback" element={<AuthCallback />} />
                    {/* Open to all logged-in users (no eligibility required) */}
                    <Route path="/dashboard" element={<DashboardShell scope="dashboard"><Dashboard /></DashboardShell>} />
                    <Route path="/trading-room" element={<DashboardShell scope="trading-room"><TradingDashboard /></DashboardShell>} />
                    <Route path="/command" element={<DashboardShell scope="command"><CommandDeck /></DashboardShell>} />
                    <Route path="/profile" element={<DashboardShell scope="profile"><Profile /></DashboardShell>} />
                    {/* /videos: hidden from launch nav (Video Library) */}
                    <Route path="/videos" element={<InternalPreviewShell scope="videos" label="Video Library"><VideoLibrary /></InternalPreviewShell>} />
                    <Route path="/connect-mt" element={<DashboardShell scope="connect-mt"><ConnectMT /></DashboardShell>} />
                    <Route path="/connect" element={<ErrorBoundary scope="connect"><ConnectMyMT5 /></ErrorBoundary>} />
                    {/* Public-facing free webinar landing page (high-conversion) */}
                    <Route path="/webinar" element={<ErrorBoundary scope="webinar"><WebinarLanding /></ErrorBoundary>} />
                    <Route path="/webinars" element={<ErrorBoundary scope="webinars"><WebinarLanding /></ErrorBoundary>} />
                    <Route path="/community" element={<ProtectedRoute><ErrorBoundary scope="community"><Community /></ErrorBoundary></ProtectedRoute>} />
                    <Route path="/community/guidelines" element={<ErrorBoundary scope="community-guidelines"><CommunityGuidelines /></ErrorBoundary>} />
                    {/* In-app webinar library (logged-in) */}
                    <Route path="/webinars/all" element={<DashboardShell scope="webinars-all"><Webinars /></DashboardShell>} />
                    <Route path="/webinars/:id" element={<DashboardShell scope="webinars-detail"><Webinars /></DashboardShell>} />

                    {/* Eligibility-gated routes: requires verified live Infinox account + $100 USD min balance */}
                    <Route path="/live-chart" element={<GatedDashboardShell scope="live-chart"><LiveChart /></GatedDashboardShell>} />
                    <Route path="/chatroom" element={<GatedDashboardShell scope="chatroom"><Chatroom /></GatedDashboardShell>} />
                    <Route path="/ideas" element={<GatedDashboardShell scope="ideas"><Ideas /></GatedDashboardShell>} />
                    {/* Legacy routes — redirect to combined Ideas tab for Compliance */}
                    <Route path="/signals" element={<Navigate to="/ideas" replace />} />
                    <Route path="/copy-trading" element={<Navigate to="/ideas" replace />} />
                    {/* /leaderboard, /analytics: hidden from launch nav */}
                    <Route path="/leaderboard" element={<InternalPreviewShell scope="leaderboard" label="Leaderboard"><Leaderboard /></InternalPreviewShell>} />
                    <Route path="/analytics" element={<InternalPreviewShell scope="analytics" label="Analytics"><Analytics /></InternalPreviewShell>} />
                    <Route path="/trading-dashboard" element={<Navigate to="/trading-room" replace />} />
                    <Route path="/news" element={<GatedDashboardShell scope="news"><News /></GatedDashboardShell>} />
                    <Route path="/calendar" element={<Navigate to="/news" replace />} />
                    <Route path="/education" element={<GatedDashboardShell scope="education"><Education /></GatedDashboardShell>} />
                    <Route path="/education/:slug" element={<GatedDashboardShell scope="education-module"><EducationModule /></GatedDashboardShell>} />

                    <Route path="/admin" element={<AdminRoute><DashboardLayout><ErrorBoundary scope="admin"><Admin /></ErrorBoundary></DashboardLayout></AdminRoute>} />
                    <Route path="/u/:userId" element={<DashboardShell scope="public-profile"><PublicProfile /></DashboardShell>} />
                    <Route path="/__qa/hero" element={<HeroQA />} />
                    <Route path="/terms" element={<ErrorBoundary scope="terms"><Terms /></ErrorBoundary>} />
                    <Route path="/risk-disclosure" element={<ErrorBoundary scope="risk-disclosure"><RiskDisclosure /></ErrorBoundary>} />
                    <Route path="/compliance-review" element={<DashboardShell scope="compliance-review"><ComplianceReview /></DashboardShell>} />
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </Suspense>
              </ErrorBoundary>
            </PageTransition>
            <OnboardingTour />
            <MobileBottomNav />
            <Suspense fallback={null}>
              <FloatingJoinLive />
              <FloatingMobileCTA />
              <ExitIntentPopup />
            </Suspense>
            <ReviewAccessBadge />
            </QuickTradeProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </LanguageProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
