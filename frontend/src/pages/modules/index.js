import React from 'react';
import { Link } from 'react-router-dom';
import ComingSoon from './ComingSoon';
import EmployeeList from '../EmployeeList';
import InventoryManagementModule from './InventoryManagement';
import { 
  CpuChipIcon, 
  ClipboardDocumentListIcon,
  CubeIcon,
  KeyIcon,
  TicketIcon,
  WrenchScrewdriverIcon,
  ArrowPathIcon,
  DocumentTextIcon
} from '@heroicons/react/24/outline';

export const InventoryManagement = () => <InventoryManagementModule />;

// SalesOrderManagement is now imported directly from its own file

export const HumanResources = () => <EmployeeList />;

export const Manufacturing = () => (
  <div className="space-y-6">
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Fertigung</h1>
      <p className="text-gray-500">Manufacturing und Produktion</p>
    </div>
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <Link
        to="/manufacturing/vs-hardware"
        className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow"
      >
        <div className="flex items-center gap-4">
          <div className="p-3 bg-blue-100 rounded-lg">
            <CpuChipIcon className="h-8 w-8 text-blue-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">VS-Hardware</h3>
            <p className="text-sm text-gray-500">Eigenprodukte verwalten</p>
          </div>
        </div>
      </Link>
      <Link
        to="/manufacturing/production-orders"
        className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow"
      >
        <div className="flex items-center gap-4">
          <div className="p-3 bg-green-100 rounded-lg">
            <ClipboardDocumentListIcon className="h-8 w-8 text-green-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">Fertigungsaufträge</h3>
            <p className="text-sm text-gray-500">Auftragseingang und Produktion</p>
          </div>
        </div>
      </Link>
    </div>
  </div>
);

export const VisiView = () => (
  <div className="space-y-6">
    <div>
      <h1 className="text-2xl font-bold text-gray-900">VisiView</h1>
      <p className="text-gray-500">VisiView Verwaltung und Konfiguration</p>
    </div>
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <Link
        to="/visiview/products"
        className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow"
      >
        <div className="flex items-center gap-4">
          <div className="p-3 bg-blue-100 rounded-lg">
            <CubeIcon className="h-8 w-8 text-blue-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">VisiView Produkte</h3>
            <p className="text-sm text-gray-500">Software-Produkte verwalten</p>
          </div>
        </div>
      </Link>
      <Link
        to="/visiview/licenses"
        className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow"
      >
        <div className="flex items-center gap-4">
          <div className="p-3 bg-purple-100 rounded-lg">
            <KeyIcon className="h-8 w-8 text-purple-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">Lizenzverwaltung</h3>
            <p className="text-sm text-gray-500">VisiView Lizenzen verwalten</p>
          </div>
        </div>
      </Link>
      <div
        className="bg-white rounded-lg shadow p-6 opacity-60 cursor-not-allowed"
      >
        <div className="flex items-center gap-4">
          <div className="p-3 bg-gray-100 rounded-lg">
            <TicketIcon className="h-8 w-8 text-gray-400" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-500">Ticket-System</h3>
            <p className="text-sm text-gray-400">Bugs & Feature Requests</p>
          </div>
        </div>
      </div>
    </div>
  </div>
);

export const Service = () => (
  <div className="space-y-6">
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Service</h1>
      <p className="text-gray-500">Kundenservice, Support und Reparaturverwaltung</p>
    </div>
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <Link
        to="/service/vs-service"
        className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow"
      >
        <div className="flex items-center gap-4">
          <div className="p-3 bg-green-100 rounded-lg">
            <WrenchScrewdriverIcon className="h-8 w-8 text-green-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">VS-Service Produkte</h3>
            <p className="text-sm text-gray-500">Service- und Dienstleistungen</p>
          </div>
        </div>
      </Link>
      <Link
        to="/service/tickets"
        className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow"
      >
        <div className="flex items-center gap-4">
          <div className="p-3 bg-blue-100 rounded-lg">
            <DocumentTextIcon className="h-8 w-8 text-blue-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">Service-Tickets</h3>
            <p className="text-sm text-gray-500">Anfragen & Support</p>
          </div>
        </div>
      </Link>
      <Link
        to="/service/rma"
        className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow"
      >
        <div className="flex items-center gap-4">
          <div className="p-3 bg-orange-100 rounded-lg">
            <ArrowPathIcon className="h-8 w-8 text-orange-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">RMA-Verwaltung</h3>
            <p className="text-sm text-gray-500">Rücksendungen & Reparaturen</p>
          </div>
        </div>
      </Link>
    </div>
  </div>
);

export const BusinessIntelligence = () => (
  <ComingSoon 
    moduleName="Business Intelligence" 
    description="Analysen, Reports und Dashboards"
  />
);

export const DocumentManagement = () => (
  <ComingSoon 
    moduleName="Document Management" 
    description="Dokumentenverwaltung und Archivierung"
  />
);
