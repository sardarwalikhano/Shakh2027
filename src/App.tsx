import { useEffect, useState } from "react";
import MarketplacePage from "./features/marketplace/MarketplacePage";
import ShoppingFlowPage from "./features/shopping/ShoppingFlowPage";
import CustomerPage from "./features/customer/CustomerPage";
import DashboardPage from "./features/dashboard/DashboardPage";
import FinancePage from "./features/finance/FinancePage";
import DeliveryPage from "./features/delivery/DeliveryPage";
import PaymentsPage from "./features/payments/PaymentsPage";
import NotificationsPage from "./features/notifications/NotificationsPage";
import SupportPage from "./features/support/SupportPage";
import EventCenterPage from "./features/events/EventCenterPage";
import ErrorBoundary from "./components/ux/ErrorBoundary";
import { AuthProvider } from "./features/auth/AuthContext";
import AuthPage from "./features/auth/AuthPage";
import { RequireAuth, RequireRole, RequirePermission } from "./features/auth/AuthGuards";
import AuditConsolePage from "./features/dashboard/AuditConsolePage";
import AnalyticsPage from "./features/dashboard/AnalyticsPage";
import PromotionsPage from "./features/dashboard/PromotionsPage";
import VendorCenterPage from "./features/vendor/VendorCenterPage";
import HomePage from "./features/home/HomePage";
import CarsPage from "./features/cars/CarsPage";
import UmrahPage from "./features/umrah/UmrahPage";
import RoleAccountsPage from "./features/roles/RoleAccountsPage";
import DeliveryPricingPage from "./features/delivery/DeliveryPricingPage";

function resolveRoute() {
  if (window.location.hash.startsWith("#auth")) return "auth";
  if (window.location.hash === "#" || window.location.hash === "") return "home";
  if (window.location.hash.startsWith("#checkout")) return "checkout";
  if (window.location.hash.startsWith("#cars")) return "cars";
  if (window.location.hash.startsWith("#umrah")) return "umrah";
  if (window.location.hash.startsWith("#roles")) return "roles";
  if (window.location.hash.startsWith("#account")) return "account";
  if (window.location.hash.startsWith("#dashboard")) return "dashboard";
  if (window.location.hash.startsWith("#finance")) return "finance";
  if (window.location.hash.startsWith("#payments")) return "payments";
  if (window.location.hash.startsWith("#notifications")) return "notifications";
  if (window.location.hash.startsWith("#support")) return "support";
  if (window.location.hash.startsWith("#events")) return "events";
  if (window.location.hash.startsWith("#audit")) return "audit";
  if (window.location.hash.startsWith("#analytics")) return "analytics";
  if (window.location.hash.startsWith("#promotions")) return "promotions";
  if (window.location.hash.startsWith("#vendor")) return "vendor";
  if (window.location.hash.startsWith("#delivery-pricing")) return "delivery-pricing";
  if (window.location.hash.startsWith("#tracking:")) return "tracking";
  if (window.location.hash.startsWith("#delivery")) return "delivery";
  return "market";
}

function resolveTrackingOrderId() {
  return window.location.hash.startsWith("#tracking:")
    ? window.location.hash.slice("#tracking:".length) || undefined
    : undefined;
}

export default function App() {
  const [route, setRoute] = useState(resolveRoute);
  const [trackingOrderId, setTrackingOrderId] = useState(resolveTrackingOrderId);

  useEffect(() => {
    const onHashChange = () => {
      setRoute(resolveRoute());
      setTrackingOrderId(resolveTrackingOrderId());
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  return (
    <AuthProvider>
      <ErrorBoundary>
        {route === "auth" && <AuthPage />}
        {route === "home" && <HomePage />}
        {route === "cars" && <CarsPage />}
        {route === "umrah" && <UmrahPage />}
        {route === "roles" && <RequireAuth><RoleAccountsPage /></RequireAuth>}
        {route === "checkout" && <RequireAuth><ShoppingFlowPage /></RequireAuth>}
        {route === "account" && <RequireAuth><CustomerPage /></RequireAuth>}
        {route === "dashboard" && <RequireRole roles={["super_admin", "admin", "captain", "captain_manager", "restaurant_vendor", "supermarket_vendor", "fashion_vendor", "car_dealer", "umrah_agency", "beauty_vendor", "support"]}><DashboardPage /></RequireRole>}
        {route === "finance" && <RequireAuth><FinancePage /></RequireAuth>}
        {route === "payments" && <RequireAuth><PaymentsPage /></RequireAuth>}
        {route === "notifications" && <RequireAuth><NotificationsPage /></RequireAuth>}
        {route === "support" && <RequireAuth><SupportPage /></RequireAuth>}
        {route === "events" && <RequireAuth><EventCenterPage /></RequireAuth>}
        {route === "audit" && <RequirePermission permission="platform.manage"><AuditConsolePage /></RequirePermission>}
        {route === "analytics" && <RequirePermission permission="analytics.read"><AnalyticsPage /></RequirePermission>}
        {route === "promotions" && <RequirePermission permission="promotions.manage"><PromotionsPage /></RequirePermission>}
        {route === "vendor" && <RequirePermission permission="catalog.manage"><VendorCenterPage /></RequirePermission>}
        {route === "delivery-pricing" && <RequirePermission permission="delivery.manage"><DeliveryPricingPage /></RequirePermission>}
        {route === "delivery" && <RequireAuth><DeliveryPage /></RequireAuth>}
        {route === "tracking" && <RequireAuth><DeliveryPage orderId={trackingOrderId} /></RequireAuth>}
        {route === "market" && <MarketplacePage />}
      </ErrorBoundary>
    </AuthProvider>
  );
}
