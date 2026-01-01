import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './AddressMap.css';

// Fix für Leaflet Marker Icons in React
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Komponente für das Setzen des Markers durch Klick
const LocationMarker = ({ position, setPosition, editable }) => {
  const map = useMapEvents({
    click(e) {
      if (editable) {
        setPosition([e.latlng.lat, e.latlng.lng]);
      }
    },
  });

  useEffect(() => {
    if (position && map) {
      map.setView(position, map.getZoom());
    }
  }, [position, map]);

  return position ? <Marker position={position} /> : null;
};

const AddressMap = ({ 
  latitude, 
  longitude, 
  address, 
  onPositionChange, 
  editable = true,
  height = '400px' 
}) => {
  const [position, setPosition] = useState(null);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const mapRef = useRef(null);

  console.log('AddressMap rendered with:', { latitude, longitude, address });

  useEffect(() => {
    const latPresent = latitude !== null && latitude !== undefined;
    const lonPresent = longitude !== null && longitude !== undefined;
    if (latPresent && lonPresent) {
      setPosition([parseFloat(latitude), parseFloat(longitude)]);
    } else if (address && !latPresent && !lonPresent) {
      // Auto-Geocoding wenn Adresse vorhanden aber keine Koordinaten
      geocodeAddress(address);
    }
  }, [latitude, longitude, address]);

  const geocodeAddress = async (addr) => {
    if (!addr) return;
    
    setIsGeocoding(true);
    try {
      // Nominatim Geocoding API (OpenStreetMap)
      const fullAddress = `${addr.street} ${addr.house_number}, ${addr.postal_code} ${addr.city}, ${addr.country}`;
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(fullAddress)}&limit=1`
      );
      const data = await response.json();
      
      if (data && data.length > 0) {
        const lat = parseFloat(data[0].lat);
        const lon = parseFloat(data[0].lon);
        const newPosition = [lat, lon];
        setPosition(newPosition);
        if (onPositionChange) {
          onPositionChange(lat, lon);
        }
      }
    } catch (error) {
      console.error('Geocoding error:', error);
    } finally {
      setIsGeocoding(false);
    }
  };

  const handlePositionChange = (newPosition) => {
    setPosition(newPosition);
    if (onPositionChange) {
      onPositionChange(newPosition[0], newPosition[1]);
    }
  };

  const handleRecenter = () => {
    if (address) {
      geocodeAddress(address);
    }
  };

  // Default Position (Deutschland Mitte) falls keine Koordinaten
  const defaultPosition = [51.1657, 10.4515];
  const mapPosition = position || defaultPosition;
  const zoom = position ? 16 : 6;
  const mapKey = `${mapPosition[0]}-${mapPosition[1]}`; // Für Re-Rendering bei Positionsänderung

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <label className="block text-sm font-medium text-gray-700">
          Standort auf Karte
          {editable && (
            <span className="ml-2 text-xs text-gray-500">
              (Klicken Sie auf die Karte, um die Position zu setzen)
            </span>
          )}
        </label>
        {address && (
          <button
            type="button"
            onClick={handleRecenter}
            disabled={isGeocoding}
            className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400"
          >
            {isGeocoding ? 'Suche...' : '📍 Adresse suchen'}
          </button>
        )}
      </div>
      
      <div style={{ height, width: '100%', borderRadius: '8px', overflow: 'hidden', border: '1px solid #e5e7eb' }}>
        <MapContainer
          key={mapKey}
          center={mapPosition}
          zoom={zoom}
          style={{ height: '100%', width: '100%' }}
          scrollWheelZoom={true}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <LocationMarker 
            position={position} 
            setPosition={handlePositionChange}
            editable={editable}
          />
        </MapContainer>
      </div>

      {position && (
        <div className="text-xs text-gray-600">
          <span className="font-medium">Koordinaten:</span> {position[0].toFixed(6)}, {position[1].toFixed(6)}
        </div>
      )}

      {!position && !isGeocoding && (
        <div className="text-sm text-yellow-600 bg-yellow-50 p-2 rounded">
          ⚠️ Keine Koordinaten gesetzt. {address ? 'Klicken Sie auf "Adresse suchen" oder ' : ''} Klicken Sie auf die Karte, um die Position zu markieren.
        </div>
      )}
    </div>
  );
};

export default AddressMap;
