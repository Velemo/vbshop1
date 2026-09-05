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
            <VisitTracker />
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/product/:id" element={<ProductDetail />} />
              <Route path="/wishlist" element={<Wishlist />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/admin" element={<AdminRoute><Admin /></AdminRoute>} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </SettingsProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
