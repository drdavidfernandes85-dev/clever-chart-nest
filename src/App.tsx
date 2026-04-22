import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { LanguageProvider } from "@/i18n/LanguageContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import PageTransition from "@/components/PageTransition";
import Index from "./pages/Index.tsx";
import Dashboard from "./pages/Dashboard.tsx";
import LiveChart from "./pages/LiveChart.tsx";
import Chatroom from "./pages/Chatroom.tsx";
import Login from "./pages/Login.tsx";
import Register from "./pages/Register.tsx";
import Profile from "./pages/Profile.tsx";
import VideoLibrary from "./pages/VideoLibrary.tsx";
import TradingSignals from "./pages/TradingSignals.tsx";
import Leaderboard from "./pages/Leaderboard.tsx";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
    <LanguageProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <PageTransition>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                <Route path="/live-chart" element={<ProtectedRoute><LiveChart /></ProtectedRoute>} />
                <Route path="/chatroom" element={<ProtectedRoute><Chatroom /></ProtectedRoute>} />
                <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
                <Route path="/videos" element={<ProtectedRoute><VideoLibrary /></ProtectedRoute>} />
                <Route path="/signals" element={<ProtectedRoute><TradingSignals /></ProtectedRoute>} />
                <Route path="/leaderboard" element={<ProtectedRoute><Leaderboard /></ProtectedRoute>} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </PageTransition>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </LanguageProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
