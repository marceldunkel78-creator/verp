import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { InboxArrowDownIcon, ArchiveBoxIcon, ClipboardDocumentListIcon, ArrowPathIcon, GiftIcon } from '@heroicons/react/24/outline';

const hasPermission = (user, permission) => {
  if (!permission) return true;
  if (user?.is_superuser) return true;
  return user?.[permission] === true;
};

const InventoryManagement = () => {
  const { user } = useAuth();

  const modules = [
    {
      name: 'Wareneingang',
      description: 'Eingehende Waren erfassen und ins Lager überführen',
      icon: InboxArrowDownIcon,
      path: '/inventory/goods-receipt',
      color: 'green'
    },
    {
      name: 'Warenlager',
      description: 'Lagerbestand verwalten und Artikel bearbeiten',
      icon: ArchiveBoxIcon,
      path: '/inventory/warehouse',
      color: 'violet'
    },
    {
      name: 'Verleihungen',
      description: 'Leihwaren an Kunden verwalten',
      icon: GiftIcon,
      path: '/inventory/customer-loans',
      color: 'orange',
    },
    {
      name: 'Bestandsübersicht',
      description: 'Aktuelle Lagerbestände und Verfügbarkeiten',
      icon: ClipboardDocumentListIcon,
      path: '/inventory/warehouse',
      color: 'violet',
      disabled: true
    },
    {
      name: 'Warenbewegungen',
      description: 'Ein- und Ausgänge, Transfers, Historie',
      icon: ArrowPathIcon,
      path: '/inventory/movements',
      color: 'violet',
      disabled: true
    }
  ];

  const filteredModules = modules.filter(m => {
    if (m.disabled) return true; // Show disabled as coming soon
    return hasPermission(user, m.permission);
  });

  const colorMap = {
    orange: { bg: 'bg-orange-100', text: 'text-orange-600' },
    purple: { bg: 'bg-purple-100', text: 'text-purple-600' },
    green: { bg: 'bg-green-100', text: 'text-green-600' },
    violet: { bg: 'bg-violet-100', text: 'text-violet-600' },
    blue: { bg: 'bg-blue-100', text: 'text-blue-600' },
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Inventory</h1>
        <p className="mt-2 text-sm text-gray-600">Lagerverwaltung, Bestände und Logistik</p>
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

export default InventoryManagement;
