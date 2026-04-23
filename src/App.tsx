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
import PageTransition from "@/components/PageTransition";
import MobileBottomNav from "@/components/MobileBottomNav";
import OnboardingTour from "@/components/onboarding/OnboardingTour";
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
            <PageTransition>
              <Suspense fallback={<RouteFallback />}>
                <Routes>
                  <Route path="/" element={<Index />} />
                  <Route path="/login" element={<Login />} />
                  <Route path="/register" element={<Register />} />
                  <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                  <Route path="/command" element={<ProtectedRoute><CommandDeck /></ProtectedRoute>} />
                  <Route path="/live-chart" element={<ProtectedRoute><LiveChart /></ProtectedRoute>} />
                  <Route path="/chatroom" element={<ProtectedRoute><Chatroom /></ProtectedRoute>} />
                  <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
                  <Route path="/videos" element={<ProtectedRoute><VideoLibrary /></ProtectedRoute>} />
                  <Route path="/signals" element={<ProtectedRoute><TradingSignals /></ProtectedRoute>} />
                  <Route path="/leaderboard" element={<ProtectedRoute><Leaderboard /></ProtectedRoute>} />
                  <Route path="/admin" element={<AdminRoute><Admin /></AdminRoute>} />
                  <Route path="/analytics" element={<ProtectedRoute><Analytics /></ProtectedRoute>} />
                  <Route path="/news" element={<ProtectedRoute><News /></ProtectedRoute>} />
                  <Route path="/calendar" element={<ProtectedRoute><CalendarPage /></ProtectedRoute>} />
                  <Route path="/connect-mt" element={<ProtectedRoute><ConnectMT /></ProtectedRoute>} />
                  <Route path="/u/:userId" element={<ProtectedRoute><PublicProfile /></ProtectedRoute>} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
            </PageTransition>
            <OnboardingTour />
            <MobileBottomNav />
            </QuickTradeProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </LanguageProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
