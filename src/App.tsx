import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import Track from "./pages/Track";
import ApplyUniversity from "./pages/ApplyUniversity";
import ApplySecondary from "./pages/ApplySecondary";
import FAQ from "./pages/FAQ";
import AdminDashboard from "./pages/AdminDashboard";
import AdminLogin from "./pages/AdminLogin";
import AdminAllocation from "./pages/AdminAllocation";
import TreasuryLogin from "./pages/TreasuryLogin";
import TreasuryDashboard from "./pages/TreasuryDashboard";
import CommissionerLogin from "./pages/CommissionerLogin";
import CommissionerDashboard from "./pages/CommissionerDashboard";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/track" element={<Track />} />
            <Route path="/apply/university" element={<ApplyUniversity />} />
            <Route path="/apply/secondary" element={<ApplySecondary />} />
            <Route path="/faq" element={<FAQ />} />
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/treasury/login" element={<TreasuryLogin />} />
            <Route path="/treasury" element={<TreasuryDashboard />} />
            <Route path="/commissioner/login" element={<CommissionerLogin />} />
            <Route path="/commissioner" element={<CommissionerDashboard />} />
            <Route
              path="/admin"
              element={
                <ProtectedRoute requireAdmin>
                  <AdminDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/allocation"
              element={
                <ProtectedRoute requireAdmin>
                  <AdminAllocation />
                </ProtectedRoute>
              }
            />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
