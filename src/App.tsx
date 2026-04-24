import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { LanguageProvider } from "@/i18n/LanguageContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { QuickTradeProvider } from "@/contexts/QuickTradeContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import AdminRoute from "@/components/AdminRoute";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import PageTransition from "@/components/PageTransition";
import MobileBottomNav from "@/components/MobileBottomNav";
import OnboardingTour from "@/components/onboarding/OnboardingTour";
import FloatingJoinLive from "@/components/webinars/FloatingJoinLive";
import CyberpunkBackground from "@/components/CyberpunkBackground";
import Index from "./pages/Index.tsx";

// Code-split heavier authenticated routes
const Dashboard = lazy(() => import("./pages/Dashboard.tsx"));
const CommandDeck = lazy(() => import("./pages/CommandDeck.tsx"));
const LiveChart = lazy(() => import("./pages/LiveChart.tsx"));
const Chatroom = lazy(() => import("./pages/Chatroom.tsx"));
const Login = lazy(() => import("./pages/Login.tsx"));
const Register = lazy(() => import("./pages/Register.tsx"));
const Profile = lazy(() => import("./pages/Profile.tsx"));
const VideoLibrary = lazy(() => import("./pages/VideoLibrary.tsx"));
const TradingSignals = lazy(() => import("./pages/TradingSignals.tsx"));
const Leaderboard = lazy(() => import("./pages/Leaderboard.tsx"));
const Admin = lazy(() => import("./pages/Admin.tsx"));
const Analytics = lazy(() => import("./pages/Analytics.tsx"));
const PublicProfile = lazy(() => import("./pages/PublicProfile.tsx"));
const News = lazy(() => import("./pages/News.tsx"));
const CalendarPage = lazy(() => import("./pages/Calendar.tsx"));
const ConnectMT = lazy(() => import("./pages/ConnectMT.tsx"));
const Webinars = lazy(() => import("./pages/Webinars.tsx"));
const NotFound = lazy(() => import("./pages/NotFound.tsx"));

const queryClient = new QueryClient();

const RouteFallback = () => (
  <div className="flex min-h-screen items-center justify-center bg-background">
    <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
  </div>
);

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
                  <Route path="/dashboard" element={<ProtectedRoute><DashboardLayout><Dashboard /></DashboardLayout></ProtectedRoute>} />
                  <Route path="/command" element={<ProtectedRoute><DashboardLayout><CommandDeck /></DashboardLayout></ProtectedRoute>} />
                  <Route path="/live-chart" element={<ProtectedRoute><DashboardLayout><LiveChart /></DashboardLayout></ProtectedRoute>} />
                  <Route path="/chatroom" element={<ProtectedRoute><DashboardLayout><Chatroom /></DashboardLayout></ProtectedRoute>} />
                  <Route path="/profile" element={<ProtectedRoute><DashboardLayout><Profile /></DashboardLayout></ProtectedRoute>} />
                  <Route path="/videos" element={<ProtectedRoute><DashboardLayout><VideoLibrary /></DashboardLayout></ProtectedRoute>} />
                  <Route path="/signals" element={<ProtectedRoute><DashboardLayout><TradingSignals /></DashboardLayout></ProtectedRoute>} />
                  <Route path="/leaderboard" element={<ProtectedRoute><DashboardLayout><Leaderboard /></DashboardLayout></ProtectedRoute>} />
                  <Route path="/admin" element={<AdminRoute><DashboardLayout><Admin /></DashboardLayout></AdminRoute>} />
                  <Route path="/analytics" element={<ProtectedRoute><DashboardLayout><Analytics /></DashboardLayout></ProtectedRoute>} />
                  <Route path="/news" element={<ProtectedRoute><DashboardLayout><News /></DashboardLayout></ProtectedRoute>} />
                  <Route path="/calendar" element={<ProtectedRoute><DashboardLayout><CalendarPage /></DashboardLayout></ProtectedRoute>} />
                  <Route path="/connect-mt" element={<ProtectedRoute><DashboardLayout><ConnectMT /></DashboardLayout></ProtectedRoute>} />
                  <Route path="/webinars" element={<ProtectedRoute><DashboardLayout><Webinars /></DashboardLayout></ProtectedRoute>} />
                  <Route path="/webinars/:id" element={<ProtectedRoute><DashboardLayout><Webinars /></DashboardLayout></ProtectedRoute>} />
                  <Route path="/u/:userId" element={<ProtectedRoute><DashboardLayout><PublicProfile /></DashboardLayout></ProtectedRoute>} />
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
