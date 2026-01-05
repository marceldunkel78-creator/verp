import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { 
  PlusIcon, 
  EnvelopeIcon, 
  DocumentTextIcon, 
  BookOpenIcon,
  PresentationChartBarIcon,
  AcademicCapIcon,
  CalendarIcon
} from '@heroicons/react/24/outline';

const Marketing = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('newsletter');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  const tabs = [
    { id: 'newsletter', name: 'Newsletter', icon: EnvelopeIcon },
    { id: 'appnote', name: 'AppNotes', icon: DocumentTextIcon },
    { id: 'technote', name: 'TechNotes', icon: DocumentTextIcon },
    { id: 'brochure', name: 'Broschüren', icon: BookOpenIcon },
    { id: 'show', name: 'Shows', icon: PresentationChartBarIcon },
    { id: 'workshop', name: 'Workshops', icon: AcademicCapIcon }
  ];

  useEffect(() => {
    fetchItems();
  }, [activeTab]);

  const fetchItems = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/sales/marketing-items/?category=${activeTab}`);
      setItems(response.data.results || response.data || []);
    } catch (error) {
      console.error('Fehler beim Laden der Marketing-Items:', error);
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNew = () => {
    navigate(`/sales/marketing/new?category=${activeTab}`);
  };

  const handleItemClick = (id) => {
    navigate(`/sales/marketing/${id}`);
  };

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm('Dieses Marketing-Material wirklich löschen?')) return;
    
    try {
      await api.delete(`/sales/marketing-items/${id}/`);
      fetchItems();
    } catch (error) {
      console.error('Fehler beim Löschen:', error);
      alert('Fehler beim Löschen: ' + (error.response?.data?.detail || error.message));
    }
  };

  return (
    <div className="px-4 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="sm:flex sm:items-center sm:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Marketing</h1>
          <p className="mt-2 text-sm text-gray-700">
            Verwalten Sie Newsletter, AppNotes, TechNotes, Broschüren, Shows und Workshops
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8 overflow-x-auto">
          {tabs.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  group inline-flex items-center py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap
                  ${activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }
                `}
              >
                <Icon className={`-ml-0.5 mr-2 h-5 w-5 ${activeTab === tab.id ? 'text-blue-500' : 'text-gray-400 group-hover:text-gray-500'}`} />
                {tab.name}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Content */}
      <div className="bg-white shadow rounded-lg">
        {/* Action Bar */}
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <h2 className="text-lg font-medium text-gray-900">
            {tabs.find(t => t.id === activeTab)?.name}
          </h2>
          <button
            onClick={handleCreateNew}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
          >
            <PlusIcon className="-ml-1 mr-2 h-5 w-5" />
            Neu hinzufügen
          </button>
        </div>

        {/* Items List */}
        <div className="px-6 py-4">
          {loading ? (
            <div className="flex justify-center items-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-gray-400">
                {tabs.find(t => t.id === activeTab)?.icon && 
                  React.createElement(tabs.find(t => t.id === activeTab).icon, { className: "mx-auto h-12 w-12 mb-4" })
                }
              </div>
              <p className="text-gray-500">Keine Einträge vorhanden</p>
              <button
                onClick={handleCreateNew}
                className="mt-4 text-blue-600 hover:text-blue-800"
              >
                Ersten Eintrag erstellen
              </button>
            </div>
          ) : (
            <ul className="divide-y divide-gray-200">
              {items.map(item => (
                <li
                  key={item.id}
                  onClick={() => handleItemClick(item.id)}
                  className="py-4 hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-3">
                        <h3 className="text-lg font-medium text-gray-900 truncate">
                          {item.title}
                        </h3>
                        {item.is_event && item.event_date && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                            <CalendarIcon className="mr-1 h-3 w-3" />
                            {new Date(item.event_date).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                      
                      {item.description && (
                        <p className="mt-1 text-sm text-gray-500 line-clamp-2">
                          {item.description}
                        </p>
                      )}
                      
                      <div className="mt-2 flex items-center space-x-4 text-sm text-gray-500">
                        {item.responsible_employees_data && item.responsible_employees_data.length > 0 && (
                          <div className="flex items-center">
                            <span className="font-medium">Zuständig:</span>
                            <span className="ml-1">
                              {item.responsible_employees_data.map(emp => emp.full_name).join(', ')}
                            </span>
                          </div>
                        )}
                        
                        {item.is_event && item.event_location && (
                          <div className="flex items-center">
                            <span className="font-medium">Ort:</span>
                            <span className="ml-1">{item.event_location}</span>
                          </div>
                        )}
                        
                        {item.files && item.files.length > 0 && (
                          <div className="flex items-center">
                            <DocumentTextIcon className="h-4 w-4 mr-1" />
                            <span>{item.files.length} Datei(en)</span>
                          </div>
                        )}
                      </div>
                      
                      <div className="mt-1 text-xs text-gray-400">
                        Erstellt am {new Date(item.created_at).toLocaleDateString()}
                        {item.created_by_name && ` von ${item.created_by_name}`}
                      </div>
                    </div>
                    
                    <button
                      onClick={(e) => handleDelete(item.id, e)}
                      className="ml-4 text-red-600 hover:text-red-800"
                    >
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

export default Marketing;
