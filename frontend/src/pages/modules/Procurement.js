import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { TruckIcon, CubeIcon, ShoppingCartIcon, WrenchScrewdriverIcon, BeakerIcon, ArrowUturnLeftIcon, RectangleStackIcon } from '@heroicons/react/24/outline';

// Helper für Berechtigungsprüfung
const hasPermission = (user, permission) => {
  if (!permission) return true;
  if (user?.is_superuser) return true;
  return user?.[permission] === true;
};

const Procurement = () => {
  const { user } = useAuth();
  
  const modules = [
    {
      name: 'Suppliers',
      description: 'Lieferantenverwaltung und Kontakte',
      icon: TruckIcon,
      path: '/procurement/suppliers',
      color: 'blue',
      permission: 'can_read_suppliers',
    },
    {
      name: 'Trading Goods',
      description: 'Handelswaren und Preislisten',
      icon: CubeIcon,
      path: '/procurement/trading-goods',
      color: 'green',
      permission: 'can_read_trading',
    },
    {
      name: 'Warensammlungen',
      description: 'Produktbündel für Angebote verwalten',
      icon: RectangleStackIcon,
      path: '/procurement/product-collections',
      color: 'purple',
      permission: 'can_read_procurement_product_collections',
    },
    {
      name: 'Orders',
      description: 'Bestellungen und Bestellverwaltung',
      icon: ShoppingCartIcon,
      path: '/procurement/orders',
      color: 'indigo',
      disabled: false,
      permission: 'can_read_procurement_orders',
    },
    {
      name: 'Leihungen',
      description: 'Leihgeräte und -materialien verwalten',
      icon: ArrowUturnLeftIcon,
      path: '/procurement/loans',
      color: 'violet',
      permission: 'can_read_procurement_loans',
    },
    {
      name: 'M&S',
      description: 'Roh-, Hilfs- und Betriebsstoffe',
      icon: BeakerIcon,
      path: '/procurement/materials-supplies',
      color: 'amber',
      permission: 'can_read_material_supplies',
    }
  ];

  // Filter modules based on user permissions
  const filteredModules = modules.filter(m => hasPermission(user, m.permission));

  // helper: map color name to background and text classes
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
        <h1 className="text-3xl font-bold text-gray-900">Procurement</h1>
        <p className="mt-2 text-sm text-gray-600">Beschaffung, Lieferanten und Handelswaren</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredModules.map((module) => {
          const Icon = module.icon;
          const col = colorMap[module.color] || colorMap.blue;
          return module.disabled ? (
            <div
              key={module.name}
              className="block p-6 bg-gray-100 rounded-lg shadow opacity-60 cursor-not-allowed"
            >
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
            <Link
              key={module.name}
              to={module.path}
              className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow"
            >
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

export default Procurement;
