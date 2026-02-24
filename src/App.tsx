import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { CartProvider } from "@/contexts/CartContext";
import Menu from "./pages/Menu";
import Checkout from "./pages/Checkout";
import OrderSuccess from "./pages/OrderSuccess";
import KDS from "./pages/KDS";
import AdminLogin from "./pages/admin/AdminLogin";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminCategories from "./pages/admin/AdminCategories";
import AdminProducts from "./pages/admin/AdminProducts";
import AdminOrders from "./pages/admin/AdminOrders";
import AdminReports from "./pages/admin/AdminReports";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminSettings from "./pages/admin/AdminSettings";
import AdminTables from "./pages/admin/AdminTables";
import TableActivation from "./pages/TableActivation";
import TableBill from "./pages/TableBill";
import { AdminGuard } from "./components/admin/AdminGuard";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <CartProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Menu />} />
            <Route path="/checkout" element={<Checkout />} />
            <Route path="/order-success" element={<OrderSuccess />} />
            <Route path="/mesa/:tableNumber" element={<TableActivation />} />
            <Route path="/conta-mesa/:tableNumber" element={<TableBill />} />
            <Route path="/kds" element={<KDS />} />
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/admin" element={<AdminGuard><AdminDashboard /></AdminGuard>} />
            <Route path="/admin/categories" element={<AdminGuard><AdminCategories /></AdminGuard>} />
            <Route path="/admin/products" element={<AdminGuard><AdminProducts /></AdminGuard>} />
            <Route path="/admin/orders" element={<AdminGuard><AdminOrders /></AdminGuard>} />
            <Route path="/admin/reports" element={<AdminGuard><AdminReports /></AdminGuard>} />
            <Route path="/admin/users" element={<AdminGuard><AdminUsers /></AdminGuard>} />
            <Route path="/admin/settings" element={<AdminGuard><AdminSettings /></AdminGuard>} />
            <Route path="/admin/tables" element={<AdminGuard><AdminTables /></AdminGuard>} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </CartProvider>
  </QueryClientProvider>
);

export default App;
