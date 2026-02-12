import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import PrivateRoute from './components/PrivateRoute';
import PermissionRoute from './components/PermissionRoute';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Users from './pages/Users';
import Suppliers from './pages/Suppliers';
import SupplierDetail from './pages/SupplierDetail';
import SupplierEdit from './pages/SupplierEdit';
import TradingProducts from './pages/TradingProducts';
import TradingProductEdit from './pages/TradingProductEdit';
import MaterialSupplies from './pages/MaterialSupplies';
import Orders from './pages/Orders';
import OrderFormNew from './pages/OrderFormNew';
import OrderDetail from './pages/OrderDetail';
import Customers from './pages/Customers';
import CustomerEdit from './pages/CustomerEdit';
import Quotations from './pages/Quotations';
import OrderProcessing from './pages/OrderProcessing';
import SalesOrderForm from './pages/SalesOrderForm';
import CustomerOrderEdit from './pages/CustomerOrderEdit';
import QuotationForm from './pages/QuotationForm';
import QuotationDetail from './pages/QuotationDetail';
import ExchangeRates from './pages/ExchangeRates';
import CompanyInfo from './pages/modules/CompanyInfo';
import PaymentDeliverySettings from './pages/PaymentDeliverySettings';
import EmployeeList from './pages/EmployeeList';
import EmployeeEdit from './pages/EmployeeEdit';
import MyVERP from './pages/MyVERP';
import Layout from './components/Layout';
import Inventory from './pages/Inventory';
import GoodsReceipt from './pages/GoodsReceipt';
import Projects from './pages/Projects';
import ProjectEdit from './pages/ProjectEdit';
import Systems from './pages/Systems';
import SystemEdit from './pages/SystemEdit';
import VSHardware from './pages/VSHardware';
import VSHardwareEdit from './pages/VSHardwareEdit';
import ProductionOrders from './pages/ProductionOrders';
import ProductionOrderEdit from './pages/ProductionOrderEdit';
import InventoryItemEdit from './pages/InventoryItemEdit';
import VisiViewProducts from './pages/VisiViewProducts';
import VisiViewProductEdit from './pages/VisiViewProductEdit';
import VisiViewLicenses from './pages/VisiViewLicenses';
import VisiViewLicenseEdit from './pages/VisiViewLicenseEdit';
import VisiViewTickets from './pages/VisiViewTickets';
import VisiViewTicketEdit from './pages/VisiViewTicketEdit';
import VisiViewMacros from './pages/VisiViewMacros';
import VisiViewMacroEdit from './pages/VisiViewMacroEdit';
import VisiViewProductionOrders from './pages/VisiViewProductionOrders';
import VisiViewProductionOrderEdit from './pages/VisiViewProductionOrderEdit';
import VisiViewSupportedHardware from './pages/VisiViewSupportedHardware';
import VisiViewSupportedHardwareEdit from './pages/VisiViewSupportedHardwareEdit';
import VSServiceProducts from './pages/VSServiceProducts';
import VSServiceProductEdit from './pages/VSServiceProductEdit';
import RMACases from './pages/RMACases';
import RMACaseEdit from './pages/RMACaseEdit';
import ProductCollections from './pages/ProductCollections';
import ProductCollectionEdit from './pages/ProductCollectionEdit';
import ServiceTickets from './pages/ServiceTickets';
import ServiceTicketEdit from './pages/ServiceTicketEdit';
import Troubleshooting from './pages/Troubleshooting';
import TroubleshootingEdit from './pages/TroubleshootingEdit';
import Dealers from './pages/Dealers';
import DealerEdit from './pages/DealerEdit';
import PriceLists from './pages/PriceLists';
import PriceListEdit from './pages/PriceListEdit';
import Loans from './pages/Loans';
import LoanEdit from './pages/LoanEdit';
import Documents from './pages/Documents';
import BackupRestore from './pages/BackupRestore';
import Marketing from './pages/Marketing';
import MarketingItemEdit from './pages/MarketingItemEdit';
import SalesTickets from './pages/SalesTickets';
import SalesTicketEdit from './pages/SalesTicketEdit';
import NotificationSettings from './pages/NotificationSettings';
import CustomerSync from './pages/CustomerSync';
import OrderImport from './pages/OrderImport';
import RedmineSync from './pages/RedmineSync';
import DevelopmentProjects from './pages/DevelopmentProjects';
import DevelopmentProjectEdit from './pages/DevelopmentProjectEdit';
import VisiViewMaintenanceTime from './pages/VisiViewMaintenanceTime';
import VisiViewDashboard from './pages/VisiView';
import MondayMeeting from './pages/MondayMeeting';
import SalesMeeting from './pages/SalesMeeting';
import VisiViewMeeting from './pages/VisiViewMeeting';
import Meetings from './pages/modules/Meetings';
import CompanyCalendar from './pages/CompanyCalendar';
import TravelReportList from './pages/TravelReportList';
import TravelReportEdit from './pages/TravelReportEdit';

