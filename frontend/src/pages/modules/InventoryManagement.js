import React from 'react';
import { Link } from 'react-router-dom';
import { InboxArrowDownIcon, ArchiveBoxIcon, ClipboardDocumentListIcon, ArrowPathIcon } from '@heroicons/react/24/outline';

const InventoryManagement = () => {
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

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Inventory</h1>
        <p className="mt-2 text-sm text-gray-600">
          Lagerverwaltung, Bestände und Logistik
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

export default InventoryManagement;
