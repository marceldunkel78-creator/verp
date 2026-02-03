import React from 'react';
import { Link } from 'react-router-dom';
import { 
  UsersIcon, CurrencyDollarIcon, CogIcon, BuildingOfficeIcon,
  BanknotesIcon, CircleStackIcon, BellIcon, TrashIcon
} from '@heroicons/react/24/outline';

const Settings = () => {
  const modules = [
    {
      name: 'Company Settings',
      description: 'Firmendaten, Adressen und Bankverbindungen',
      icon: BuildingOfficeIcon,
      path: '/settings/company-info',
      color: 'blue'
    },
    {
      name: 'Users',
      description: 'Benutzerverwaltung und Berechtigungen',
      icon: UsersIcon,
      path: '/settings/users',
      color: 'blue'
    },
    {
      name: 'Currency Exchange Rates',
      description: 'Wechselkurse und Währungseinstellungen',
      icon: CurrencyDollarIcon,
      path: '/settings/currency-exchange-rates',
      color: 'blue'
    },
    {
      name: 'Zahlungs- und Lieferbedingungen',
      description: 'Zahlungsbedingungen, Incoterms und Lieferanweisungen',
      icon: BanknotesIcon,
      path: '/settings/payment-delivery',
      color: 'green'
    },
    {
      name: 'Mitteilungen',
      description: 'Benachrichtigungen bei Statusänderungen konfigurieren',
      icon: BellIcon,
      path: '/settings/notifications',
      color: 'yellow'
    },
    {
      name: 'Backup & Restore',
      description: 'Datenbank sichern und wiederherstellen',
      icon: CircleStackIcon,
      path: '/settings/backup-restore',
      color: 'purple'
    },
    {
      name: 'Admin Löschmodul',
      description: 'Datenbankeinträge löschen (nur Super User)',
      icon: TrashIcon,
      path: '/settings/admin-delete',
      color: 'red',
      superUserOnly: true
    },
    {
      name: 'System',
      description: 'Systemeinstellungen und Konfiguration',
      icon: CogIcon,
      path: '/settings/system',
      color: 'blue',
      disabled: true
    }
  ];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
        <p className="mt-2 text-sm text-gray-600">
          Systemeinstellungen, Benutzer und Konfiguration
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

export default Settings;
