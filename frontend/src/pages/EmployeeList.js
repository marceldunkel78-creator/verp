import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { PlusIcon, PencilIcon, TrashIcon, UserGroupIcon } from '@heroicons/react/24/outline';
import { useMemo } from 'react';



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
    employment_status: 'aktiv'
  });

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
      console.log('Submitting:', editingEmployee, formData);
      // Erstelle eine Kopie der Daten und entferne leere optionale Felder und read-only Felder
      const submitData = { ...formData };
      if (!submitData.employment_end_date) {
        delete submitData.employment_end_date;
      }
      delete submitData.employee_id; // Immer automatisch generiert
      if (editingEmployee) {
        console.log('PUT to:', `/users/employees/${editingEmployee.id}/`);
        await api.put(`/users/employees/${editingEmployee.id}/`, submitData);
      } else {
        await api.post('/users/employees/', submitData);
      }
      fetchEmployees();
      setShowModal(false);
      setEditingEmployee(null);
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
      employment_status: employee.employment_status || 'aktiv'
    });
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

  // HR vacation management
  const [hrVacations, setHrVacations] = useState([]);

  const fetchVacationsForEmployee = async (empId) => {
    try {
      setHrVacations([]);
      if (!empId) return;
      const res = await api.get(`/users/vacation-requests/?employee=${empId}`);
      const data = res.data.results || res.data;
      setHrVacations(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Fehler beim Laden der Urlaubsanträge:', error);
      setHrVacations([]);
    }
  };

  const approveRequest = async (id) => {
    try {
      await api.patch(`/users/vacation-requests/${id}/`, { status: 'approved' });
      if (selectedEmployeeId) {
        fetchVacationsForEmployee(selectedEmployeeId);
      }
      fetchEmployees();
    } catch (error) {
      console.error('Fehler beim Genehmigen:', error);
      alert('Fehler beim Genehmigen: ' + (error.response?.data?.detail || error.message));
    }
  };

  const rejectRequest = async (id) => {
    try {
      await api.patch(`/users/vacation-requests/${id}/`, { status: 'rejected' });
      if (selectedEmployeeId) {
        fetchVacationsForEmployee(selectedEmployeeId);
      }
    } catch (error) {
      console.error('Fehler beim Ablehnen:', error);
      alert('Fehler beim Ablehnen: ' + (error.response?.data?.detail || error.message));
    }
  };

  const cancelRequest = async (id) => {
    try {
      if (!window.confirm('Urlaub wirklich stornieren?')) return;
      await api.patch(`/users/vacation-requests/${id}/`, { status: 'cancelled' });
      if (selectedEmployeeId) {
        fetchVacationsForEmployee(selectedEmployeeId);
      }
      fetchEmployees();
    } catch (error) {
      console.error('Fehler beim Stornieren:', error);
      alert('Fehler beim Stornieren: ' + (error.response?.data?.detail || error.message));
    }
  };

  const hrPending = hrVacations.filter(r => r.status === 'pending');
  const hrApproved = hrVacations.filter(r => r.status === 'approved');



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
      employment_status: 'aktiv'
    });
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
          <div className="mb-6 bg-white shadow rounded-md p-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Mitarbeiter auswählen</label>
            <select onChange={(e) => { setSelectedEmployeeId(e.target.value); fetchVacationsForEmployee(e.target.value); }} value={selectedEmployeeId || ''} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm">
              <option value="">-- bitte wählen --</option>
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>{emp.employee_id} — {emp.first_name} {emp.last_name}</option>
              ))}
            </select>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-3 bg-gray-50 rounded">
                <div className="text-sm text-gray-600">Aktuelles Urlaubskonto</div>
                <div className="text-xl font-semibold">{selectedEmployeeId ? (() => {
                  const emp = employees.find(e => String(e.id) === String(selectedEmployeeId));
                  return emp ? (emp.vacation_balance !== undefined ? `${parseFloat(emp.vacation_balance).toFixed(1)} Tage` : '-') : '-';
                })() : '-'} </div>
              </div>
              <div className="p-3 bg-gray-50 rounded">
                <div className="text-sm text-gray-600">Jahresurlaub</div>
                <div className="text-xl font-semibold">{selectedEmployeeId ? (() => {
                  const emp = employees.find(e => String(e.id) === String(selectedEmployeeId));
                  return emp ? (emp.annual_vacation_days !== undefined ? `${emp.annual_vacation_days} Tage` : '-') : '-';
                })() : '-'} </div>
              </div>
            </div>

            <div className="mt-4">
              <h3 className="text-sm font-medium text-gray-900">Ausstehende Anträge</h3>
              {hrPending.length === 0 ? <div className="text-sm text-gray-500 mt-2">Keine ausstehenden Anträge.</div> : (
                <ul className="divide-y divide-gray-200 mt-2">
                  {hrPending.map(req => (
                    <li key={req.id} className="py-2 flex justify-between items-center">
                      <div>
                        <div className="text-sm font-medium">{req.start_date} – {req.end_date} ({req.days_requested} Tage)</div>
                        <div className="text-sm text-gray-500">{req.reason || ''} — Eingereicht von {req.user ? `${req.user.first_name} ${req.user.last_name}` : '–'}</div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button onClick={() => approveRequest(req.id)} className="px-3 py-1 bg-green-600 text-white rounded">Genehmigen</button>
                        <button onClick={() => rejectRequest(req.id)} className="px-3 py-1 bg-red-600 text-white rounded">Ablehnen</button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              <h3 className="text-sm font-medium text-gray-900 mt-6">Genehmigte Anträge</h3>
              {hrApproved.length === 0 ? <div className="text-sm text-gray-500 mt-2">Keine genehmigten Anträge.</div> : (
                <ul className="divide-y divide-gray-200 mt-2">
                  {hrApproved.map(req => (
                    <li key={req.id} className="py-2 flex justify-between items-center">
                      <div>
                        <div className="text-sm font-medium">{req.start_date} – {req.end_date} ({req.days_requested} Tage)</div>
                        <div className="text-sm text-gray-500">Genehmigt am {req.approved_at ? new Date(req.approved_at).toLocaleDateString() : '-'} von {req.approved_by ? `${req.approved_by.first_name} ${req.approved_by.last_name}` : '-'}</div>
                      </div>
                      <div>
                        <button onClick={() => cancelRequest(req.id)} className="px-3 py-1 bg-yellow-600 text-white rounded">Stornieren</button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              <h3 className="text-sm font-medium text-gray-900 mt-6">Storniert und Abgelehnt</h3>
              { (hrVacations.filter(r => r.status === 'cancelled' || r.status === 'rejected')).length === 0 ? (
                <div className="text-sm text-gray-500 mt-2">Keine stornierten oder abgelehnten Anträge.</div>
              ) : (
                <ul className="divide-y divide-gray-200 mt-2">
                  {hrVacations.filter(r => r.status === 'cancelled' || r.status === 'rejected').map(req => (
                    <li key={req.id} className="py-2 flex justify-between items-center">
                      <div>
                        <div className="text-sm font-medium">{req.start_date} – {req.end_date} ({req.days_requested} Tage)</div>
                        <div className="text-sm text-gray-500">{req.status === 'cancelled' ? 'Storniert' : 'Abgelehnt'} — Eingereicht von {req.user ? `${req.user.first_name} ${req.user.last_name}` : '–'}</div>
                      </div>
                      <div>
                        <button onClick={async () => {
                          if (!window.confirm('Diesen Eintrag wirklich löschen?')) return;
                          try {
                            await api.delete(`/users/vacation-requests/${req.id}/`);
                            fetchVacationsForEmployee(selectedEmployeeId);
                          } catch (err) {
                            console.error('Fehler beim Löschen:', err);
                            alert('Fehler beim Löschen: ' + (err.response?.data?.detail || err.message));
                          }
                        }} className="px-3 py-1 bg-red-600 text-white rounded">Löschen</button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}

            </div>
          </div>
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

