import { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { SettingsProvider } from "@/contexts/SettingsContext";
import { supabase } from "@/integrations/supabase/client";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Admin from "./pages/Admin";
import ProductDetail from "./pages/ProductDetail";
import Wishlist from "./pages/Wishlist";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";
import BottomNav from "./components/BottomNav";
import Profile from "./pages/Profile";
import Roleta from "./pages/Roleta";
import Correio from "./pages/Correio";
import SendVb from "./pages/SendVb";
import P2P from "./pages/P2P";
import Trend from "./pages/Trend";

const queryClient = new QueryClient();

const VisitTracker = () => {
  useEffect(() => {
    if (sessionStorage.getItem("v_logged")) return;
    sessionStorage.setItem("v_logged", "1");
    supabase.auth.getUser().then(({ data }) => {
      supabase.from("site_visits").insert({
        user_id: data.user?.id ?? null,
        path: window.location.pathname,
        user_agent: navigator.userAgent.slice(0, 250),
      });
    });
  }, []);
  return null;
};

const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { session, loading, isAdmin } = useAuth();
  if (loading) return <div className="min-h-screen grid place-items-center"><div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full"/></div>;
  if (!session) return <Navigate to="/auth" replace />;
  if (!isAdmin) return <Navigate to="/" replace />;
  return <>{children}</>;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <SettingsProvider>
        <BrowserRouter>
          <AuthProvider>
            <div className="h-dvh flex flex-col overflow-hidden bg-background">
            <VisitTracker />
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/product/:id" element={<ProductDetail />} />
              <Route path="/wishlist" element={<Wishlist />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/perfil" element={<Profile />} />
              <Route path="/roleta" element={<Roleta />} />
              <Route path="/correio" element={<Correio />} />
              <Route path="/send-vb" element={<SendVb />} />
              <Route path="/p2p" element={<P2P />} />
              <Route path="/trend" element={<Trend />} />
              <Route path="/admin" element={<AdminRoute><Admin /></AdminRoute>} />
              <Route path="*" element={<NotFound />} />
            </Routes>
            </div>
            <BottomNav />
            </div>
          </AuthProvider>
        </BrowserRouter>
      </SettingsProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
