import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  InboxArrowDownIcon,
  ArchiveBoxIcon,
  ArrowRightIcon
} from '@heroicons/react/24/outline';

const InventoryManagement = () => {
  const navigate = useNavigate();

  const modules = [
    {
      title: 'Wareneingang & Lager',
      description: 'Verwalten Sie Wareneingänge und Lagerbestand',
      icon: ArchiveBoxIcon,
      path: '/inventory/warehouse',
      color: 'blue'
    }
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Inventory Management</h1>
        <p className="mt-2 text-sm text-gray-600">
          Lagerverwaltung, Bestände und Logistik
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {modules.map((module, index) => {
          const Icon = module.icon;
          const colorClasses = {
            blue: 'bg-blue-50 text-blue-600 hover:bg-blue-100',
            green: 'bg-green-50 text-green-600 hover:bg-green-100',
            purple: 'bg-purple-50 text-purple-600 hover:bg-purple-100'
          };

          return (
            <div
              key={index}
              onClick={() => navigate(module.path)}
              className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow duration-200 cursor-pointer p-6 border border-gray-200"
            >
              <div className="flex items-start justify-between">
                <div className={`p-3 rounded-lg ${colorClasses[module.color]}`}>
                  <Icon className="h-6 w-6" />
                </div>
              </div>
              <h3 className="mt-4 text-lg font-semibold text-gray-900">
                {module.title}
              </h3>
              <p className="mt-2 text-sm text-gray-600">
                {module.description}
              </p>
              <div className="mt-4 flex items-center text-sm font-medium text-blue-600">
                Öffnen
                <ArrowRightIcon className="ml-1 h-4 w-4" />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default InventoryManagement;
