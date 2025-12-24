import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import api from '../services/api';

const ProjectEdit = () => {
  const { id } = useParams();
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('basisinformationen');

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
    fetchProject();
  }, [id]);

  const fetchProject = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/projects/projects/${id}/`);
      setProject(response.data);
    } catch (error) {
      console.error('Error fetching project:', error);
    } finally {
      setLoading(false);
    }
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
            onClick={() => window.location.href = '/projects'}
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
              <h2 className="text-xl font-bold mb-4">Basisinformationen</h2>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Projektnummer</label>
                  <p className="text-gray-900">{project.project_number}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <p className="text-gray-900">{project.status_display}</p>
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
                {project.systems_data && project.systems_data.length > 0 && (
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
                )}
                {project.description && (
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Beschreibung</label>
                    <p className="text-gray-900 whitespace-pre-wrap">{project.description}</p>
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
