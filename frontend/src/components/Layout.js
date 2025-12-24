import React, { useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  Bars3Icon,
  XMarkIcon,
  HomeIcon,
  TruckIcon,
  CogIcon,
  ArrowRightOnRectangleIcon,
  BanknotesIcon,
  CubeIcon,
  ShoppingCartIcon,
  UserGroupIcon,
  WrenchScrewdriverIcon,
  EyeIcon,
  ClipboardDocumentCheckIcon,
  ChartBarIcon,
  DocumentDuplicateIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';

const Layout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, logout } = useAuth();
  const location = useLocation();

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: HomeIcon },
    { name: 'MyVERP', href: '/myverp', icon: ClockIcon },
    { name: 'Finance', href: '/finance', icon: BanknotesIcon },
    { name: 'Procurement', href: '/procurement', icon: TruckIcon },
    { name: 'Inventory', href: '/inventory', icon: CubeIcon },
    { name: 'Sales/Orders', href: '/sales', icon: ShoppingCartIcon },
    { name: 'HR', href: '/hr', icon: UserGroupIcon },
    { name: 'Manufacturing', href: '/manufacturing', icon: WrenchScrewdriverIcon },
    { name: 'VisiView', href: '/visiview', icon: EyeIcon },
    { name: 'Service', href: '/service', icon: ClipboardDocumentCheckIcon },
    { name: 'BI', href: '/bi', icon: ChartBarIcon },
    { name: 'Documents', href: '/documents', icon: DocumentDuplicateIcon },
    { name: 'Settings', href: '/settings', icon: CogIcon },
  ];

  const filteredNavigation = navigation.filter((item) => {
    if (item.adminOnly && !user?.is_staff) return false;
    if (item.settingsOnly && !(user?.can_read_settings || user?.is_superuser)) return false;
    return true;
  });

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Mobile Sidebar */}
      <div className={`fixed inset-0 z-40 lg:hidden ${sidebarOpen ? '' : 'hidden'}`}>
        <div className="fixed inset-0 bg-gray-600 bg-opacity-75" onClick={() => setSidebarOpen(false)} />
        <div className="fixed inset-y-0 left-0 flex flex-col w-64 bg-white">
          <div className="flex items-center justify-between h-16 px-4 bg-blue-600">
            <span className="text-2xl font-bold text-white">VERP</span>
            <button
              onClick={() => setSidebarOpen(false)}
              className="text-white hover:text-gray-200"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>
          <nav className="flex-1 px-2 py-4 space-y-1">
            {filteredNavigation.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center px-4 py-3 text-sm font-medium rounded-lg ${
                    isActive
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <Icon className="h-5 w-5 mr-3" />
                  {item.name}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Desktop Sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col">
        <div className="flex flex-col flex-grow bg-white border-r border-gray-200">
          <div className="flex items-center h-16 px-4 bg-blue-600">
            <span className="text-2xl font-bold text-white">VERP</span>
          </div>
          <nav className="flex-1 px-2 py-4 space-y-1">
            {filteredNavigation.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`flex items-center px-4 py-3 text-sm font-medium rounded-lg ${
                    isActive
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <Icon className="h-5 w-5 mr-3" />
                  {item.name}
                </Link>
              );
            })}
          </nav>
          <div className="p-4 border-t border-gray-200">
            <div className="flex items-center">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">
                  {user?.first_name} {user?.last_name}
                </p>
                <p className="text-xs text-gray-500">{user?.email}</p>
              </div>
              <button
                onClick={logout}
                className="p-2 text-gray-500 hover:text-red-600"
                title="Abmelden"
              >
                <ArrowRightOnRectangleIcon className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="lg:pl-64 flex flex-col flex-1">
        {/* Top Bar */}
        <div className="sticky top-0 z-10 flex h-16 bg-white border-b border-gray-200 lg:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="px-4 text-gray-500 focus:outline-none"
          >
            <Bars3Icon className="h-6 w-6" />
          </button>
          <div className="flex items-center flex-1 px-4">
            <span className="text-xl font-bold text-blue-600">VERP</span>
          </div>
        </div>

        {/* Page Content */}
        <main className="flex-1">
          <div className="py-6">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <Outlet />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Layout;
