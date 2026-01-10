import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import api from '../services/api';
import SystemSearch from '../components/SystemSearch';

const ProjectEdit = () => {
  const { id } = useParams();
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('basisinformationen');
  const [isEditing, setIsEditing] = useState(false);
  const [editedProject, setEditedProject] = useState({});

  const statusOptions = [
    { value: 'NEU', label: 'Neu' },
    { value: 'IN_BEARBEITUNG', label: 'In Bearbeitung' },
    { value: 'ANGEBOT_ERSTELLT', label: 'Angebot erstellt' },
    { value: 'DEMO_GEPLANT', label: 'Demo geplant' },
    { value: 'AUSSCHREIBUNG', label: 'Ausschreibung' },
    { value: 'AUFTRAG_ERTEILT', label: 'Auftrag erteilt' },
    { value: 'IN_FERTIGUNG', label: 'In Fertigung' },
    { value: 'LIEFERUNG', label: 'Lieferung' },
    { value: 'INSTALLATION', label: 'Installation' },
    { value: 'ABGESCHLOSSEN', label: 'Abgeschlossen' },
    { value: 'STORNIERT', label: 'Storniert' }
  ];

  const tabs = [
    { id: 'basisinformationen', label: 'Basisinformationen' },
    { id: 'kommunikation', label: 'Kommunikation' },
    { id: 'angebote', label: 'Angebote' },
    { id: 'demoplanung', label: 'Demoplanung' },
    { id: 'ausschreibung', label: 'Ausschreibung' },
    { id: 'auftragsabwicklung', label: 'Auftragsabwicklung' },
    { id: 'fertigung', label: 'Fertigung' },
    { id: 'lieferung', label: 'Lieferung' },
    { id: 'installation', label: 'Installation' }
  ];

  useEffect(() => {
    if (!id || id === 'new') {
      // If id is missing or we're creating a new project, don't attempt to fetch
      setLoading(false);
      return;
    }
    fetchProject();
  }, [id]);

  const [customerSystems, setCustomerSystems] = useState([]);

  const fetchCustomerSystems = async (customerId) => {
    try {
      const response = await api.get(`/customers/customers/${customerId}/systems/`);
      setCustomerSystems(response.data);
    } catch (error) {
      console.error('Error fetching customer systems:', error);
      setCustomerSystems([]);
    }
  };

  const fetchProject = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/projects/projects/${id}/`);
      setProject(response.data);
      // Normalize systems into editedProject for editing mode
      const initial = response.data;
      setEditedProject({
        ...initial,
        systems: initial.systems || (initial.systems_data ? initial.systems_data.map(s => s.id) : [])
      });
      if (initial.customer) {
        fetchCustomerSystems(initial.customer);
      }
    } catch (error) {
      console.error('Error fetching project:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditedProject(project);
  };

  const handleSave = async () => {
    try {
      // Build payload and only include fields that are present
      const payload = {
        status: editedProject.status,
        forecast_date: editedProject.forecast_date,
        forecast_revenue: editedProject.forecast_revenue,
        forecast_probability: editedProject.forecast_probability
      };

      if (editedProject.systems && editedProject.systems.length > 0) {
        payload.systems = editedProject.systems;
      }

      const response = await api.patch(`/projects/projects/${id}/`, payload);
      setProject(response.data);
      // Re-normalize systems for editedProject
      const updated = response.data;
      setEditedProject({
        ...updated,
        systems: updated.systems || (updated.systems_data ? updated.systems_data.map(s => s.id) : [])
      });
      setIsEditing(false);
      
      // Reload customer systems if customer changed
      if (updated.customer) {
        fetchCustomerSystems(updated.customer);
      }
      
      alert('Projekt erfolgreich aktualisiert');
    } catch (error) {
      console.error('Error updating project:', error);
      alert('Fehler beim Aktualisieren des Projekts');
    }
  };

  const handleInputChange = (field, value) => {
    setEditedProject(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const getStatusColor = (status) => {
    const colors = {
      'NEU': 'bg-green-100 text-green-800',
      'IN_BEARBEITUNG': 'bg-blue-100 text-blue-800',
      'ANGEBOT_ERSTELLT': 'bg-yellow-100 text-yellow-800',
      'DEMO_GEPLANT': 'bg-purple-100 text-purple-800',
      'AUSSCHREIBUNG': 'bg-orange-100 text-orange-800',
      'AUFTRAG_ERTEILT': 'bg-indigo-100 text-indigo-800',
      'IN_FERTIGUNG': 'bg-cyan-100 text-cyan-800',
      'LIEFERUNG': 'bg-teal-100 text-teal-800',
      'INSTALLATION': 'bg-lime-100 text-lime-800',
      'ABGESCHLOSSEN': 'bg-gray-100 text-gray-800',
      'STORNIERT': 'bg-red-100 text-red-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  if (loading) {
    return <div className="container mx-auto px-4 py-8">Laden...</div>;
  }

  if (!project) {
    return <div className="container mx-auto px-4 py-8">Projekt nicht gefunden</div>;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header mit Projektinformationen */}
      <div className="bg-white shadow-md rounded-lg p-6 mb-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-4 mb-2">
              <h1 className="text-2xl font-bold">{project.project_number}</h1>
              <span className={`px-3 py-1 text-sm rounded-full ${getStatusColor(project.status)}`}>
                {project.status_display}
              </span>
            </div>
            <div className="text-gray-600 space-y-1">
              <p className="text-lg font-medium">{project.customer_name}</p>
              {project.name && <p className="text-gray-700">{project.name}</p>}
              {project.description && (
                <p className="text-sm text-gray-600 mt-2">{project.description}</p>
              )}
              {project.systems_data && project.systems_data.length > 0 && (
                <div className="mt-2">
                  <span className="text-sm font-medium">Systeme: </span>
                  <span className="text-sm">
                    {project.systems_data.map(sys => sys.system_number).join(', ')}
                  </span>
                </div>
              )}
            </div>
          </div>
          <button
            onClick={() => window.location.href = '/sales/projects'}
            className="px-4 py-2 border rounded hover:bg-gray-50"
          >
            Zurück zur Liste
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white shadow-md rounded-lg overflow-hidden">
        <div className="border-b border-gray-200">
          <nav className="flex overflow-x-auto">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-6 py-3 text-sm font-medium whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'border-b-2 border-blue-500 text-blue-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {activeTab === 'basisinformationen' && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold">Basisinformationen</h2>
                {!isEditing ? (
                  <button
                    onClick={handleEdit}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    Bearbeiten
                  </button>
                ) : (
                  <div className="space-x-2">
                    <button
                      onClick={handleSave}
                      className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                    >
                      Speichern
                    </button>
                    <button
                      onClick={handleCancel}
                      className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
                    >
                      Abbrechen
                    </button>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Projektnummer</label>
                  <p className="text-gray-900">{project.project_number}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  {isEditing ? (
                    <select
                      value={editedProject.status || ''}
                      onChange={(e) => handleInputChange('status', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-blue-500"
                    >
                      {statusOptions.map(option => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <p className="text-gray-900">{project.status_display}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Kunde</label>
                  <p className="text-gray-900">{project.customer_name}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Erstellt am</label>
                  <p className="text-gray-900">
                    {new Date(project.created_at).toLocaleDateString('de-DE')}
                  </p>
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Projektname</label>
                  <p className="text-gray-900">{project.name || '-'}</p>
                </div>
                {isEditing ? (
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Systemauswahl</label>
                    <SystemSearch
                      customerId={project.customer}
                      selectedSystems={editedProject.systems || []}
                      onChange={(systemIds) => setEditedProject(prev => ({ ...prev, systems: systemIds }))}
                    />
                  </div>
                ) : (
                  project.systems_data && project.systems_data.length > 0 && (
                    <div className="col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Zugeordnete Systeme</label>
                      <div className="space-y-2">
                        {project.systems_data.map(sys => (
                          <div key={sys.id} className="bg-gray-50 p-3 rounded">
                            <p className="font-medium">{sys.system_number}</p>
                            <p className="text-sm text-gray-600">{sys.name}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                )}
                {project.description && (
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Beschreibung</label>
                    <p className="text-gray-900 whitespace-pre-wrap">{project.description}</p>
                  </div>
                )}
              </div>

              {/* Forecast Abschnitt */}
              <div className="mt-8 pt-8 border-t border-gray-200">
                <h3 className="text-lg font-semibold mb-4 text-blue-600">📊 Forecast / Prognose</h3>
                <div className="grid grid-cols-3 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Erwartetes Auftragsdatum
                    </label>
                    {isEditing ? (
                      <input
                        type="date"
                        value={editedProject.forecast_date || ''}
                        onChange={(e) => handleInputChange('forecast_date', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-blue-500"
                      />
                    ) : (
                      <p className="text-gray-900">
                        {project.forecast_date ? new Date(project.forecast_date).toLocaleDateString('de-DE') : '-'}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Erwarteter Umsatz (€)
                    </label>
                    {isEditing ? (
                      <input
                        type="number"
                        step="0.01"
                        value={editedProject.forecast_revenue || ''}
                        onChange={(e) => handleInputChange('forecast_revenue', e.target.value)}
                        placeholder="0.00"
                        className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-blue-500"
                      />
                    ) : (
                      <p className="text-gray-900">
                        {project.forecast_revenue 
                          ? Number(project.forecast_revenue).toLocaleString('de-DE', {
                              style: 'currency',
                              currency: 'EUR'
                            })
                          : '-'}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Wahrscheinlichkeit (%)
                    </label>
                    {isEditing ? (
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={editedProject.forecast_probability || ''}
                        onChange={(e) => handleInputChange('forecast_probability', e.target.value)}
                        placeholder="0-100"
                        className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-blue-500"
                      />
                    ) : (
                      <p className="text-gray-900">
                        {project.forecast_probability !== null && project.forecast_probability !== undefined
                          ? `${project.forecast_probability}%`
                          : '-'}
                      </p>
                    )}
                  </div>
                </div>
                {!isEditing && project.forecast_revenue && project.forecast_probability && (
                  <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                    <p className="text-sm text-gray-700">
                      <span className="font-semibold">Gewichteter Forecast:</span>{' '}
                      {(Number(project.forecast_revenue) * Number(project.forecast_probability) / 100).toLocaleString('de-DE', {
                        style: 'currency',
                        currency: 'EUR'
                      })}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'kommunikation' && (
            <div>
              <h2 className="text-xl font-bold mb-4">Kommunikation</h2>
              <p className="text-gray-500">Kommunikationsmodul wird noch entwickelt...</p>
            </div>
          )}

          {activeTab === 'angebote' && (
            <div>
              <h2 className="text-xl font-bold mb-4">Angebote</h2>
              <p className="text-gray-500">Angebote-Modul wird noch entwickelt...</p>
            </div>
          )}

          {activeTab === 'demoplanung' && (
            <div>
              <h2 className="text-xl font-bold mb-4">Demoplanung</h2>
              <p className="text-gray-500">Demoplanung-Modul wird noch entwickelt...</p>
            </div>
          )}

          {activeTab === 'ausschreibung' && (
            <div>
              <h2 className="text-xl font-bold mb-4">Ausschreibung</h2>
              <p className="text-gray-500">Ausschreibung-Modul wird noch entwickelt...</p>
            </div>
          )}

          {activeTab === 'auftragsabwicklung' && (
            <div>
              <h2 className="text-xl font-bold mb-4">Auftragsabwicklung</h2>
              <p className="text-gray-500">Auftragsabwicklung-Modul wird noch entwickelt...</p>
            </div>
          )}

          {activeTab === 'fertigung' && (
            <div>
              <h2 className="text-xl font-bold mb-4">Fertigung</h2>
              <p className="text-gray-500">Fertigungs-Modul wird noch entwickelt...</p>
            </div>
          )}

          {activeTab === 'lieferung' && (
            <div>
              <h2 className="text-xl font-bold mb-4">Lieferung</h2>
              <p className="text-gray-500">Lieferungs-Modul wird noch entwickelt...</p>
            </div>
          )}

          {activeTab === 'installation' && (
            <div>
              <h2 className="text-xl font-bold mb-4">Installation</h2>
              <p className="text-gray-500">Installations-Modul wird noch entwickelt...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProjectEdit;
