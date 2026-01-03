import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { PlusIcon, PencilIcon, TrashIcon, UserGroupIcon } from '@heroicons/react/24/outline';



const EmployeeList = () => {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [activeTab, setActiveTab] = useState('employees');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(null);
  const [timeEntries, setTimeEntries] = useState([]);
  const [monthlyReport, setMonthlyReport] = useState(null);
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
    setEditingEmployee(employee);
    setFormData({
      employee_id: employee.employee_id || '',
      first_name: employee.first_name || '',
      last_name: employee.last_name || '',
      date_of_birth: employee.date_of_birth || '',
      address: employee.address || '',
      personal_email: employee.personal_email || '',
      work_email: employee.work_email || '',
      phone: employee.phone || '',
      employment_start_date: employee.employment_start_date || '',
      employment_end_date: employee.employment_end_date || '',
      contract_type: employee.contract_type || 'vollzeit',
      job_title: employee.job_title || '',
      department: employee.department || '',
      working_time_percentage: parseFloat(employee.working_time_percentage) || 100,
      weekly_work_hours: employee.weekly_work_hours ? parseFloat(employee.weekly_work_hours) : 40.00,
      annual_vacation_days: employee.annual_vacation_days || 30,
      work_days: Array.isArray(employee.work_days) ? employee.work_days : ['mon','tue','wed','thu','fri'],
      employment_status: employee.employment_status || 'aktiv',
      closing_greeting: employee.closing_greeting || 'Mit freundlichen Grüßen'
    });
    // Setze Signatur-Vorschau wenn vorhanden
    setSignaturePreview(employee.signature_image_url || null);
    setSignatureFile(null);
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Mitarbeiter wirklich löschen?')) {
      try {
        await api.delete(`/users/employees/${id}/`);
        fetchEmployees();
      } catch (error) {
        console.error('Fehler beim Löschen:', error);
      }
    }
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

  const fetchTimeEntriesForEmployee = async (empId) => {
    try {
      setTimeEntries([]);
      setMonthlyReport(null);
      if (!empId) return;
      // use employee param for admin filtering
      const res = await api.get(`/users/time-entries/?employee=${empId}`);
      const data = res.data.results || res.data;
      setTimeEntries(Array.isArray(data) ? data : []);
      // fetch monthly report
      try {
        const r = await api.get(`/users/time-entries/monthly_report/?employee=${empId}`);
        setMonthlyReport(r.data);
      } catch (err) {
        console.warn('Monatsbericht nicht verfügbar für Mitarbeiter', err);
      }
    } catch (error) {
      console.error('Fehler beim Laden der Zeiteinträge:', error);
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
        <div className="mt-4 sm:mt-0 sm:ml-6 sm:flex-none">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-6">
              <button onClick={() => setActiveTab('employees')} className={`py-2 px-1 border-b-2 ${activeTab==='employees' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>Mitarbeiter</button>
              <button onClick={() => setActiveTab('time')} className={`py-2 px-1 border-b-2 ${activeTab==='time' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>Zeiterfassung</button>
              <button onClick={() => setActiveTab('vacation')} className={`py-2 px-1 border-b-2 ${activeTab==='vacation' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>Urlaub</button>
            </nav>
          </div>
          </div>
        </div>

      <div className="mt-8 flow-root">
        {activeTab === 'time' && (
          <div className="mb-6 bg-white shadow rounded-md p-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Mitarbeiter auswählen</label>
            <select onChange={(e) => { setSelectedEmployeeId(e.target.value); fetchTimeEntriesForEmployee(e.target.value); }} value={selectedEmployeeId || ''} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm">
              <option value="">-- bitte wählen --</option>
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>{emp.employee_id} — {emp.first_name} {emp.last_name}</option>
              ))}
            </select>

            {monthlyReport && (
              <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-3 bg-gray-50 rounded">Gearbeitet: <strong>{monthlyReport.actual_hours}h</strong></div>
                <div className="p-3 bg-gray-50 rounded">Erwartet bis heute: <strong>{monthlyReport.expected_hours_to_date}h</strong></div>
                <div className="p-3 bg-gray-50 rounded">Differenz: <strong>{monthlyReport.difference}h</strong></div>
              </div>
            )}

            <div className="mt-4">
              {timeEntries.length === 0 ? <div className="text-sm text-gray-500">Keine Einträge.</div> : (
                <ul className="divide-y divide-gray-200">
                  {timeEntries.map(te => (
                    <li key={te.id} className="py-2 flex justify-between">
                      <div>{new Date(te.date).toLocaleDateString()} — {te.start_time}–{te.end_time} ({te.duration_display || '-'})</div>
                      <div className="text-sm text-gray-500">Pause: {te.break_time}</div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        {activeTab === 'employees' && (
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
                    <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                      <span className="sr-only">Aktionen</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {employees.map((employee) => (
                    <tr key={employee.id}>
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
                          <button onClick={() => toggleStatus(employee)} className="text-sm text-blue-600 hover:text-blue-900">Toggle</button>
                        </div>
                      </td>
                      <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                        <button
                          onClick={() => handleEdit(employee)}
                          className="text-blue-600 hover:text-blue-900 mr-4"
                        >
                          <PencilIcon className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => handleDelete(employee.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          <TrashIcon className="h-5 w-5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
      </div>

        {activeTab === 'vacation' && (
          <HRVacationSection 
            employees={employees} 
            selectedEmployeeId={selectedEmployeeId}
            setSelectedEmployeeId={setSelectedEmployeeId}
            fetchEmployees={fetchEmployees}
          />
        )}

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
                          <label className="block text-sm font-medium text-gray-700">Abteilung</label>
                          <input
                            type="text"
                            value={formData.department}
                            onChange={(e) => setFormData({...formData, department: e.target.value})}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                          />
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


// ==================== HR Vacation Section Component ====================

const HRVacationSection = ({ employees, selectedEmployeeId, setSelectedEmployeeId, fetchEmployees }) => {
  const [hrVacations, setHrVacations] = useState([]);
  const [yearBalance, setYearBalance] = useState(null);
  const [adjustments, setAdjustments] = useState([]);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [adjustForm, setAdjustForm] = useState({ days: '', reason: '' });
  const [showYearCloseModal, setShowYearCloseModal] = useState(false);

  const selectedEmployee = employees.find(e => String(e.id) === String(selectedEmployeeId));

  // Year selector options
  const yearOptions = [new Date().getFullYear(), new Date().getFullYear() - 1, new Date().getFullYear() - 2];

  const fetchVacationsForEmployee = async (empId) => {
    try {
      setHrVacations([]);
      if (!empId) return;
      const res = await api.get(`/users/vacation-requests/?employee=${empId}&year=${selectedYear}`);
      const data = res.data.results || res.data;
      setHrVacations(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Fehler beim Laden der Urlaubsanträge:', error);
      setHrVacations([]);
    }
  };

  const fetchYearBalance = async (empId) => {
    if (!empId) {
      setYearBalance(null);
      setAdjustments([]);
      return;
    }
    try {
      const res = await api.get(`/users/vacation-year-balances/for_employee/?employee=${empId}&year=${selectedYear}`);
      setYearBalance(res.data);
    } catch (err) {
      console.warn('Jahresurlaubskonto nicht verfügbar:', err);
      setYearBalance(null);
    }
    try {
      const adjRes = await api.get(`/users/vacation-adjustments/?employee=${empId}&year=${selectedYear}`);
      setAdjustments(adjRes.data.results || adjRes.data || []);
    } catch (err) {
      console.warn('Urlaubsanpassungen nicht verfügbar:', err);
      setAdjustments([]);
    }
  };

  useEffect(() => {
    if (selectedEmployeeId) {
      fetchVacationsForEmployee(selectedEmployeeId);
      fetchYearBalance(selectedEmployeeId);
    }
  }, [selectedEmployeeId, selectedYear]);

  const approveRequest = async (id) => {
    try {
      await api.patch(`/users/vacation-requests/${id}/`, { status: 'approved' });
      fetchVacationsForEmployee(selectedEmployeeId);
      fetchYearBalance(selectedEmployeeId);
      fetchEmployees();
    } catch (error) {
      console.error('Fehler beim Genehmigen:', error);
      alert('Fehler beim Genehmigen: ' + (error.response?.data?.days_requested || error.response?.data?.detail || error.message));
    }
  };

  const rejectRequest = async (id) => {
    try {
      await api.patch(`/users/vacation-requests/${id}/`, { status: 'rejected' });
      fetchVacationsForEmployee(selectedEmployeeId);
      fetchYearBalance(selectedEmployeeId);
    } catch (error) {
      console.error('Fehler beim Ablehnen:', error);
      alert('Fehler beim Ablehnen: ' + (error.response?.data?.detail || error.message));
    }
  };

  const cancelRequest = async (id) => {
    try {
      if (!window.confirm('Urlaub wirklich stornieren?')) return;
      await api.patch(`/users/vacation-requests/${id}/`, { status: 'cancelled' });
      fetchVacationsForEmployee(selectedEmployeeId);
      fetchYearBalance(selectedEmployeeId);
      fetchEmployees();
    } catch (error) {
      console.error('Fehler beim Stornieren:', error);
      alert('Fehler beim Stornieren: ' + (error.response?.data?.detail || error.message));
    }
  };

  const handleManualAdjustment = async (e) => {
    e.preventDefault();
    if (!yearBalance?.id) {
      alert('Kein Jahresurlaubskonto gefunden.');
      return;
    }
    try {
      await api.post(`/users/vacation-year-balances/${yearBalance.id}/adjust/`, {
        days: parseFloat(adjustForm.days),
        reason: adjustForm.reason
      });
      setShowAdjustModal(false);
      setAdjustForm({ days: '', reason: '' });
      fetchYearBalance(selectedEmployeeId);
      fetchEmployees();
    } catch (error) {
      console.error('Fehler bei manueller Anpassung:', error);
      alert('Fehler: ' + (error.response?.data?.detail || error.message));
    }
  };

  const handleYearClose = async () => {
    if (!yearBalance?.id) {
      alert('Kein Jahresurlaubskonto gefunden.');
      return;
    }
    if (!window.confirm(`Jahr ${selectedYear} wirklich abschließen? Der Resturlaub wird ins nächste Jahr übertragen.`)) return;
    try {
      const res = await api.post(`/users/vacation-year-balances/${yearBalance.id}/close_year/`);
      alert(res.data.message);
      setShowYearCloseModal(false);
      fetchYearBalance(selectedEmployeeId);
      fetchEmployees();
    } catch (error) {
      console.error('Fehler beim Jahresabschluss:', error);
      alert('Fehler: ' + (error.response?.data?.error || error.response?.data?.detail || error.message));
    }
  };

  const hrPending = hrVacations.filter(r => r.status === 'pending');
  const hrApproved = hrVacations.filter(r => r.status === 'approved');
  const hrRejectedCancelled = hrVacations.filter(r => r.status === 'cancelled' || r.status === 'rejected');

  return (
    <div className="mb-6 bg-white shadow rounded-md p-4">
      {/* Header with employee selector and year selector */}
      <div className="flex flex-wrap items-center gap-4 mb-4">
        <div className="flex-1 min-w-64">
          <label className="block text-sm font-medium text-gray-700 mb-1">Mitarbeiter auswählen</label>
          <select 
            onChange={(e) => setSelectedEmployeeId(e.target.value)} 
            value={selectedEmployeeId || ''} 
            className="block w-full rounded-md border-gray-300 shadow-sm sm:text-sm"
          >
            <option value="">-- bitte wählen --</option>
            {employees.map(emp => (
              <option key={emp.id} value={emp.id}>{emp.employee_id} — {emp.first_name} {emp.last_name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Jahr</label>
          <select 
            value={selectedYear} 
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            className="block rounded-md border-gray-300 shadow-sm sm:text-sm"
          >
            {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        {selectedEmployeeId && yearBalance && (
          <div className="flex gap-2 items-end">
            <button 
              onClick={() => setShowAdjustModal(true)}
              className="px-3 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
            >
              Manuelle Anpassung
            </button>
            {!yearBalance.is_closed && selectedYear < new Date().getFullYear() && (
              <button 
                onClick={() => setShowYearCloseModal(true)}
                className="px-3 py-2 bg-purple-600 text-white text-sm rounded hover:bg-purple-700"
              >
                Jahr abschließen
              </button>
            )}
          </div>
        )}
      </div>

      {selectedEmployeeId && (
        <>
          {/* Balance Overview */}
          <div className="mb-4 grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="p-3 bg-gray-50 rounded">
              <div className="text-sm text-gray-500">Jahresanspruch {selectedYear}</div>
              <div className="text-xl font-semibold">{yearBalance?.entitlement !== undefined ? `${parseFloat(yearBalance.entitlement).toFixed(1)} Tage` : '-'}</div>
            </div>
            <div className="p-3 bg-blue-50 rounded">
              <div className="text-sm text-gray-500">Übertrag</div>
              <div className="text-xl font-semibold text-blue-700">{yearBalance?.carryover !== undefined ? `${parseFloat(yearBalance.carryover).toFixed(1)} Tage` : '-'}</div>
            </div>
            <div className="p-3 bg-indigo-50 rounded">
              <div className="text-sm text-gray-500">Manuelle Anpassungen</div>
              <div className="text-xl font-semibold text-indigo-700">{yearBalance?.manual_adjustment !== undefined ? `${parseFloat(yearBalance.manual_adjustment).toFixed(1)} Tage` : '-'}</div>
            </div>
            <div className="p-3 bg-orange-50 rounded">
              <div className="text-sm text-gray-500">Genommen</div>
              <div className="text-xl font-semibold text-orange-700">{yearBalance?.taken !== undefined ? `${parseFloat(yearBalance.taken).toFixed(1)} Tage` : '-'}</div>
            </div>
            <div className="p-3 bg-green-50 rounded">
              <div className="text-sm text-gray-500">Aktuelles Guthaben</div>
              <div className="text-xl font-semibold text-green-700">{selectedEmployee?.vacation_balance !== undefined ? `${parseFloat(selectedEmployee.vacation_balance).toFixed(1)} Tage` : '-'}</div>
              {yearBalance?.is_closed && <span className="text-xs text-purple-600">Jahr abgeschlossen</span>}
            </div>
          </div>

          {/* Two columns: Requests left, Changelog right */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Left: Vacation Requests */}
            <div className="bg-white border rounded-md">
              <div className="px-4 py-3 bg-gray-50 border-b">
                <h3 className="text-sm font-medium text-gray-900">Urlaubsanträge {selectedYear}</h3>
              </div>
              <div className="p-4 space-y-4 max-h-96 overflow-y-auto">
                {/* Pending */}
                <div>
                  <h4 className="text-xs font-semibold text-yellow-700 uppercase mb-2">Ausstehend ({hrPending.length})</h4>
                  {hrPending.length === 0 ? (
                    <p className="text-sm text-gray-500">Keine ausstehenden Anträge.</p>
                  ) : (
                    <ul className="space-y-2">
                      {hrPending.map(req => (
                        <li key={req.id} className="p-2 bg-yellow-50 rounded border border-yellow-200">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="text-sm font-medium">{new Date(req.start_date).toLocaleDateString()} – {new Date(req.end_date).toLocaleDateString()}</p>
                              <p className="text-xs text-gray-500">{req.days_requested} Tage • {req.reason || 'Kein Grund angegeben'}</p>
                            </div>
                            <div className="flex gap-1">
                              <button onClick={() => approveRequest(req.id)} className="px-2 py-1 text-xs bg-green-600 text-white rounded">Genehmigen</button>
                              <button onClick={() => rejectRequest(req.id)} className="px-2 py-1 text-xs bg-red-600 text-white rounded">Ablehnen</button>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Approved */}
                <div>
                  <h4 className="text-xs font-semibold text-green-700 uppercase mb-2">Genehmigt ({hrApproved.length})</h4>
                  {hrApproved.length === 0 ? (
                    <p className="text-sm text-gray-500">Keine genehmigten Anträge.</p>
                  ) : (
                    <ul className="space-y-2">
                      {hrApproved.map(req => (
                        <li key={req.id} className="p-2 bg-green-50 rounded border border-green-200">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="text-sm font-medium">{new Date(req.start_date).toLocaleDateString()} – {new Date(req.end_date).toLocaleDateString()}</p>
                              <p className="text-xs text-gray-500">{req.days_requested} Tage</p>
                            </div>
                            <button onClick={() => cancelRequest(req.id)} className="px-2 py-1 text-xs bg-yellow-600 text-white rounded">Stornieren</button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Rejected/Cancelled */}
                {hrRejectedCancelled.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Storniert/Abgelehnt ({hrRejectedCancelled.length})</h4>
                    <ul className="space-y-2">
                      {hrRejectedCancelled.map(req => (
                        <li key={req.id} className="p-2 bg-gray-50 rounded border border-gray-200">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="text-sm font-medium text-gray-500">{new Date(req.start_date).toLocaleDateString()} – {new Date(req.end_date).toLocaleDateString()}</p>
                              <p className="text-xs text-gray-400">{req.days_requested} Tage • {req.status === 'cancelled' ? 'Storniert' : 'Abgelehnt'}</p>
                            </div>
                            <button onClick={async () => {
                              if (!window.confirm('Diesen Eintrag wirklich löschen?')) return;
                              try {
                                await api.delete(`/users/vacation-requests/${req.id}/`);
                                fetchVacationsForEmployee(selectedEmployeeId);
                              } catch (err) {
                                alert('Fehler beim Löschen: ' + (err.response?.data?.detail || err.message));
                              }
                            }} className="px-2 py-1 text-xs bg-red-600 text-white rounded">Löschen</button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>

            {/* Right: Changelog */}
            <div className="bg-white border rounded-md">
              <div className="px-4 py-3 bg-gray-50 border-b">
                <h3 className="text-sm font-medium text-gray-900">Änderungsprotokoll {selectedYear}</h3>
              </div>
              {adjustments.length === 0 ? (
                <div className="p-6 text-center text-sm text-gray-500">Keine Änderungen vorhanden.</div>
              ) : (
                <ul className="divide-y divide-gray-200 max-h-96 overflow-y-auto">
                  {adjustments.map((adj) => (
                    <li key={adj.id} className="px-4 py-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-900">{adj.adjustment_type_display}</p>
                          <p className="text-xs text-gray-500">{adj.reason}</p>
                          <p className="text-xs text-gray-400 mt-1">
                            {new Date(adj.created_at).toLocaleDateString()} {new Date(adj.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                            {adj.created_by_name && ` • ${adj.created_by_name}`}
                          </p>
                        </div>
                        <div className="text-right">
                          <span className={`text-sm font-semibold ${parseFloat(adj.days) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {parseFloat(adj.days) >= 0 ? '+' : ''}{parseFloat(adj.days).toFixed(1)} Tage
                          </span>
                          <p className="text-xs text-gray-500">
                            {parseFloat(adj.balance_before).toFixed(1)} → {parseFloat(adj.balance_after).toFixed(1)}
                          </p>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </>
      )}

      {!selectedEmployeeId && (
        <div className="text-center py-8 text-gray-500">
          Bitte wählen Sie einen Mitarbeiter aus.
        </div>
      )}

      {/* Manual Adjustment Modal */}
      {showAdjustModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white p-6 rounded-lg shadow-lg w-96">
            <h3 className="text-lg font-medium mb-4">Manuelle Urlaubsanpassung</h3>
            <p className="text-sm text-gray-500 mb-4">
              Für: {selectedEmployee?.first_name} {selectedEmployee?.last_name}
            </p>
            <form onSubmit={handleManualAdjustment} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Tage (+/-)</label>
                <input
                  type="number"
                  step="0.5"
                  required
                  value={adjustForm.days}
                  onChange={(e) => setAdjustForm({...adjustForm, days: e.target.value})}
                  placeholder="z.B. 2 oder -1.5"
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm"
                />
                <p className="text-xs text-gray-500 mt-1">Positive Zahl = hinzufügen, Negative = abziehen</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Begründung</label>
                <textarea
                  required
                  value={adjustForm.reason}
                  onChange={(e) => setAdjustForm({...adjustForm, reason: e.target.value})}
                  placeholder="Grund für die Anpassung"
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm"
                  rows={3}
                />
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setShowAdjustModal(false)} className="px-3 py-2 text-gray-700 bg-gray-100 rounded">Abbrechen</button>
                <button type="submit" className="px-3 py-2 text-white bg-blue-600 rounded hover:bg-blue-700">Anpassung speichern</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Year Close Modal */}
      {showYearCloseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white p-6 rounded-lg shadow-lg w-96">
            <h3 className="text-lg font-medium mb-4">Jahresabschluss {selectedYear}</h3>
            <p className="text-sm text-gray-500 mb-4">
              Für: {selectedEmployee?.first_name} {selectedEmployee?.last_name}
            </p>
            <div className="bg-purple-50 p-3 rounded mb-4">
              <p className="text-sm">
                <strong>Aktueller Resturlaub:</strong> {yearBalance?.balance !== undefined && yearBalance?.balance !== null ? `${parseFloat(yearBalance.balance).toFixed(1)}` : '-'} Tage
              </p>
              <p className="text-sm text-gray-600 mt-2">
                Diese Tage werden als Übertrag ins Jahr {selectedYear + 1} übernommen.
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowYearCloseModal(false)} className="px-3 py-2 text-gray-700 bg-gray-100 rounded">Abbrechen</button>
              <button onClick={handleYearClose} className="px-3 py-2 text-white bg-purple-600 rounded hover:bg-purple-700">Jahr abschließen</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};


export default EmployeeList;

