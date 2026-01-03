import React from 'react';
import { Link } from 'react-router-dom';
import { TruckIcon, CubeIcon, ShoppingCartIcon, WrenchScrewdriverIcon, BeakerIcon, ArrowUturnLeftIcon, RectangleStackIcon } from '@heroicons/react/24/outline';

const Procurement = () => {
  const modules = [
    {
      name: 'Suppliers',
      description: 'Lieferantenverwaltung und Kontakte',
      icon: TruckIcon,
      path: '/procurement/suppliers',
      color: 'orange'
    },
    {
      name: 'Trading Goods',
      description: 'Handelswaren und Preislisten',
      icon: CubeIcon,
      path: '/procurement/trading-goods',
      color: 'orange'
    },
    {
      name: 'Warensammlungen',
      description: 'Produktbündel für Angebote verwalten',
      icon: RectangleStackIcon,
      path: '/procurement/product-collections',
      color: 'orange'
    },
    {
      name: 'Orders',
      description: 'Bestellungen und Bestellverwaltung',
      icon: ShoppingCartIcon,
      path: '/procurement/orders',
      color: 'orange',
      disabled: false
    },
    {
      name: 'Leihungen',
      description: 'Leihgeräte und -materialien verwalten',
      icon: ArrowUturnLeftIcon,
      path: '/procurement/loans',
      color: 'purple'
    },
    {
      name: 'M&S',
      description: 'Roh-, Hilfs- und Betriebsstoffe',
      icon: BeakerIcon,
      path: '/procurement/materials-supplies',
      color: 'green'
    }
  ];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Procurement</h1>
        <p className="mt-2 text-sm text-gray-600">
          Beschaffung, Lieferanten und Handelswaren
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

export default Procurement;
