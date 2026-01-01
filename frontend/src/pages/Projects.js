import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../services/api';

const Projects = () => {
  const [searchParams] = useSearchParams();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [customerSystems, setCustomerSystems] = useState([]);
  const [newProject, setNewProject] = useState({
    name: '',
    customer: '',
    systems: [],
    linked_system: '',
    description: ''
  });

  // Check for customer URL parameter on mount
  useEffect(() => {
    const urlCustomerId = searchParams.get('customer');
    const urlSystemId = searchParams.get('system');
    if (urlCustomerId) {
      // Pre-fill customer and open create modal
      setSelectedCustomer(urlCustomerId);
      setNewProject(prev => ({ 
        ...prev, 
        customer: urlCustomerId,
        linked_system: urlSystemId || ''
      }));
      setShowCreateModal(true);
      // Fetch systems for this customer
      fetchCustomerSystems(urlCustomerId);
    }
  }, [searchParams]);

  useEffect(() => {
    fetchProjects();
    fetchCustomers();
  }, [statusFilter]);

  const fetchProjects = async () => {
    try {
      setLoading(true);
      const params = {};
      if (statusFilter) params.status = statusFilter;
      const response = await api.get('/projects/projects/', { params });
      setProjects(response.data.results || response.data);
    } catch (error) {
      console.error('Error fetching projects:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomers = async () => {
    try {
      const response = await api.get('/customers/customers/');
      setCustomers(response.data.results || response.data);
    } catch (error) {
      console.error('Error fetching customers:', error);
    }
  };

  const fetchCustomerSystems = async (customerId) => {
    try {
      const response = await api.get(`/customers/customers/${customerId}/systems/`);
      setCustomerSystems(response.data);
    } catch (error) {
      console.error('Error fetching customer systems:', error);
      setCustomerSystems([]);
    }
  };

  const handleCustomerChange = (customerId) => {
    setSelectedCustomer(customerId);
    setNewProject({ ...newProject, customer: customerId, systems: [] });
    if (customerId) {
      fetchCustomerSystems(customerId);
    } else {
      setCustomerSystems([]);
    }
  };

  const handleCreateProject = async (e) => {
    e.preventDefault();
    if (!newProject.customer) {
      alert('Bitte wählen Sie einen Kunden aus.');
      return;
    }
    try {
      const response = await api.post('/projects/projects/', newProject);
      setShowCreateModal(false);
      // Navigiere zur Edit-Seite des neuen Projekts
      window.location.href = `/sales/projects/${response.data.id}`;
    } catch (error) {
      console.error('Error creating project:', error);
      alert('Fehler beim Erstellen des Projekts.');
    }
  };

  const handleEdit = (projectId) => {
    window.location.href = `/sales/projects/${projectId}`;
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

  const filteredProjects = projects.filter(project =>
    project.project_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    project.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    project.customer_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Projekte</h1>
        <button
          onClick={() => setShowCreateModal(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          Neues Projekt
        </button>
      </div>

      <div className="mb-6 flex gap-4">
        <input
          type="text"
          placeholder="Suche nach Projektnummer, Name oder Kunde..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1 px-4 py-2 border rounded"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 border rounded"
        >
          <option value="">Alle Status</option>
          <option value="NEU">Neu</option>
          <option value="IN_BEARBEITUNG">In Bearbeitung</option>
          <option value="ANGEBOT_ERSTELLT">Angebot erstellt</option>
          <option value="DEMO_GEPLANT">Demo geplant</option>
          <option value="AUSSCHREIBUNG">Ausschreibung</option>
          <option value="AUFTRAG_ERTEILT">Auftrag erteilt</option>
          <option value="IN_FERTIGUNG">In Fertigung</option>
          <option value="LIEFERUNG">Lieferung</option>
          <option value="INSTALLATION">Installation</option>
          <option value="ABGESCHLOSSEN">Abgeschlossen</option>
          <option value="STORNIERT">Storniert</option>
        </select>
      </div>

      {loading ? (
        <div className="text-center py-8">Laden...</div>
      ) : (
        <div className="bg-white shadow-md rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Projektnummer</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Kunde</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Systeme</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Erstellt am</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Aktionen</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredProjects.map(project => (
                <tr key={project.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap font-medium">{project.project_number}</td>
                  <td className="px-6 py-4">{project.name || '-'}</td>
                  <td className="px-6 py-4">{project.customer_name}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(project.status)}`}>
                      {project.status_display}
                    </span>
                  </td>
                  <td className="px-6 py-4">{project.systems_count || 0}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {new Date(project.created_at).toLocaleDateString('de-DE')}
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => handleEdit(project.id)}
                      className="text-blue-600 hover:text-blue-800 mr-3"
                    >
                      Bearbeiten
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredProjects.length === 0 && (
            <div className="text-center py-8 text-gray-500">Keine Projekte gefunden</div>
          )}
        </div>
      )}

      {/* Create Project Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl">
            <h2 className="text-2xl font-bold mb-4">Neues Projekt erstellen</h2>
            <form onSubmit={handleCreateProject}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Projektname (optional)</label>
                  <input
                    type="text"
                    value={newProject.name}
                    onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                    className="w-full px-3 py-2 border rounded"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Kunde *</label>
                  <select
                    value={selectedCustomer}
                    onChange={(e) => handleCustomerChange(e.target.value)}
                    className="w-full px-3 py-2 border rounded"
                    required
                  >
                    <option value="">Bitte wählen...</option>
                    {customers.map(customer => (
                      <option key={customer.id} value={customer.id}>
                        {customer.customer_number} - {customer.first_name} {customer.last_name}
                      </option>
                    ))}
                  </select>
                </div>

                {customerSystems.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium mb-1">Systemauswahl (optional)</label>
                    <div className="border rounded p-3 max-h-40 overflow-y-auto">
                      {customerSystems.map(system => (
                        <label key={system.id} className="flex items-center mb-2">
                          <input
                            type="checkbox"
                            checked={newProject.systems.includes(system.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setNewProject({
                                  ...newProject,
                                  systems: [...newProject.systems, system.id]
                                });
                              } else {
                                setNewProject({
                                  ...newProject,
                                  systems: newProject.systems.filter(id => id !== system.id)
                                });
                              }
                            }}
                            className="mr-2"
                          />
                          {system.system_number} - {system.name}
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium mb-1">Projektbeschreibung (optional)</label>
                  <textarea
                    value={newProject.description}
                    onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
                    className="w-full px-3 py-2 border rounded"
                    rows="4"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setNewProject({ name: '', customer: '', systems: [], linked_system: '', description: '' });
                    setSelectedCustomer('');
                    setCustomerSystems([]);
                  }}
                  className="px-4 py-2 border rounded hover:bg-gray-50"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Speichern
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Projects;
