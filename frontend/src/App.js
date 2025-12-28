import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import PrivateRoute from './components/PrivateRoute';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Users from './pages/Users';
import Suppliers from './pages/Suppliers';
import SupplierDetail from './pages/SupplierDetail';
import TradingProducts from './pages/TradingProducts';
import MaterialSupplies from './pages/MaterialSupplies';
import Orders from './pages/Orders';
import OrderFormNew from './pages/OrderFormNew';
import OrderDetail from './pages/OrderDetail';
import Customers from './pages/Customers';
import Quotations from './pages/Quotations';
import OrderProcessing from './pages/OrderProcessing';
import SalesOrderForm from './pages/SalesOrderForm';
import QuotationForm from './pages/QuotationForm';
import QuotationDetail from './pages/QuotationDetail';
import ExchangeRates from './pages/ExchangeRates';
import CompanyInfo from './pages/modules/CompanyInfo';
import PaymentDeliverySettings from './pages/PaymentDeliverySettings';
import EmployeeList from './pages/EmployeeList';
import MyVERP from './pages/MyVERP';
import Layout from './components/Layout';
import Inventory from './pages/Inventory';
import Projects from './pages/Projects';
import ProjectEdit from './pages/ProjectEdit';
import Systems from './pages/Systems';
import SystemEdit from './pages/SystemEdit';
import VSHardware from './pages/VSHardware';
import VSHardwareEdit from './pages/VSHardwareEdit';
import ProductionOrders from './pages/ProductionOrders';

// Import Main Modules
import Finance from './pages/modules/Finance';
import Procurement from './pages/modules/Procurement';
import Settings from './pages/modules/Settings';
import SalesOrderManagement from './pages/modules/SalesOrderManagement';
import {
  InventoryManagement,
  HumanResources,
  Manufacturing,
  VisiView,
  Service,
  BusinessIntelligence,
  DocumentManagement
} from './pages/modules';

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
            <Route path="sales" element={<SalesOrderManagement />} />
            <Route path="hr" element={<HumanResources />} />
            <Route path="hr/employees" element={<EmployeeList />} />
            <Route path="myverp" element={<MyVERP />} />
            <Route path="manufacturing" element={<Manufacturing />} />
            <Route path="manufacturing/vs-hardware" element={<VSHardware />} />
            <Route path="manufacturing/vs-hardware/:id" element={<VSHardwareEdit />} />
            <Route path="manufacturing/production-orders" element={<ProductionOrders />} />
            <Route path="visiview" element={<VisiView />} />
            <Route path="service" element={<Service />} />
            <Route path="bi" element={<BusinessIntelligence />} />
            <Route path="documents" element={<DocumentManagement />} />
            <Route path="settings" element={<Settings />} />
            
            {/* Procurement Submodules */}
            <Route path="procurement/suppliers" element={<Suppliers />} />
            <Route path="procurement/suppliers/:id" element={<SupplierDetail />} />
            <Route path="procurement/trading-goods" element={<TradingProducts />} />
            <Route path="procurement/materials-supplies" element={<MaterialSupplies />} />
            <Route path="procurement/orders" element={<Orders />} />
            <Route path="procurement/orders/new" element={<OrderFormNew />} />
            <Route path="procurement/orders/:id" element={<OrderDetail />} />
            <Route path="procurement/orders/:id/edit" element={<OrderFormNew />} />
            
            {/* Sales/Order Management Submodules */}
            <Route path="sales/customers" element={<Customers />} />
            <Route path="sales/projects" element={<Projects />} />
            <Route path="projects/:id" element={<ProjectEdit />} />
            <Route path="sales/systems" element={<Systems />} />
            <Route path="sales/systems/:id" element={<SystemEdit />} />
            <Route path="sales/quotations" element={<Quotations />} />
            <Route path="sales/order-processing" element={<OrderProcessing />} />
            <Route path="sales/order-processing/new" element={<SalesOrderForm />} />
            <Route path="sales/order-processing/:id" element={<SalesOrderForm />} />
            <Route path="sales/quotations/new" element={<QuotationForm />} />
            <Route path="sales/quotations/:id" element={<QuotationDetail />} />
            <Route path="sales/quotations/:id/edit" element={<QuotationForm />} />
            {/* legacy redirect removed: order-processing now handled by OrderProcessing component */}
            <Route path="sales/marketing" element={<Navigate to="/sales" replace />} />
            
            {/* Settings Submodules */}
            <Route path="settings/users" element={<Users />} />
            <Route path="settings/currency-exchange-rates" element={<ExchangeRates />} />
            <Route path="settings/company-info" element={<CompanyInfo />} />
            <Route path="settings/payment-delivery" element={<PaymentDeliverySettings />} />
            
            {/* Legacy redirects for backward compatibility */}
            <Route path="users" element={<Navigate to="/settings/users" replace />} />
            <Route path="suppliers" element={<Navigate to="/procurement/suppliers" replace />} />
            <Route path="suppliers/:id" element={<Navigate to="/procurement/suppliers/:id" replace />} />
            <Route path="trading" element={<Navigate to="/procurement/trading-goods" replace />} />
            <Route path="settings/exchange-rates" element={<Navigate to="/settings/currency-exchange-rates" replace />} />
          </Route>
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
