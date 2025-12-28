import React from 'react';
import { Link } from 'react-router-dom';
import ComingSoon from './ComingSoon';
import EmployeeList from '../EmployeeList';
import InventoryManagementModule from './InventoryManagement';
import { CpuChipIcon, ClipboardDocumentListIcon } from '@heroicons/react/24/outline';

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
  <ComingSoon 
    moduleName="VisiView" 
    description="VisiView Verwaltung und Konfiguration"
  />
);

export const Service = () => (
  <ComingSoon 
    moduleName="Service" 
    description="Kundenservice und Support"
  />
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
