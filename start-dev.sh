#!/bin/bash

echo "🚀 VERP - Lokale Entwicklungsumgebung starten"
echo "=============================================="

# Backend starten
echo ""
echo "📦 Backend wird gestartet..."
cd backend
if [ ! -d "venv" ]; then
    echo "Virtuelle Umgebung wird erstellt..."
    python -m venv venv
fi

source venv/bin/activate  # Für Linux/Mac
# Für Windows PowerShell: .\venv\Scripts\Activate

pip install -r requirements.txt

echo "Migrationen werden ausgeführt..."
python manage.py migrate

echo "Backend-Server startet auf Port 8000..."
python manage.py runserver &

BACKEND_PID=$!

# Frontend starten
cd ../frontend
echo ""
echo "🎨 Frontend wird gestartet..."

if [ ! -d "node_modules" ]; then
    echo "Node-Module werden installiert..."
    npm install
fi

echo "Frontend-Server startet auf Port 3000..."
npm start &

FRONTEND_PID=$!

echo ""
echo "✅ VERP läuft jetzt!"
echo "================================"
echo "Frontend: http://localhost:3000"
echo "Backend:  http://localhost:8000"
echo "Admin:    http://localhost:8000/admin"
echo ""
echo "Drücken Sie Ctrl+C zum Beenden"

# Warten auf Beenden
wait $BACKEND_PID
wait $FRONTEND_PID
