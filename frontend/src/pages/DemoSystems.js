import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { SYSTEM_STATUS_STYLES } from '../components/demo/DemoSetupDiagram';

const DemoSystems = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [demoSystems, setDemoSystems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const canWrite = user?.is_superuser || user?.can_write_inventory_demo_systems === true;

  const fetchDemoSystems = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      const res = await api.get(`/demo-systems/demo-systems/?${params.toString()}`);
      setDemoSystems(res.data.results || res.data);
    } catch (err) {
      console.error('Fehler beim Laden der Demo-Systeme:', err);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    const t = setTimeout(fetchDemoSystems, 300);
    return () => clearTimeout(t);
  }, [fetchDemoSystems]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Demo-Systeme</h1>
          <p className="mt-2 text-sm text-gray-600">
            Mikroskop-Demosysteme: Setup-Konfiguration, Geräte, Belegung und Änderungsprotokoll
          </p>
        </div>
        {canWrite && (
          <Link
            to="/inventory/demo-systems/new"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
          >
            + Neues Demo-System
          </Link>
        )}
      </div>

      {/* Suche */}
      <div className="bg-white rounded-lg shadow p-4 mb-4">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Suchen (Nummer, Name, Standort, Beschreibung)..."
          className="w-full max-w-md px-3 py-2 border rounded-lg text-sm"
        />
      </div>

      {/* Tabelle */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <p className="p-4 text-sm text-gray-500">Wird geladen...</p>
        ) : demoSystems.length === 0 ? (
          <p className="p-4 text-sm text-gray-400 italic">
            Keine Demo-Systeme vorhanden.
            {canWrite && ' Legen Sie über "Neues Demo-System" eines an.'}
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 border-b bg-gray-50">
                <th className="py-2 px-4">Nummer</th>
                <th className="py-2 px-2">Name</th>
                <th className="py-2 px-2">Standort</th>
                <th className="py-2 px-2">Beschreibung</th>
                <th className="py-2 px-2 text-center">Geräte</th>
                <th className="py-2 px-2 text-center">Buchungen</th>
                <th className="py-2 px-2">Gesamt-Status</th>
              </tr>
            </thead>
            <tbody>
              {demoSystems.map((ds) => (
                <tr
                  key={ds.id}
                  onClick={() => navigate(`/inventory/demo-systems/${ds.id}`)}
                  className="border-b last:border-0 hover:bg-gray-50 cursor-pointer"
                >
                  <td className="py-2.5 px-4 font-mono text-xs">{ds.demo_number}</td>
                  <td className="py-2.5 px-2 font-medium">{ds.name}</td>
                  <td className="py-2.5 px-2">{ds.location || '–'}</td>
                  <td className="py-2.5 px-2 text-gray-500 max-w-xs truncate">{ds.description || '–'}</td>
                  <td className="py-2.5 px-2 text-center">{ds.device_count}</td>
                  <td className="py-2.5 px-2 text-center">{ds.booking_count}</td>
                  <td className="py-2.5 px-2">
                    {(() => {
                      const st = SYSTEM_STATUS_STYLES[ds.status] || SYSTEM_STATUS_STYLES.active;
                      return (
                        <span className={`text-xs px-2 py-0.5 rounded-full ${st.badge}`}>
                          {ds.status_display || st.label}
                        </span>
                      );
                    })()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default DemoSystems;