import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { 
  UserIcon,
  BriefcaseIcon, 
  DocumentTextIcon, 
  ClipboardDocumentCheckIcon,
  MegaphoneIcon,
  ComputerDesktopIcon,
  BuildingStorefrontIcon,
  ClipboardDocumentListIcon
} from '@heroicons/react/24/outline';

// Helper für Berechtigungsprüfung
const hasPermission = (user, permission) => {
  if (!permission) return true;
  if (user?.is_superuser) return true;
  return user?.[permission] === true;
};

const SalesOrderManagement = () => {
  const { user } = useAuth();
  
  const modules = [
    {
      name: 'Customers',
      description: 'Kundendatenverwaltung',
      icon: UserIcon,
      path: '/sales/customers',
      color: 'blue',
      disabled: false,
      permission: 'can_read_customers',
    },
    {
      name: 'Dealers',
      description: 'Händlerverwaltung',
      icon: BuildingStorefrontIcon,
      path: '/sales/dealers',
      color: 'teal',
      disabled: false,
      permission: 'can_read_sales_dealers',
    },
    {
      name: 'Price Lists',
      description: 'Verkaufs-Preislisten',
      icon: ClipboardDocumentListIcon,
      path: '/sales/pricelists',
      color: 'green',
      disabled: false,
      permission: 'can_read_sales_pricelists',
    },
    {
      name: 'Projects',
      description: 'Kundenprojekte',
      icon: BriefcaseIcon,
      path: '/sales/projects',
      color: 'purple',
      disabled: false,
      permission: 'can_read_sales_projects',
    },
    {
      name: 'Quotations',
      description: 'Angebote',
      icon: DocumentTextIcon,
      path: '/sales/quotations',
      color: 'indigo',
      disabled: false,
      permission: 'can_read_sales_quotations',
    },
    {
      name: 'Order Processing',
      description: 'Auftragsabwicklung, Rechnungen',
      icon: ClipboardDocumentCheckIcon,
      path: '/sales/order-processing',
      color: 'amber',
      disabled: false,
      permission: 'can_read_sales_order_processing',
    },
    {
      name: 'Sales Tickets',
      description: 'Marketing-Anfragen & Dokumentation',
      icon: ClipboardDocumentCheckIcon,
      path: '/sales/tickets',
      color: 'violet',
      disabled: false,
      permission: 'can_read_sales_tickets',
    },
    {
      name: 'Marketing',
      description: 'Shows, Newsletter',
      icon: MegaphoneIcon,
      path: '/sales/marketing',
      color: 'pink',
      disabled: false,
      permission: 'can_read_sales_marketing',
    },
    {
      name: 'Systems',
      description: 'Kundensysteme',
      icon: ComputerDesktopIcon,
      path: '/sales/systems',
      color: 'cyan',
      disabled: false,
      permission: 'can_read_sales_systems',
    }
  ];

  // Filter modules based on user permissions
  const filteredModules = modules.filter(m => hasPermission(user, m.permission));

  const colorMap = {
    orange: { bg: 'bg-orange-100', text: 'text-orange-600' },
    purple: { bg: 'bg-purple-100', text: 'text-purple-600' },
    green: { bg: 'bg-green-100', text: 'text-green-600' },
    violet: { bg: 'bg-violet-100', text: 'text-violet-600' },
    blue: { bg: 'bg-blue-100', text: 'text-blue-600' },
    indigo: { bg: 'bg-indigo-100', text: 'text-indigo-600' },
    amber: { bg: 'bg-amber-100', text: 'text-amber-600' },
    teal: { bg: 'bg-teal-100', text: 'text-teal-600' },
    pink: { bg: 'bg-pink-100', text: 'text-pink-600' },
    cyan: { bg: 'bg-cyan-100', text: 'text-cyan-600' },
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Sales / Order Management</h1>
        <p className="mt-2 text-sm text-gray-600">Vertrieb, Angebote und Auftragsabwicklung</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredModules.map((module) => {
          const Icon = module.icon;
          const col = colorMap[module.color] || colorMap.blue;
          return module.disabled ? (
            <div key={module.name} className="block p-6 bg-gray-100 rounded-lg shadow opacity-60 cursor-not-allowed">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-gray-200 rounded-lg">
                  <Icon className="h-8 w-8 text-gray-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-500">{module.name}</h3>
                  <p className="text-sm text-gray-500">{module.description}</p>
                  <p className="text-xs text-gray-400 mt-2">Coming soon...</p>
                </div>
              </div>
            </div>
          ) : (
            <Link key={module.name} to={module.path} className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-center gap-4">
                <div className={`p-3 ${col.bg} rounded-lg`}>
                  <Icon className={`h-8 w-8 ${col.text}`} />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{module.name}</h3>
                  <p className="text-sm text-gray-500">{module.description}</p>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
};

export default SalesOrderManagement;
