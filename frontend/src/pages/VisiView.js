import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  CubeIcon,
  KeyIcon,
  TicketIcon,
  CodeBracketIcon,
  ClockIcon,
  CogIcon,
  ComputerDesktopIcon
} from '@heroicons/react/24/outline';

const VisiView = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const allModules = [
    {
      name: 'Produkte',
      description: 'VisiView Produkte und Preise verwalten',
      icon: CubeIcon,
      color: 'bg-blue-500',
      path: '/visiview/products',
      permission: 'can_read_visiview_products'
    },
    {
      name: 'Lizenzen',
      description: 'VisiView Lizenzen und Optionen verwalten',
      icon: KeyIcon,
      color: 'bg-indigo-500',
      path: '/visiview/licenses',
      permission: 'can_read_visiview_licenses'
    },
    {
      name: 'Fertigungsaufträge',
      description: 'VisiView Fertigungsaufträge für Lizenzen',
      icon: CogIcon,
      color: 'bg-purple-500',
      path: '/visiview/production-orders',
      permission: 'can_read_visiview_production_orders'
    },
    {
      name: 'Tickets',
      description: 'Support-Tickets und Anfragen',
      icon: TicketIcon,
      color: 'bg-green-500',
      path: '/visiview/tickets',
      permission: 'can_read_visiview_tickets'
    },
    {
      name: 'Makros',
      description: 'VisiView Makros verwalten',
      icon: CodeBracketIcon,
      color: 'bg-yellow-500',
      path: '/visiview/macros',
      permission: 'can_read_visiview_macros'
    },
    {
      name: 'Maintenance',
      description: 'Maintenance-Zeitgutschriften verwalten',
      icon: ClockIcon,
      color: 'bg-orange-500',
      path: '/visiview/maintenance-time',
      permission: 'can_read_visiview_maintenance_time'
    },
    {
      name: 'Unterstützte Hardware',
      description: 'VisiView-kompatible Hardware verwalten',
      icon: ComputerDesktopIcon,
      color: 'bg-cyan-500',
      path: '/visiview/supported-hardware',
      permission: 'can_read_visiview_supported_hardware'
    }
  ];

  // Filtere Module basierend auf Benutzerberechtigungen
  const modules = allModules.filter(module => {
    if (!module.permission) return true;
    if (user?.is_superuser) return true;
    return user?.[module.permission] === true;
  });

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">VisiView</h1>
        <p className="mt-2 text-gray-600">
          Verwaltung von VisiView Produkten, Lizenzen und Support
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {modules.map((module) => (
          <div
            key={module.path}
            onClick={() => navigate(module.path)}
            className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow cursor-pointer p-6"
          >
            <div className="flex items-center mb-4">
              <div className={`${module.color} rounded-lg p-3`}>
                <module.icon className="h-6 w-6 text-white" />
              </div>
              <h3 className="ml-4 text-lg font-semibold text-gray-900">
                {module.name}
              </h3>
            </div>
            <p className="text-gray-600 text-sm">
              {module.description}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default VisiView;
