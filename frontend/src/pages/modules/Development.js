import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { 
  BeakerIcon,
  ClipboardDocumentListIcon
} from '@heroicons/react/24/outline';

// Helper für Berechtigungsprüfung
const hasPermission = (user, permission) => {
  if (!permission) return true;
  if (user?.is_superuser) return true;
  return user?.[permission] === true;
};

const Development = () => {
  const { user } = useAuth();
  
  const submodules = [
    {
      to: '/development/projects',
      icon: BeakerIcon,
      iconBg: 'bg-purple-100',
      iconColor: 'text-purple-600',
      title: 'Entwicklungsprojekte',
      description: 'Projekte verwalten und nachverfolgen',
      permission: 'can_read_development_projects',
    },
  ];
  
  const filteredSubmodules = submodules.filter(sm => hasPermission(user, sm.permission));
  
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Entwicklung</h1>
        <p className="text-gray-500">Entwicklungsprojekte und R&D Management</p>
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
        {/* Future modules placeholder */}
        <div className="bg-white rounded-lg shadow p-6 opacity-50">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gray-100 rounded-lg">
              <ClipboardDocumentListIcon className="h-8 w-8 text-gray-400" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-500">Weitere Module</h3>
              <p className="text-sm text-gray-400">Demnächst verfügbar</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Development;
