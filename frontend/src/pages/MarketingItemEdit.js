import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import api from '../services/api';
import FileUpload from '../components/FileUpload';
import { 
  ArrowLeftIcon,
  CalendarIcon,
  MapPinIcon,
  UserGroupIcon
} from '@heroicons/react/24/outline';

const MarketingItemEdit = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isNew = id === 'new' || !id;
  const categoryFromUrl = searchParams.get('category') || 'newsletter';

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [item, setItem] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [formData, setFormData] = useState({
    category: categoryFromUrl,
    title: '',
    description: '',
    responsible_employees: [],
    event_date: '',
    event_location: ''
  });

  const categoryOptions = [
    { value: 'newsletter', label: 'Newsletter' },
    { value: 'appnote', label: 'AppNote' },
    { value: 'technote', label: 'TechNote' },
    { value: 'brochure', label: 'Broschüre' },
    { value: 'show', label: 'Show' },
    { value: 'workshop', label: 'Workshop' }
  ];

  useEffect(() => {
    fetchEmployees();
    if (!isNew) {
      fetchItem();
    }
  }, [id]);

  const fetchEmployees = async () => {
    try {
      const response = await api.get('/users/employees/?is_active=true&page_size=100');
      setEmployees(response.data.results || response.data || []);
    } catch (error) {
      console.error('Fehler beim Laden der Mitarbeiter:', error);
    }
  };

  const fetchItem = async () => {
    try {
      const response = await api.get(`/sales/marketing-items/${id}/`);
      setItem(response.data);
      setFormData({
        category: response.data.category || 'newsletter',
        title: response.data.title || '',
        description: response.data.description || '',
        responsible_employees: response.data.responsible_employees || [],
        event_date: response.data.event_date ? response.data.event_date.slice(0, 16) : '',
        event_location: response.data.event_location || ''
      });
    } catch (error) {
      console.error('Fehler beim Laden:', error);
      alert('Fehler beim Laden des Marketing-Materials');
      navigate('/sales/marketing');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    
    try {
      const submitData = { ...formData };
      
      // Event-Felder nur für Shows/Workshops
      if (!['show', 'workshop'].includes(submitData.category)) {
        delete submitData.event_date;
        delete submitData.event_location;
      }
      
      if (isNew) {
        const response = await api.post('/sales/marketing-items/', submitData);
        alert('Marketing-Material erfolgreich erstellt');
        navigate(`/sales/marketing/${response.data.id}`);
      } else {
        await api.put(`/sales/marketing-items/${id}/`, submitData);
        alert('Marketing-Material erfolgreich aktualisiert');
        fetchItem();
      }
    } catch (error) {
      console.error('Fehler beim Speichern:', error);
      alert('Fehler beim Speichern: ' + (error.response?.data?.detail || error.message));
    } finally {
      setSaving(false);
    }
  };

  const handleAddEmployee = (empId) => {
    if (!empId || formData.responsible_employees.includes(parseInt(empId))) return;
    setFormData({
      ...formData,
      responsible_employees: [...formData.responsible_employees, parseInt(empId)]
    });
  };

  const handleRemoveEmployee = (empId) => {
    setFormData({
      ...formData,
      responsible_employees: formData.responsible_employees.filter(id => id !== empId)
    });
  };

  const isEventCategory = ['show', 'workshop'].includes(formData.category);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => navigate('/sales/marketing')}
          className="mb-4 inline-flex items-center text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeftIcon className="h-4 w-4 mr-1" />
          Zurück zum Marketing
        </button>
        <h1 className="text-2xl font-semibold text-gray-900">
          {isNew ? 'Neues Marketing-Material' : item?.title}
        </h1>
        {!isNew && item && (
          <p className="mt-1 text-sm text-gray-500">
            {item.category_display} • Erstellt am {new Date(item.created_at).toLocaleDateString()}
          </p>
        )}
      </div>

      {/* Form */}
      <div className="bg-white shadow rounded-lg">
        <form onSubmit={handleSave} className="p-6 space-y-6">
          {/* Basisinformationen */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Basisinformationen</h3>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700">Kategorie *</label>
                <select
                  required
                  value={formData.category}
                  onChange={(e) => setFormData({...formData, category: e.target.value})}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                >
                  {categoryOptions.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700">Titel *</label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({...formData, title: e.target.value})}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                />
              </div>
              
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700">Beschreibung</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  rows={4}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                />
              </div>
            </div>
          </div>

          {/* Zuständige Mitarbeiter */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
              <UserGroupIcon className="h-5 w-5 mr-2" />
              Zuständige Mitarbeiter
            </h3>
            
            {/* Mitarbeiter hinzufügen */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Mitarbeiter hinzufügen
              </label>
              <select
                onChange={(e) => {
                  handleAddEmployee(e.target.value);
                  e.target.value = '';
                }}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              >
                <option value="">-- Mitarbeiter wählen --</option>
                {employees
                  .filter(emp => !formData.responsible_employees.includes(emp.id))
                  .map(emp => (
                    <option key={emp.id} value={emp.id}>
                      {emp.employee_id} - {emp.first_name} {emp.last_name}
                    </option>
                  ))}
              </select>
            </div>
            
            {/* Liste der zugewiesenen Mitarbeiter */}
            {formData.responsible_employees.length > 0 && (
              <ul className="divide-y divide-gray-200 border rounded-md">
                {formData.responsible_employees.map(empId => {
                  const emp = employees.find(e => e.id === empId);
                  if (!emp) return null;
                  return (
                    <li key={empId} className="flex items-center justify-between p-3">
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {emp.first_name} {emp.last_name}
                        </p>
                        <p className="text-sm text-gray-500">{emp.employee_id}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveEmployee(empId)}
                        className="text-red-600 hover:text-red-800"
                      >
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Veranstaltungsdaten (nur für Shows/Workshops) */}
          {isEventCategory && (
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                <CalendarIcon className="h-5 w-5 mr-2" />
                Veranstaltungsdaten
              </h3>
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Veranstaltungsdatum</label>
                  <input
                    type="datetime-local"
                    value={formData.event_date}
                    onChange={(e) => setFormData({...formData, event_date: e.target.value})}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 flex items-center">
                    <MapPinIcon className="h-4 w-4 mr-1" />
                    Veranstaltungsort
                  </label>
                  <input
                    type="text"
                    value={formData.event_location}
                    onChange={(e) => setFormData({...formData, event_location: e.target.value})}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Dateien (nur wenn bereits gespeichert) */}
          {!isNew && item && (
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Dateien</h3>
              <FileUpload 
                attachments={item.files || []}
                ticketId={id}
                ticketType="marketing"
                onUploadSuccess={fetchItem}
                onDeleteSuccess={fetchItem}
              />
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end space-x-3 pt-6 border-t">
            <button
              type="button"
              onClick={() => navigate('/sales/marketing')}
              className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Speichert...' : (isNew ? 'Erstellen' : 'Speichern')}
            </button>
          </div>
        </form>
      </div>
      
      {isNew && (
        <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-md p-4">
          <p className="text-sm text-yellow-800">
            <strong>Hinweis:</strong> Dateien können nach dem Erstellen des Marketing-Materials hochgeladen werden.
          </p>
        </div>
      )}
    </div>
  );
};

export default MarketingItemEdit;