// Import Main Modules
import Finance from './pages/modules/Finance';
import Procurement from './pages/modules/Procurement';
import Settings from './pages/modules/Settings';
import SalesOrderManagement from './pages/modules/SalesOrderManagement';
import Development from './pages/modules/Development';
import {
  InventoryManagement,
  HumanResources,
  Manufacturing,
  VisiView,
  Service,
  BusinessIntelligence
} from './pages/modules';
import AdminDelete from './pages/modules/AdminDelete';

function App() {
  return (
    <AuthProvider>
      <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            
            {/* Main Modules */}
            <Route path="finance" element={<Finance />} />
            <Route path="procurement" element={<Procurement />} />
            <Route path="inventory" element={<InventoryManagement />} />
            <Route path="inventory/warehouse" element={<Inventory />} />
            <Route path="inventory/warehouse/:id" element={<InventoryItemEdit />} />
            <Route path="inventory/goods-receipt" element={<GoodsReceipt />} />
            <Route path="sales" element={<SalesOrderManagement />} />
            <Route path="hr" element={<PermissionRoute permission="can_read_hr"><HumanResources /></PermissionRoute>} />
            <Route path="hr/employees" element={<PermissionRoute permission="can_read_hr"><EmployeeList /></PermissionRoute>} />
            <Route path="hr/employees/:id" element={<PermissionRoute permission="can_read_hr"><EmployeeEdit /></PermissionRoute>} />
            <Route path="myverp" element={<MyVERP />} />
            <Route path="manufacturing" element={<Manufacturing />} />
            <Route path="manufacturing/vs-hardware" element={<VSHardware />} />
            <Route path="manufacturing/vs-hardware/:id" element={<VSHardwareEdit />} />
            <Route path="manufacturing/production-orders" element={<ProductionOrders />} />
            <Route path="manufacturing/production-orders/:id" element={<ProductionOrderEdit />} />
            <Route path="visiview" element={<VisiViewDashboard />} />
            <Route path="visiview/products" element={<VisiViewProducts />} />
            <Route path="visiview/products/:id" element={<VisiViewProductEdit />} />
            <Route path="visiview/licenses" element={<VisiViewLicenses />} />
            <Route path="visiview/licenses/new" element={<VisiViewLicenseEdit />} />
            <Route path="visiview/licenses/:id" element={<VisiViewLicenseEdit />} />
            <Route path="visiview/tickets" element={<VisiViewTickets />} />
            <Route path="visiview/tickets/:id" element={<VisiViewTicketEdit />} />
            <Route path="visiview/macros" element={<VisiViewMacros />} />
            <Route path="visiview/macros/:id" element={<VisiViewMacroEdit />} />
            <Route path="visiview/production-orders" element={<VisiViewProductionOrders />} />
            <Route path="visiview/production-orders/new" element={<VisiViewProductionOrderEdit />} />
            <Route path="visiview/production-orders/:id" element={<VisiViewProductionOrderEdit />} />
            <Route path="visiview/maintenance-time" element={<VisiViewMaintenanceTime />} />
            <Route path="visiview/supported-hardware" element={<VisiViewSupportedHardware />} />
            <Route path="visiview/supported-hardware/:id" element={<VisiViewSupportedHardwareEdit />} />
            <Route path="service" element={<Service />} />
            <Route path="service/vs-service" element={<VSServiceProducts />} />
            <Route path="service/vs-service/:id" element={<VSServiceProductEdit />} />
            <Route path="service/tickets" element={<ServiceTickets />} />
            <Route path="service/tickets/new" element={<ServiceTicketEdit />} />
            <Route path="service/tickets/:id" element={<ServiceTicketEdit />} />
            <Route path="service/rma" element={<RMACases />} />
            <Route path="service/rma/new" element={<RMACaseEdit />} />
            <Route path="service/rma/:id" element={<RMACaseEdit />} />
            <Route path="service/troubleshooting" element={<Troubleshooting />} />
            <Route path="service/troubleshooting/new" element={<TroubleshootingEdit />} />
            <Route path="service/troubleshooting/:id" element={<TroubleshootingEdit />} />
            <Route path="bi" element={<BusinessIntelligence />} />
            <Route path="documents" element={<Documents />} />
            <Route path="settings" element={<Settings />} />
            
            {/* Development Module */}
            <Route path="development" element={<Development />} />
            <Route path="development/projects" element={<DevelopmentProjects />} />
            <Route path="development/projects/new" element={<DevelopmentProjectEdit />} />
            <Route path="development/projects/:id" element={<DevelopmentProjectEdit />} />
            
            {/* Meetings Module */}
            <Route path="meetings" element={<Meetings />} />
            <Route path="meetings/monday" element={<MondayMeeting />} />
            <Route path="meetings/sales" element={<SalesMeeting />} />
            <Route path="meetings/visiview" element={<VisiViewMeeting />} />
            
            {/* Company Calendar Module */}
            <Route path="calendar" element={<CompanyCalendar />} />
            
            {/* Procurement Submodules */}
            <Route path="procurement/suppliers" element={<Suppliers />} />
            <Route path="procurement/suppliers/new" element={<SupplierEdit />} />
            <Route path="procurement/suppliers/:id" element={<SupplierDetail />} />
            <Route path="procurement/suppliers/:id/edit" element={<SupplierEdit />} />
            <Route path="procurement/trading-goods" element={<TradingProducts />} />
            <Route path="procurement/trading-goods/new" element={<TradingProductEdit />} />
            <Route path="procurement/trading-goods/:id" element={<TradingProductEdit />} />
            <Route path="procurement/materials-supplies" element={<MaterialSupplies />} />
            <Route path="procurement/orders" element={<Orders />} />
            <Route path="procurement/orders/new" element={<OrderFormNew />} />
            <Route path="procurement/orders/:id" element={<OrderDetail />} />
            <Route path="procurement/orders/:id/edit" element={<OrderFormNew />} />
            <Route path="procurement/loans" element={<Loans />} />
            <Route path="procurement/loans/new" element={<LoanEdit />} />
            <Route path="procurement/loans/:id" element={<LoanEdit />} />
            <Route path="procurement/product-collections" element={<ProductCollections />} />
            <Route path="procurement/product-collections/new" element={<ProductCollectionEdit />} />
            <Route path="procurement/product-collections/:id" element={<ProductCollectionEdit />} />
            
            {/* Sales/Order Management Submodules */}
            <Route path="sales/customers" element={<Customers />} />
            <Route path="sales/customers/new" element={<CustomerEdit />} />
            <Route path="sales/customers/:id" element={<CustomerEdit />} />
            <Route path="sales/dealers" element={<Dealers />} />
            <Route path="sales/dealers/new" element={<DealerEdit />} />
            <Route path="sales/dealers/:id" element={<DealerEdit />} />
            <Route path="sales/pricelists" element={<PriceLists />} />
            <Route path="sales/pricelists/new" element={<PriceListEdit />} />
            <Route path="sales/pricelists/:id" element={<PriceListEdit />} />
            <Route path="sales/projects" element={<Projects />} />
            <Route path="sales/projects/new" element={<ProjectEdit />} />
            <Route path="sales/projects/:id" element={<ProjectEdit />} />
            <Route path="sales/systems" element={<Systems />} />
            <Route path="sales/systems/:id" element={<SystemEdit />} />
            <Route path="sales/quotations" element={<Quotations />} />
            <Route path="sales/order-processing" element={<OrderProcessing />} />
            <Route path="sales/order-processing/new" element={<CustomerOrderEdit />} />
            <Route path="sales/order-processing/:id" element={<CustomerOrderEdit />} />
            <Route path="sales/order-processing/:id/edit" element={<CustomerOrderEdit />} />
            <Route path="sales/quotations/new" element={<QuotationForm />} />
            <Route path="sales/quotations/:id" element={<QuotationDetail />} />
            <Route path="sales/quotations/:id/edit" element={<QuotationForm />} />
            <Route path="sales/marketing" element={<Marketing />} />
            <Route path="sales/marketing/new" element={<MarketingItemEdit />} />
            <Route path="sales/marketing/:id" element={<MarketingItemEdit />} />
            <Route path="sales/tickets" element={<SalesTickets />} />
            <Route path="sales/tickets/new" element={<SalesTicketEdit />} />
            <Route path="sales/tickets/:id" element={<SalesTicketEdit />} />
            
            {/* Settings Submodules */}
            <Route path="settings/users" element={<Users />} />
            <Route path="settings/currency-exchange-rates" element={<ExchangeRates />} />
            <Route path="settings/company-info" element={<CompanyInfo />} />
            <Route path="settings/payment-delivery" element={<PaymentDeliverySettings />} />
            <Route path="settings/backup-restore" element={<BackupRestore />} />
            <Route path="settings/notifications" element={<NotificationSettings />} />
            <Route path="settings/admin-delete" element={<AdminDelete />} />
            <Route path="settings/customer-sync" element={<CustomerSync />} />
            <Route path="settings/order-import" element={<OrderImport />} />
            <Route path="settings/redmine-sync" element={<RedmineSync />} />
            
            {/* Legacy redirects for backward compatibility */}
            <Route path="users" element={<Navigate to="/settings/users" replace />} />
            <Route path="suppliers" element={<Navigate to="/procurement/suppliers" replace />} />
            <Route path="suppliers/:id" element={<Navigate to="/procurement/suppliers/:id" replace />} />
            <Route path="trading" element={<Navigate to="/procurement/trading-goods" replace />} />
            <Route path="settings/exchange-rates" element={<Navigate to="/settings/currency-exchange-rates" replace />} />
            
            {/* Travel Reports */}
            <Route path="travel-reports" element={<TravelReportList />} />
            <Route path="travel-reports/new" element={<TravelReportEdit />} />
            <Route path="travel-reports/:id" element={<TravelReportEdit />} />
          </Route>
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
