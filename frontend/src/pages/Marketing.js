import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { 
  PlusIcon, 
  EnvelopeIcon, 
  DocumentTextIcon, 
  BookOpenIcon,
  PresentationChartBarIcon,
  AcademicCapIcon,
  CalendarIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
  ArrowDownTrayIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  DocumentDuplicateIcon
} from '@heroicons/react/24/outline';

const Marketing = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState(() => {
    return sessionStorage.getItem('marketingActiveTab') || 'newsletter';
  });
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [mergeOrder, setMergeOrder] = useState([]);
  const [merging, setMerging] = useState(false);

  const tabs = [
    { id: 'newsletter', name: 'Newsletter', icon: EnvelopeIcon },
    { id: 'appnote', name: 'AppNotes', icon: DocumentTextIcon },
    { id: 'technote', name: 'TechNotes', icon: DocumentTextIcon },
    { id: 'brochure', name: 'Broschüren', icon: BookOpenIcon },
    { id: 'show', name: 'Shows', icon: PresentationChartBarIcon },
    { id: 'workshop', name: 'Workshops', icon: AcademicCapIcon }
  ];

  // Persist active tab
  useEffect(() => {
    sessionStorage.setItem('marketingActiveTab', activeTab);
    setSelectedIds(new Set());
  }, [activeTab]);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      let url = `/sales/marketing-items/?category=${activeTab}`;
      if (debouncedSearch.trim()) {
        url += `&search=${encodeURIComponent(debouncedSearch.trim())}`;
      }
      const response = await api.get(url);
      setItems(response.data.results || response.data || []);
    } catch (error) {
      console.error('Fehler beim Laden der Marketing-Items:', error);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [activeTab, debouncedSearch]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

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
      setSelectedIds(prev => { const n = new Set(prev); n.delete(id); return n; });
      fetchItems();
    } catch (error) {
      console.error('Fehler beim Löschen:', error);
      alert('Fehler beim Löschen: ' + (error.response?.data?.detail || error.message));
    }
  };

  const isBrochureTab = activeTab === 'brochure';

  const toggleSelection = (id, e) => {
    e.stopPropagation();
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === items.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(items.map(i => i.id)));
    }
  };

  const openMergeModal = () => {
    const ordered = items.filter(i => selectedIds.has(i.id));
    setMergeOrder(ordered);
    setShowMergeModal(true);
  };

  const moveMergeItem = (index, direction) => {
    const newOrder = [...mergeOrder];
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= newOrder.length) return;
    [newOrder[index], newOrder[targetIndex]] = [newOrder[targetIndex], newOrder[index]];
    setMergeOrder(newOrder);
  };

  const handleMergeDownload = async () => {
    setMerging(true);
    try {
      const response = await api.post(
        '/sales/marketing-items/merge_brochure_pdfs/',
        { item_ids: mergeOrder.map(i => i.id) },
        { responseType: 'blob' }
      );
      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'Gesamtbroschuere.pdf');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      setShowMergeModal(false);
      setSelectedIds(new Set());
    } catch (error) {
      console.error('Fehler beim Erstellen der Gesamtbroschüre:', error);
      alert('Fehler beim Erstellen der Gesamtbroschüre: ' + (error.response?.data?.error || error.message));
    } finally {
      setMerging(false);
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
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex justify-between items-center">
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
          {/* Search */}
          <div className="mt-3 relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Nach Titel oder Beschreibung suchen..."
              className="block w-full pl-10 pr-10 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute inset-y-0 right-0 pr-3 flex items-center"
              >
                <XMarkIcon className="h-5 w-5 text-gray-400 hover:text-gray-600" />
              </button>
            )}
          </div>
          {/* Brochure selection bar */}
          {isBrochureTab && items.length > 0 && (
            <div className="mt-3 flex items-center justify-between bg-gray-50 rounded-md px-3 py-2">
              <label className="inline-flex items-center text-sm text-gray-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={items.length > 0 && selectedIds.size === items.length}
                  onChange={toggleSelectAll}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 mr-2"
                />
                Alle auswählen ({selectedIds.size}/{items.length})
              </label>
              {selectedIds.size >= 2 && (
                <button
                  onClick={openMergeModal}
                  className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700"
                >
                  <DocumentDuplicateIcon className="-ml-0.5 mr-1.5 h-4 w-4" />
                  Gesamtbroschüre erstellen ({selectedIds.size})
                </button>
              )}
            </div>
          )}
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
              {items.map(item => {
                // Find thumbnail from first file
                const thumbnailFile = item.files?.find(f => f.thumbnail_url);
                const thumbnailUrl = thumbnailFile?.thumbnail_url;
                return (
                <li
                  key={item.id}
                  onClick={() => handleItemClick(item.id)}
                  className={`py-4 hover:bg-gray-50 cursor-pointer transition-colors ${isBrochureTab && selectedIds.has(item.id) ? 'bg-blue-50' : ''}`}
                >
                  <div className="flex items-start justify-between">
                    {/* Checkbox for brochures */}
                    {isBrochureTab && (
                      <div className="flex-shrink-0 mr-3 pt-1">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(item.id)}
                          onChange={(e) => toggleSelection(item.id, e)}
                          onClick={(e) => e.stopPropagation()}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                        />
                      </div>
                    )}
                    {/* Thumbnail */}
                    {thumbnailUrl && (
                      <div className="flex-shrink-0 mr-4">
                        <img
                          src={thumbnailUrl}
                          alt={item.title}
                          className="w-24 h-24 rounded-lg object-cover border border-gray-200 shadow-sm"
                        />
                      </div>
                    )}
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
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* Merge / Reorder Modal */}
      {showMergeModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75" onClick={() => setShowMergeModal(false)} />
            <div className="relative bg-white rounded-lg shadow-xl max-w-lg w-full p-6 z-10">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">
                  Gesamtbroschüre erstellen
                </h3>
                <button onClick={() => setShowMergeModal(false)} className="text-gray-400 hover:text-gray-600">
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>
              <p className="text-sm text-gray-500 mb-4">
                Reihenfolge der Broschüren anpassen. Die PDFs werden in dieser Reihenfolge zusammengefügt.
              </p>
              <ul className="space-y-2 mb-6 max-h-96 overflow-y-auto">
                {mergeOrder.map((item, index) => {
                  const pdfCount = item.files?.filter(f => f.filename?.toLowerCase().endsWith('.pdf')).length || 0;
                  return (
                    <li key={item.id} className="flex items-center justify-between bg-gray-50 rounded-md px-3 py-2">
                      <div className="flex items-center min-w-0 flex-1">
                        <span className="text-sm font-medium text-gray-500 w-6">{index + 1}.</span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-gray-900 truncate">{item.title}</p>
                          <p className="text-xs text-gray-500">{pdfCount} PDF{pdfCount !== 1 ? 's' : ''}</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-1 ml-2">
                        <button
                          type="button"
                          onClick={() => moveMergeItem(index, -1)}
                          disabled={index === 0}
                          className="p-1 rounded hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <ChevronUpIcon className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveMergeItem(index, 1)}
                          disabled={index === mergeOrder.length - 1}
                          className="p-1 rounded hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <ChevronDownIcon className="h-4 w-4" />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setShowMergeModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                >
                  Abbrechen
                </button>
                <button
                  onClick={handleMergeDownload}
                  disabled={merging}
                  className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:opacity-50"
                >
                  <ArrowDownTrayIcon className="-ml-1 mr-2 h-4 w-4" />
                  {merging ? 'Wird erstellt...' : 'PDF herunterladen'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Marketing;
