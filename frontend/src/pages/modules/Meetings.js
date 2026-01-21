import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { 
  CalendarIcon, 
  CurrencyEuroIcon, 
  EyeIcon 
} from '@heroicons/react/24/outline';

// Helper für Berechtigungsprüfung
const hasPermission = (user, permission) => {
  if (!permission) return true;
  if (user?.is_superuser) return true;
  return user?.[permission] === true;
};

const Meetings = () => {
  const { user } = useAuth();
  
  const submodules = [
    {
      to: '/meetings/monday',
      icon: CalendarIcon,
      iconBg: 'bg-blue-100',
      iconColor: 'text-blue-600',
      title: 'Montagsmeeting',
      description: 'Wöchentliche Auftragsübersicht und Todos',
      permission: 'can_read_meetings',
    },
    {
      to: '/meetings/sales',
      icon: CurrencyEuroIcon,
      iconBg: 'bg-green-100',
      iconColor: 'text-green-600',
      title: 'Vertriebsmeeting',
      description: 'Vertriebsaufgaben und History',
      permission: 'can_read_meetings',
    },
    {
      to: '/meetings/visiview',
      icon: EyeIcon,
      iconBg: 'bg-purple-100',
      iconColor: 'text-purple-600',
      title: 'VisiView-Meeting',
      description: 'VisiView Tickets und Entwicklungsaufgaben',
      permission: 'can_read_meetings',
    },
  ];
  
  const filteredSubmodules = submodules.filter(sm => hasPermission(user, sm.permission));
  
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Meetings</h1>
        <p className="text-gray-500">Regelmäßige Team-Meetings und Aufgabenverwaltung</p>
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

export default Meetings;
