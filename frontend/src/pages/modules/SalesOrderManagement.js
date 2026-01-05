import React from 'react';
import { Link } from 'react-router-dom';
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

const SalesOrderManagement = () => {
  const modules = [
    {
      name: 'Customers',
      description: 'Kundendatenverwaltung',
      icon: UserIcon,
      path: '/sales/customers',
      color: 'blue',
      disabled: false
    },
    {
      name: 'Dealers',
      description: 'Händlerverwaltung',
      icon: BuildingStorefrontIcon,
      path: '/sales/dealers',
      color: 'blue',
      disabled: false
    },
    {
      name: 'Price Lists',
      description: 'Verkaufs-Preislisten',
      icon: ClipboardDocumentListIcon,
      path: '/sales/pricelists',
      color: 'blue',
      disabled: false
    },
    {
      name: 'Projects',
      description: 'Kundenprojekte',
      icon: BriefcaseIcon,
      path: '/sales/projects',
      color: 'blue',
      disabled: false
    },
    {
      name: 'Quotations',
      description: 'Angebote',
      icon: DocumentTextIcon,
      path: '/sales/quotations',
      color: 'blue',
      disabled: false
    },
    {
      name: 'Order Processing',
      description: 'Auftragsabwicklung, Rechnungen',
      icon: ClipboardDocumentCheckIcon,
      path: '/sales/order-processing',
      color: 'blue',
      disabled: false
    },
    {
      name: 'Marketing',
      description: 'Shows, Newsletter',
      icon: MegaphoneIcon,
      path: '/sales/marketing',
      color: 'blue',
      disabled: false
    },
    {
      name: 'Systems',
      description: 'Kundensysteme',
      icon: ComputerDesktopIcon,
      path: '/sales/systems',
      color: 'blue',
      disabled: false
    }
  ];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Sales / Order Management</h1>
        <p className="mt-2 text-sm text-gray-600">
          Vertrieb, Angebote und Auftragsabwicklung
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {modules.map((module) => (
          module.disabled ? (
            <div
              key={module.name}
              className="block p-6 bg-gray-100 rounded-lg shadow border-t-4 border-gray-300 opacity-60 cursor-not-allowed"
            >
              <div className="flex items-center mb-4">
                <module.icon className="h-8 w-8 text-gray-400 mr-3" />
                <h3 className="text-lg font-semibold text-gray-500">{module.name}</h3>
              </div>
              <p className="text-sm text-gray-500">{module.description}</p>
              <p className="text-xs text-gray-400 mt-2">Coming soon...</p>
            </div>
          ) : (
            <Link
              key={module.name}
              to={module.path}
              className={`block p-6 bg-white rounded-lg shadow hover:shadow-lg transition-shadow border-t-4 border-${module.color}-500`}
            >
              <div className="flex items-center mb-4">
                <module.icon className={`h-8 w-8 text-${module.color}-600 mr-3`} />
                <h3 className="text-lg font-semibold text-gray-900">{module.name}</h3>
              </div>
              <p className="text-sm text-gray-600">{module.description}</p>
            </Link>
          )
        ))}
      </div>
    </div>
  );
};

export default SalesOrderManagement;
