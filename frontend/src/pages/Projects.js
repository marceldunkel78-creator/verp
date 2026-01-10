import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { TrashIcon, PencilIcon, UserIcon, CpuChipIcon, CalendarIcon } from '@heroicons/react/24/outline';
import api from '../services/api';
import SystemSearch from '../components/SystemSearch';

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
      setNewProject({ 
        name: '', 
        customer: urlCustomerId,
        systems: [],  // Always reset systems
        linked_system: urlSystemId || '',
        description: ''
      });
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
      // Prepare payload - only include fields that have values
      const payload = {
        customer: newProject.customer,
        name: newProject.name || '',
        description: newProject.description || ''
      };
      
      // Only include systems if there are valid selections
      if (newProject.systems && newProject.systems.length > 0) {
        payload.systems = newProject.systems;
      }
      
      // Only include linked_system if it's set
      if (newProject.linked_system) {
        payload.linked_system = newProject.linked_system;
      }
      
      console.log('Sending payload:', payload); // Debug log
      
      const response = await api.post('/projects/projects/', payload);
      console.log('Created project:', response.data); // Debug
      setShowCreateModal(false);
      // Ensure we have an id before navigating
      if (response.data?.id) {
        window.location.href = `/sales/projects/${response.data.id}`;
      } else {
        alert('Projekt wurde erstellt, aber die Server-Antwort enthält keine ID. Bitte Seite neu laden oder im Admin prüfen.');
      }
    } catch (error) {
      console.error('Error creating project:', error);
      const errorMsg = error.response?.data?.systems?.[0] || 
                       error.response?.data?.detail || 
                       'Fehler beim Erstellen des Projekts.';
      alert(errorMsg);
    }
  };

  const handleEdit = (projectId) => {
    window.location.href = `/sales/projects/${projectId}`;
  };

  const handleDelete = async (projectId, projectName) => {
    if (window.confirm(`Möchten Sie das Projekt "${projectName}" wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.`)) {
      try {
        await api.delete(`/projects/projects/${projectId}/`);
        setProjects(projects.filter(project => project.id !== projectId));
      } catch (error) {
        console.error('Error deleting project:', error);
        alert('Fehler beim Löschen des Projekts. Möglicherweise ist das Projekt mit anderen Daten verknüpft.');
      }
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProjects.map(project => (
            <div key={project.id} className="bg-white rounded-lg shadow-md border border-gray-200 hover:shadow-lg transition-shadow duration-200">
              {/* Project Header */}
              <div className="p-6 border-b border-gray-100">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">
                      {project.project_number}
                    </h3>
                    <p className="text-gray-600 text-sm">
                      {project.name || 'Kein Name vergeben'}
                    </p>
                  </div>
                  <span className={`px-2 py-1 text-xs rounded-full whitespace-nowrap ${getStatusColor(project.status)}`}>
                    {project.status_display}
                  </span>
                </div>
              </div>

              {/* Project Details */}
              <div className="p-6 space-y-3">
                <div className="flex items-center text-sm text-gray-600">
                  <UserIcon className="h-4 w-4 mr-2 text-gray-400" />
                  <span>{project.customer_name}</span>
                </div>
                
                <div className="flex items-center text-sm text-gray-600">
                  <CpuChipIcon className="h-4 w-4 mr-2 text-gray-400" />
                  <span>{project.systems_count || 0} System(e)</span>
                </div>

                <div className="flex items-center text-sm text-gray-600">
                  <CalendarIcon className="h-4 w-4 mr-2 text-gray-400" />
                  <span>Erstellt: {new Date(project.created_at).toLocaleDateString('de-DE')}</span>
                </div>

                {project.description && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <p className="text-sm text-gray-600 line-clamp-3">
                      {project.description}
                    </p>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-between items-center">
                <button
                  onClick={() => handleEdit(project.id)}
                  className="flex items-center px-3 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors duration-200"
                >
                  <PencilIcon className="h-4 w-4 mr-1" />
                  Bearbeiten
                </button>
                <button
                  onClick={() => handleDelete(project.id, project.project_number)}
                  className="flex items-center px-3 py-2 text-sm bg-red-600 text-white rounded hover:bg-red-700 transition-colors duration-200"
                >
                  <TrashIcon className="h-4 w-4 mr-1" />
                  Löschen
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* No Projects Found */}
      {!loading && filteredProjects.length === 0 && (
        <div className="text-center py-12">
          <div className="mx-auto w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-4">
            <CpuChipIcon className="h-12 w-12 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-1">Keine Projekte gefunden</h3>
          <p className="text-gray-600">
            {searchTerm || statusFilter ? 'Versuchen Sie andere Suchkriterien.' : 'Erstellen Sie Ihr erstes Projekt.'}
          </p>
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
                    <SystemSearch
                      customerId={selectedCustomer}
                      selectedSystems={newProject.systems}
                      onChange={(systemIds) => setNewProject({ ...newProject, systems: systemIds })}
                    />
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
