import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { PlusIcon, PencilIcon, UserGroupIcon } from '@heroicons/react/24/outline';



const EmployeeList = () => {
  const navigate = useNavigate();
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [formData, setFormData] = useState({
    employee_id: '',
    first_name: '',
    last_name: '',
    date_of_birth: '',
    address: '',
    personal_email: '',
    work_email: '',
    phone: '',
    employment_start_date: '',
    employment_end_date: '',
    contract_type: 'vollzeit',
    job_title: '',
    department: '',
    working_time_percentage: 100,
    weekly_work_hours: 40.00,
    work_days: ['mon','tue','wed','thu','fri'],
    annual_vacation_days: 30,
    employment_status: 'aktiv',
    closing_greeting: 'Mit freundlichen Grüßen'
  });
  const [signatureFile, setSignatureFile] = useState(null);
  const [signaturePreview, setSignaturePreview] = useState(null);

  useEffect(() => {
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    try {
      // Hauptweg: /api/users/employees/
      let response = await api.get('/users/employees/');
      if (response.status === 404) {
        // Fallback (ältere Pfade oder andere Router-Konfigurationen)
        response = await api.get('/employees/');
      }
      const data = response.data.results || response.data;
      setEmployees(Array.isArray(data) ? data : []);
    } catch (error) {
      // Detaillierte Protokollierung für Debugging im Browser
      console.error('Fehler beim Laden der Mitarbeiter:', error);
      if (error.config) console.error('Request config:', error.config);
      if (error.response) console.error('Response data:', error.response.data, 'status:', error.response.status);
      setEmployees([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      // Erstelle eine Kopie der Daten und entferne leere optionale Felder und read-only Felder
      const submitData = { ...formData };
      if (!submitData.employment_end_date) {
        delete submitData.employment_end_date;
      }
      delete submitData.employee_id; // Immer automatisch generiert
      
      // Wenn Signatur-Datei vorhanden, verwende FormData
      if (signatureFile) {
        const submitFormData = new FormData();
        
        // Füge alle Text-Felder zum FormData hinzu
        Object.keys(submitData).forEach(key => {
          if (key === 'work_days') {
            // Array als JSON-String für FormData
            submitFormData.append(key, JSON.stringify(submitData[key]));
          } else if (submitData[key] !== null && submitData[key] !== undefined && submitData[key] !== '') {
            submitFormData.append(key, submitData[key]);
          }
        });
        
        // Füge Signatur-Datei hinzu
        submitFormData.append('signature_image', signatureFile);
        
        if (editingEmployee) {
          await api.put(`/users/employees/${editingEmployee.id}/`, submitFormData, {
            headers: { 'Content-Type': 'multipart/form-data' }
          });
        } else {
          await api.post('/users/employees/', submitFormData, {
            headers: { 'Content-Type': 'multipart/form-data' }
          });
        }
      } else {
        // Ohne Datei-Upload, normaler JSON-Request
        if (editingEmployee) {
          await api.put(`/users/employees/${editingEmployee.id}/`, submitData);
        } else {
          await api.post('/users/employees/', submitData);
        }
      }
      
      fetchEmployees();
      setShowModal(false);
      setEditingEmployee(null);
      setSignatureFile(null);
      setSignaturePreview(null);
      resetForm();
    } catch (error) {
      console.error('Fehler beim Speichern:', error);
      if (error.response) {
        console.error('Response data:', error.response.data);
      }
    }
  };

  const handleEdit = (employee) => {
    // Navigate to dedicated edit page
    navigate(`/hr/employees/${employee.id}`);
  };

  const toggleStatus = async (employee) => {
    try {
      const next = employee.employment_status === 'aktiv' ? 'inaktiv' : 'aktiv';
      await api.patch(`/users/employees/${employee.id}/`, { employment_status: next });
      fetchEmployees();
    } catch (error) {
      console.error('Fehler beim Umschalten des Status:', error);
    }
  };

  // createVacationRequest moved into the section component so it can access helpers and employee props

  const resetForm = () => {
    setFormData({
      employee_id: '',
      first_name: '',
      last_name: '',
      date_of_birth: '',
      address: '',
      personal_email: '',
      work_email: '',
      phone: '',
      employment_start_date: '',
      employment_end_date: '',
      contract_type: 'vollzeit',
      job_title: '',
      department: '',
      working_time_percentage: 100,
      weekly_work_hours: 40.00,
      annual_vacation_days: 30,
      work_days: ['mon','tue','wed','thu','fri'],
      employment_status: 'aktiv',
      closing_greeting: 'Mit freundlichen Grüßen'
    });
    setSignatureFile(null);
    setSignaturePreview(null);
  };

  const openModal = () => {
    setEditingEmployee(null);
    resetForm();
    setShowModal(true);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8">
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto">
          <h1 className="text-2xl font-semibold text-gray-900 flex items-center">
            <UserGroupIcon className="h-8 w-8 mr-3 text-blue-600" />
            Mitarbeiterverwaltung
          </h1>
          <p className="mt-2 text-sm text-gray-700">
            Verwalten Sie Mitarbeiterdaten und Beschäftigungsverhältnisse.
          </p>
        </div>
        <div className="mt-4 sm:mt-0 sm:ml-16 sm:flex-none">
          <button
            type="button"
            onClick={openModal}
            className="inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          >
            <PlusIcon className="-ml-0.5 mr-1.5 h-5 w-5" aria-hidden="true" />
            Mitarbeiter hinzufügen
          </button>
        </div>
      </div>

      <div className="mt-8 flow-root">
        <div className="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
          <div className="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
            <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 sm:rounded-md">
              <table className="min-w-full divide-y divide-gray-300">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6">
                      Mitarbeiter-ID
                    </th>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                      Name
                    </th>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                      Position
                    </th>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                      Wochenstunden
                    </th>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                      Abteilung
                    </th>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {employees.map((employee) => (
                    <tr 
                      key={employee.id}
                      onClick={() => handleEdit(employee)}
                      className="cursor-pointer hover:bg-gray-50 transition-colors"
                    >
                      <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6">
                        {employee.employee_id}
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                        {employee.first_name} {employee.last_name}
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                        {employee.job_title}
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                        {employee.weekly_work_hours ? `${parseFloat(employee.weekly_work_hours).toFixed(2)} h` : '-'}
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                        {employee.department}
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                        <div className="flex items-center space-x-2">
                          <span className={`inline-flex rounded-full px-2 text-xs font-semibold leading-5 ${
                            employee.employment_status === 'aktiv' ? 'bg-green-100 text-green-800' :
                            employee.employment_status === 'inaktiv' ? 'bg-gray-100 text-gray-800' :
                            'bg-yellow-100 text-yellow-800'
                          }`}>
                            {employee.employment_status}
                          </span>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleStatus(employee);
                            }} 
                            className="text-sm text-blue-600 hover:text-blue-900"
                          >
                            Toggle
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-10 overflow-y-auto">
          <div className="flex min-h-screen items-end justify-center px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setShowModal(false)}></div>
            <div className="inline-block transform overflow-hidden rounded-lg bg-white px-4 pt-5 pb-4 text-left align-bottom shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-2xl sm:p-6 sm:align-middle">
              <div className="sm:flex sm:items-start">
                <div className="mt-3 w-full text-center sm:mt-0 sm:text-left">
                  <h3 className="text-lg font-medium leading-6 text-gray-900">
                    {editingEmployee ? 'Mitarbeiter bearbeiten' : 'Neuer Mitarbeiter'}
                  </h3>
                  <div className="mt-4">
                    <form onSubmit={handleSubmit} className="space-y-4">
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Mitarbeiter-ID</label>
                          <input
                            type="text"
                            disabled
                            value={formData.employee_id}
                            onChange={(e) => setFormData({...formData, employee_id: e.target.value})}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Vorname</label>
                          <input
                            type="text"
                            required
                            value={formData.first_name}
                            onChange={(e) => setFormData({...formData, first_name: e.target.value})}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Nachname</label>
                          <input
                            type="text"
                            required
                            value={formData.last_name}
                            onChange={(e) => setFormData({...formData, last_name: e.target.value})}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Geburtsdatum</label>
                          <input
                            type="date"
                            required
                            value={formData.date_of_birth}
                            onChange={(e) => setFormData({...formData, date_of_birth: e.target.value})}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Eintrittsdatum</label>
                          <input
                            type="date"
                            required
                            value={formData.employment_start_date}
                            onChange={(e) => setFormData({...formData, employment_start_date: e.target.value})}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Austrittsdatum</label>
                          <input
                            type="date"
                            value={formData.employment_end_date}
                            onChange={(e) => setFormData({...formData, employment_end_date: e.target.value})}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Vertragsart</label>
                          <select
                            value={formData.contract_type}
                            onChange={(e) => setFormData({...formData, contract_type: e.target.value})}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                          >
                            <option value="unbefristet">Unbefristet</option>
                            <option value="befristet">Befristet</option>
                            <option value="teilzeit">Teilzeit</option>
                            <option value="vollzeit">Vollzeit</option>
                            <option value="ausbildung">Ausbildung</option>
                            <option value="minijob">Minijob</option>
                            <option value="praktikum">Praktikum</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Stellenbezeichnung</label>
                          <input
                            type="text"
                            required
                            value={formData.job_title}
                            onChange={(e) => setFormData({...formData, job_title: e.target.value})}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Abteilung *</label>
                          <select
                            value={formData.department}
                            onChange={(e) => setFormData({...formData, department: e.target.value})}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                            required
                          >
                            <option value="">Abteilung auswählen...</option>
                            <option value="vertrieb">Vertrieb</option>
                            <option value="geschaeftsfuehrung">Geschäftsführung</option>
                            <option value="entwicklung">Entwicklung</option>
                            <option value="fertigung">Fertigung</option>
                            <option value="verwaltung">Verwaltung</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Beschäftigungsumfang (%)</label>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={formData.working_time_percentage}
                            onChange={(e) => setFormData({...formData, working_time_percentage: parseFloat(e.target.value)})}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Wochenarbeitszeit (h)</label>
                          <input
                            type="number"
                            min="0"
                            step="0.25"
                            value={formData.weekly_work_hours}
                            onChange={(e) => setFormData({...formData, weekly_work_hours: parseFloat(e.target.value)})}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Jahresurlaubstage</label>
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={formData.annual_vacation_days}
                            onChange={(e) => setFormData({...formData, annual_vacation_days: parseInt(e.target.value)})}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Status</label>
                          <select
                            value={formData.employment_status}
                            onChange={(e) => setFormData({...formData, employment_status: e.target.value})}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                          >
                            <option value="aktiv">Aktiv</option>
                            <option value="inaktiv">Inaktiv</option>
                            <option value="urlaub">Urlaub</option>
                            <option value="krank">Krank</option>
                            <option value="aufkündigung">Aufkündigung</option>
                          </select>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Adresse</label>
                          <textarea
                            value={formData.address}
                            onChange={(e) => setFormData({...formData, address: e.target.value})}
                            rows={3}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Private E-Mail</label>
                          <input
                            type="email"
                            value={formData.personal_email}
                            onChange={(e) => setFormData({...formData, personal_email: e.target.value})}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Dienstliche E-Mail</label>
                          <input
                            type="email"
                            value={formData.work_email}
                            onChange={(e) => setFormData({...formData, work_email: e.target.value})}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Telefon</label>
                          <input
                            type="tel"
                            value={formData.phone}
                            onChange={(e) => setFormData({...formData, phone: e.target.value})}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                          />
                        </div>
                      </div>
                      <div className="mt-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">Arbeitstage</label>
                        <div className="grid grid-cols-7 gap-2">
                          {[
                            { key: 'mon', label: 'Mo' },
                            { key: 'tue', label: 'Di' },
                            { key: 'wed', label: 'Mi' },
                            { key: 'thu', label: 'Do' },
                            { key: 'fri', label: 'Fr' },
                            { key: 'sat', label: 'Sa' },
                            { key: 'sun', label: 'So' },
                          ].map(d => (
                            <label key={d.key} className="inline-flex items-center">
                              <input
                                type="checkbox"
                                checked={formData.work_days.includes(d.key)}
                                onChange={(e) => {
                                  const checked = e.target.checked;
                                  setFormData(prev => {
                                    const next = new Set(prev.work_days || []);
                                    if (checked) next.add(d.key); else next.delete(d.key);
                                    return { ...prev, work_days: Array.from(next) };
                                  });
                                }}
                                className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                              />
                              <span className="ml-2 text-sm text-gray-700">{d.label}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                      
                      {/* Signatur für PDF-Dokumente */}
                      <div className="mt-6 border-t pt-4">
                        <h4 className="text-sm font-semibold text-gray-700 mb-3">Unterschrift für Dokumente</h4>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                          <div>
                            <label className="block text-sm font-medium text-gray-700">Grußformel</label>
                            <input
                              type="text"
                              value={formData.closing_greeting}
                              onChange={(e) => setFormData({...formData, closing_greeting: e.target.value})}
                              placeholder="Mit freundlichen Grüßen"
                              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700">Unterschrift (Bild)</label>
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(e) => {
                                const file = e.target.files[0];
                                if (file) {
                                  setSignatureFile(file);
                                  setSignaturePreview(URL.createObjectURL(file));
                                }
                              }}
                              className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                            />
                            {signaturePreview && (
                              <div className="mt-2">
                                <img 
                                  src={signaturePreview} 
                                  alt="Unterschrift Vorschau" 
                                  className="h-12 border rounded"
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
                        <button
                          type="submit"
                          className="inline-flex w-full justify-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-base font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 sm:ml-3 sm:w-auto sm:text-sm"
                        >
                          {editingEmployee ? 'Aktualisieren' : 'Erstellen'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowModal(false)}
                          className="mt-3 inline-flex w-full justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-base font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 sm:mt-0 sm:w-auto sm:text-sm"
                        >
                          Abbrechen
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};


export default EmployeeList;

