import React from 'react';
import ComingSoon from './ComingSoon';

export const InventoryManagement = () => (
  <ComingSoon 
    moduleName="Inventory Management" 
    description="Lagerverwaltung, Bestände und Logistik"
  />
);

// SalesOrderManagement is now imported directly from its own file

export const HumanResources = () => (
  <ComingSoon 
    moduleName="Human Resources" 
    description="Personalverwaltung und Zeiterfassung"
  />
);

export const Manufacturing = () => (
  <ComingSoon 
    moduleName="Manufacturing" 
    description="Fertigung und Produktion"
  />
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
