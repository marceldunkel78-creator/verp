import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import api from '../services/api';
import FileUpload from '../components/FileUpload';
import { 
  ArrowLeftIcon,
  CalendarIcon,
  MapPinIcon,
  UserGroupIcon,
  DocumentTextIcon,
  PlusIcon
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
  const [eventReport, setEventReport] = useState(null);
  const [reportSaving, setReportSaving] = useState(false);
  const [reportData, setReportData] = useState({
    comment: '',
    conclusion: '',
    leads: []
  });
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerResults, setCustomerResults] = useState([]);
  const [activeLeadIndex, setActiveLeadIndex] = useState(null);
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

  // Fetch event report when item is loaded and is a show/workshop
  useEffect(() => {
    if (item && ['show', 'workshop'].includes(item.category)) {
      fetchEventReport();
    }
  }, [item]);

  // Customer search for leads
  useEffect(() => {
    if (customerSearch.length < 2) {
      setCustomerResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const response = await api.get(`/customers/customers/?search=${encodeURIComponent(customerSearch)}&page_size=10`);
        setCustomerResults(response.data.results || response.data || []);
      } catch (error) {
        console.error('Fehler bei Kundensuche:', error);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [customerSearch]);

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

  const fetchEventReport = async () => {
    try {
      const response = await api.get(`/sales/event-reports/by_marketing_item/?marketing_item=${id}`);
      if (response.data) {
        setEventReport(response.data);
        setReportData({
          comment: response.data.comment || '',
          conclusion: response.data.conclusion || '',
          leads: (response.data.leads || []).map(lead => ({
            id: lead.id,
            name: lead.name || '',
            location: lead.location || '',
            email: lead.email || '',
            phone: lead.phone || '',
            comment: lead.comment || '',
            has_purchase_interest: lead.has_purchase_interest || false,
            customer: lead.customer || null,
            customer_name: lead.customer_name || ''
          }))
        });
      }
    } catch (error) {
      if (error.response?.status !== 404) {
        console.error('Fehler beim Laden des Berichts:', error);
      }
    }
  };

  const handleAddLead = () => {
    setReportData({
      ...reportData,
      leads: [...reportData.leads, {
        name: '',
        location: '',
        email: '',
        phone: '',
        comment: '',
        has_purchase_interest: false,
        customer: null,
        customer_name: ''
      }]
    });
  };

  const handleRemoveLead = (index) => {
    setReportData({
      ...reportData,
      leads: reportData.leads.filter((_, i) => i !== index)
    });
  };

  const handleLeadChange = (index, field, value) => {
    const updatedLeads = [...reportData.leads];
    updatedLeads[index] = { ...updatedLeads[index], [field]: value };
    setReportData({ ...reportData, leads: updatedLeads });
  };

  const handleSelectCustomerForLead = (index, customer) => {
    const updatedLeads = [...reportData.leads];
    const fullName = [customer.title, customer.first_name, customer.last_name].filter(Boolean).join(' ');
    updatedLeads[index] = {
      ...updatedLeads[index],
      customer: customer.id,
      customer_name: customer.full_name || fullName,
      name: customer.full_name || fullName,
      location: customer.primary_address_city || updatedLeads[index].location,
      email: customer.email || updatedLeads[index].email,
      phone: customer.phone || updatedLeads[index].phone
    };
    setReportData({ ...reportData, leads: updatedLeads });
    setCustomerSearch('');
    setCustomerResults([]);
    setActiveLeadIndex(null);
  };

  const handleSaveReport = async () => {
    setReportSaving(true);
    try {
      const submitData = {
        marketing_item: parseInt(id),
        comment: reportData.comment,
        conclusion: reportData.conclusion,
        leads: reportData.leads.map(lead => ({
          ...(lead.id ? { id: lead.id } : {}),
          name: lead.name,
          location: lead.location,
          email: lead.email,
          phone: lead.phone,
          comment: lead.comment,
          has_purchase_interest: lead.has_purchase_interest,
          customer: lead.customer || null
        }))
      };

      if (eventReport) {
        await api.put(`/sales/event-reports/${eventReport.id}/`, submitData);
      } else {
        const response = await api.post('/sales/event-reports/', submitData);
        setEventReport(response.data);
      }
      await fetchEventReport();
      alert('Bericht erfolgreich gespeichert');
    } catch (error) {
      console.error('Fehler beim Speichern des Berichts:', error);
      alert('Fehler beim Speichern: ' + (error.response?.data?.detail || JSON.stringify(error.response?.data) || error.message));
    } finally {
      setReportSaving(false);
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

          {/* Bericht (nur für gespeicherte Shows/Workshops) */}
          {!isNew && item && ['show', 'workshop'].includes(item.category) && (
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                <DocumentTextIcon className="h-5 w-5 mr-2" />
                Bericht
              </h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Allgemeiner Kommentar</label>
                  <textarea
                    value={reportData.comment}
                    onChange={(e) => setReportData({...reportData, comment: e.target.value})}
                    rows={4}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    placeholder="Allgemeine Anmerkungen zur Veranstaltung..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Fazit</label>
                  <textarea
                    value={reportData.conclusion}
                    onChange={(e) => setReportData({...reportData, conclusion: e.target.value})}
                    rows={3}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    placeholder="Zusammenfassung und Fazit der Veranstaltung..."
                  />
                </div>

                {/* Leads / Teilnehmer */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-md font-medium text-gray-800">Teilnehmer / Leads</h4>
                    <button
                      type="button"
                      onClick={handleAddLead}
                      className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700"
                    >
                      <PlusIcon className="h-4 w-4 mr-1" />
                      Lead hinzufügen
                    </button>
                  </div>

                  {reportData.leads.length === 0 && (
                    <p className="text-sm text-gray-500 italic">Noch keine Leads erfasst. Klicken Sie auf "Lead hinzufügen" um einen neuen Teilnehmer anzulegen.</p>
                  )}

                  <div className="space-y-4">
                    {reportData.leads.map((lead, index) => (
                      <div key={index} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                        <div className="flex justify-between items-start mb-3">
                          <span className="text-sm font-medium text-gray-600">Lead #{index + 1}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveLead(index)}
                            className="text-red-500 hover:text-red-700 text-sm"
                          >
                            Entfernen
                          </button>
                        </div>

                        {/* Kundensuche */}
                        <div className="mb-3 relative">
                          <label className="block text-xs font-medium text-gray-500 mb-1">Aus Kundendatenbank übernehmen</label>
                          <input
                            type="text"
                            placeholder="Kunde suchen..."
                            value={activeLeadIndex === index ? customerSearch : ''}
                            onFocus={() => setActiveLeadIndex(index)}
                            onChange={(e) => {
                              setActiveLeadIndex(index);
                              setCustomerSearch(e.target.value);
                            }}
                            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                          />
                          {activeLeadIndex === index && customerResults.length > 0 && (
                            <ul className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg max-h-48 overflow-auto">
                              {customerResults.map(c => (
                                <li
                                  key={c.id}
                                  className="px-3 py-2 hover:bg-blue-50 cursor-pointer text-sm"
                                  onClick={() => handleSelectCustomerForLead(index, c)}
                                >
                                  <span className="font-medium">{c.full_name || `${c.first_name} ${c.last_name}`}</span>
                                  {c.customer_number && <span className="text-gray-500 ml-2">({c.customer_number})</span>}
                                  {c.primary_address_city && <span className="text-gray-400 ml-2">{c.primary_address_city}</span>}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-gray-500">Name *</label>
                            <input
                              type="text"
                              required
                              value={lead.name}
                              onChange={(e) => handleLeadChange(index, 'name', e.target.value)}
                              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-500">Ort</label>
                            <input
                              type="text"
                              value={lead.location}
                              onChange={(e) => handleLeadChange(index, 'location', e.target.value)}
                              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-500">E-Mail</label>
                            <input
                              type="email"
                              value={lead.email}
                              onChange={(e) => handleLeadChange(index, 'email', e.target.value)}
                              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-500">Telefon</label>
                            <input
                              type="text"
                              value={lead.phone}
                              onChange={(e) => handleLeadChange(index, 'phone', e.target.value)}
                              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                            />
                          </div>
                          <div className="sm:col-span-2">
                            <label className="block text-xs font-medium text-gray-500">Kommentar</label>
                            <input
                              type="text"
                              value={lead.comment}
                              onChange={(e) => handleLeadChange(index, 'comment', e.target.value)}
                              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                            />
                          </div>
                          <div className="sm:col-span-2">
                            <label className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                checked={lead.has_purchase_interest}
                                onChange={(e) => handleLeadChange(index, 'has_purchase_interest', e.target.checked)}
                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                              />
                              <span className="text-sm text-gray-700">Kaufinteresse vorhanden</span>
                            </label>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Bericht speichern */}
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleSaveReport}
                    disabled={reportSaving}
                    className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {reportSaving ? 'Speichert...' : 'Bericht speichern'}
                  </button>
                </div>
              </div>
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
