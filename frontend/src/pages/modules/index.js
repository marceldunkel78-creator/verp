import React from 'react';
import { Link } from 'react-router-dom';
import ComingSoon from './ComingSoon';
import EmployeeList from '../EmployeeList';
import InventoryManagementModule from './InventoryManagement';
import BusinessIntelligenceModule from '../BusinessIntelligence';
import { useAuth } from '../../context/AuthContext';
import { 
  CpuChipIcon, 
  ClipboardDocumentListIcon,
  CubeIcon,
  KeyIcon,
  TicketIcon,
  WrenchScrewdriverIcon,
  ArrowPathIcon,
  DocumentTextIcon,
  CodeBracketIcon,
  ClockIcon
} from '@heroicons/react/24/outline';

// Helper für Berechtigungsprüfung
const hasPermission = (user, permission) => {
  if (!permission) return true;
  if (user?.is_superuser) return true;
  return user?.[permission] === true;
};

export const InventoryManagement = () => <InventoryManagementModule />;

// SalesOrderManagement is now imported directly from its own file

export const HumanResources = () => <EmployeeList />;

export const Manufacturing = () => {
  const { user } = useAuth();
  
  const submodules = [
    {
      to: '/manufacturing/vs-hardware',
      icon: CpuChipIcon,
      iconBg: 'bg-blue-100',
      iconColor: 'text-blue-600',
      title: 'VS-Hardware',
      description: 'Eigenprodukte verwalten',
      permission: 'can_read_manufacturing_vs_hardware',
    },
    {
      to: '/manufacturing/production-orders',
      icon: ClipboardDocumentListIcon,
      iconBg: 'bg-green-100',
      iconColor: 'text-green-600',
      title: 'Fertigungsaufträge',
      description: 'Auftragseingang und Produktion',
      permission: 'can_read_manufacturing_production_orders',
    },
  ];
  
  const filteredSubmodules = submodules.filter(sm => hasPermission(user, sm.permission));
  
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Fertigung</h1>
        <p className="text-gray-500">Manufacturing und Produktion</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredSubmodules.map((sm) => {
          const Icon = sm.icon;
          return (
            <Link
              key={sm.to}
              to={sm.to}
              className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow"
            >
              <div className="flex items-center gap-4">
                <div className={`p-3 ${sm.iconBg} rounded-lg`}>
                  <Icon className={`h-8 w-8 ${sm.iconColor}`} />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{sm.title}</h3>
                  <p className="text-sm text-gray-500">{sm.description}</p>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
};

export const VisiView = () => {
  const { user } = useAuth();
  
  const submodules = [
    {
      to: '/visiview/products',
      icon: CubeIcon,
      iconBg: 'bg-blue-100',
      iconColor: 'text-blue-600',
      title: 'VisiView Produkte',
      description: 'Software-Produkte verwalten',
      permission: 'can_read_visiview_products',
    },
    {
      to: '/visiview/licenses',
      icon: KeyIcon,
      iconBg: 'bg-purple-100',
      iconColor: 'text-purple-600',
      title: 'Lizenzverwaltung',
      description: 'VisiView Lizenzen verwalten',
      permission: 'can_read_visiview_licenses',
    },
    {
      to: '/visiview/tickets',
      icon: TicketIcon,
      iconBg: 'bg-indigo-100',
      iconColor: 'text-indigo-600',
      title: 'Ticket-System',
      description: 'Bugs & Feature Requests',
      permission: 'can_read_visiview_tickets',
    },
    {
      to: '/visiview/macros',
      icon: CodeBracketIcon,
      iconBg: 'bg-cyan-100',
      iconColor: 'text-cyan-600',
      title: 'Macros',
      description: 'Python Macros verwalten',
      permission: 'can_read_visiview_macros',
    },
    {
      to: '/visiview/maintenance-time',
      icon: ClockIcon,
      iconBg: 'bg-orange-100',
      iconColor: 'text-orange-600',
      title: 'Maintenance Zeiterfassung',
      description: 'Zeitaufwendungen für Lizenzen',
      permission: 'can_read_visiview_maintenance_time',
    },
  ];
  
  const filteredSubmodules = submodules.filter(sm => hasPermission(user, sm.permission));
  
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">VisiView</h1>
        <p className="text-gray-500">VisiView Verwaltung und Konfiguration</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredSubmodules.map((sm) => {
          const Icon = sm.icon;
          return (
            <Link
              key={sm.to}
              to={sm.to}
              className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow"
            >
              <div className="flex items-center gap-4">
                <div className={`p-3 ${sm.iconBg} rounded-lg`}>
                  <Icon className={`h-8 w-8 ${sm.iconColor}`} />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{sm.title}</h3>
                  <p className="text-sm text-gray-500">{sm.description}</p>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
};

export const Service = () => {
  const { user } = useAuth();
  
  const submodules = [
    {
      to: '/service/vs-service',
      icon: WrenchScrewdriverIcon,
      iconBg: 'bg-green-100',
      iconColor: 'text-green-600',
      title: 'VS-Service Produkte',
      description: 'Service- und Dienstleistungen',
      permission: 'can_read_service_vs_service',
    },
    {
      to: '/service/tickets',
      icon: DocumentTextIcon,
      iconBg: 'bg-blue-100',
      iconColor: 'text-blue-600',
      title: 'Service-Tickets',
      description: 'Anfragen & Support',
      permission: 'can_read_service_tickets',
    },
    {
      to: '/service/rma',
      icon: ArrowPathIcon,
      iconBg: 'bg-orange-100',
      iconColor: 'text-orange-600',
      title: 'RMA-Verwaltung',
      description: 'Rücksendungen & Reparaturen',
      permission: 'can_read_service_rma',
    },
    {
      to: '/service/troubleshooting',
      icon: WrenchScrewdriverIcon,
      iconBg: 'bg-amber-100',
      iconColor: 'text-amber-600',
      title: 'Troubleshooting',
      description: 'Wissensdatenbank & Lösungen',
      permission: 'can_read_service_troubleshooting',
    },
  ];
  
  const filteredSubmodules = submodules.filter(sm => hasPermission(user, sm.permission));
  
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Service</h1>
        <p className="text-gray-500">Kundenservice, Support und Reparaturverwaltung</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredSubmodules.map((sm) => {
          const Icon = sm.icon;
          return (
            <Link
              key={sm.to}
              to={sm.to}
              className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow"
            >
              <div className="flex items-center gap-4">
                <div className={`p-3 ${sm.iconBg} rounded-lg`}>
                  <Icon className={`h-8 w-8 ${sm.iconColor}`} />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{sm.title}</h3>
                  <p className="text-sm text-gray-500">{sm.description}</p>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
};

export const BusinessIntelligence = () => <BusinessIntelligenceModule />;

export const DocumentManagement = () => (
  <ComingSoon 
    moduleName="Document Management" 
    description="Dokumentenverwaltung und Archivierung"
  />
);
