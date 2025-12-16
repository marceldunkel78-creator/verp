# VERP - Visitron ERP System

Ein maßgeschneidertes ERP-System für Visitron Systems GmbH, entwickelt mit Django (Backend), React (Frontend) und PostgreSQL (Datenbank).

## 🚀 Features

### Bereits implementiert:
- ✅ **Benutzerauthentifizierung**: JWT-basiertes Login-System
- ✅ **Dashboard**: Übersichtliches Dashboard mit Statistiken und Modul-Buttons
- ✅ **Benutzerverwaltung**: Vollständige CRUD-Operationen für Benutzer mit Rollenverwaltung
- ✅ **Lieferantenverwaltung**: 
  - Verwaltung von Lieferanten mit detaillierten Informationen
  - Multiple Kontakte pro Lieferant (Service, Vertrieb, Bestellungen)
  - Verknüpfung mit Vertriebswaren
  - Lieferantenspezifische Produktinformationen (Preise, Lieferzeiten)

### Geplante Module:
- 📋 Buchhaltung
- 📊 Financial Reporting
- 👥 HR (Personalverwaltung)
- 🤝 Kundendaten
- 🏪 Händlerdaten
- 📦 Vertriebswaren (erweitert)
- 🏭 Eigenprodukte
- ⚙️ Manufacturing
- 🛠️ Service/Support
- 📣 Marketing
- 📧 Email
- 📝 Projekt/Auftragsabwicklung

## 🛠️ Technologie-Stack

- **Backend**: Python 3.11, Django 5.0, Django REST Framework
- **Frontend**: React 18, Tailwind CSS, Axios
- **Datenbank**: PostgreSQL 16
- **Authentifizierung**: JWT (Simple JWT)
- **Containerisierung**: Docker & Docker Compose
- **Deployment**: Synology NAS (Docker)

## 📋 Voraussetzungen

### Für die lokale Entwicklung:
- Python 3.11+
- Node.js 18+
- PostgreSQL 16+ (oder verwenden Sie Docker)

### Für Docker-Deployment:
- Docker
- Docker Compose

## 🚀 Installation und Setup

### Methode 1: Lokale Entwicklung

#### Backend Setup

1. **Virtuelle Umgebung erstellen und aktivieren:**
```powershell
cd backend
python -m venv venv
.\venv\Scripts\Activate
```

2. **Abhängigkeiten installieren:**
```powershell
pip install -r requirements.txt
```

3. **Datenbank einrichten:**

Erstellen Sie eine PostgreSQL-Datenbank:
```sql
CREATE DATABASE verp_db;
CREATE USER verp_user WITH PASSWORD 'verp_password';
GRANT ALL PRIVILEGES ON DATABASE verp_db TO verp_user;
```

4. **Migrationen ausführen:**
```powershell
python manage.py makemigrations
python manage.py migrate
```

5. **Superuser erstellen:**
```powershell
python manage.py createsuperuser
```

6. **Entwicklungsserver starten:**
```powershell
python manage.py runserver
```

Backend läuft nun auf: http://localhost:8000

#### Frontend Setup

1. **Ins Frontend-Verzeichnis wechseln:**
```powershell
cd frontend
```

2. **Abhängigkeiten installieren:**
```powershell
npm install
```

3. **Tailwind CSS installieren:**
```powershell
npm install -D tailwindcss postcss autoprefixer
npm install @heroicons/react
```

4. **Entwicklungsserver starten:**
```powershell
npm start
```

Frontend läuft nun auf: http://localhost:3000

### Methode 2: Docker Deployment

1. **Docker Compose starten:**
```powershell
docker-compose up -d
```

2. **Datenbank-Migrationen ausführen:**
```powershell
docker-compose exec backend python manage.py migrate
```

3. **Superuser erstellen:**
```powershell
docker-compose exec backend python manage.py createsuperuser
```

Die Anwendung ist nun verfügbar:
- Frontend: http://localhost
- Backend API: http://localhost:8000/api
- Django Admin: http://localhost:8000/admin

## 📁 Projektstruktur

```
VERP/
├── backend/                    # Django Backend
│   ├── verp/                  # Hauptprojekt-Konfiguration
│   │   ├── settings.py        # Django Einstellungen
│   │   ├── urls.py            # Haupt-URL-Konfiguration
│   │   └── wsgi.py            # WSGI Konfiguration
│   ├── users/                 # Benutzerverwaltung App
│   ├── suppliers/             # Lieferanten App
│   ├── core/                  # Core/Dashboard App
│   ├── manage.py              # Django Management
│   └── requirements.txt       # Python Abhängigkeiten
│
├── frontend/                   # React Frontend
│   ├── public/                # Statische Dateien
│   ├── src/
│   │   ├── components/        # React Komponenten
│   │   ├── pages/             # Seiten-Komponenten
│   │   ├── context/           # Context (Auth)
│   │   ├── services/          # API Services
│   │   ├── App.js             # Hauptkomponente
│   │   └── index.js           # Entry Point
│   ├── package.json           # NPM Abhängigkeiten
│   └── tailwind.config.js     # Tailwind Konfiguration
│
├── docker-compose.yml          # Docker Compose Konfiguration
├── Dockerfile.backend          # Backend Docker Image
├── Dockerfile.frontend         # Frontend Docker Image
├── nginx.conf                  # Nginx Konfiguration
└── README.md                   # Diese Datei
```

## 🔐 API Endpunkte

### Authentifizierung
- `POST /api/auth/login/` - Login (JWT Token erhalten)
- `POST /api/auth/refresh/` - Token erneuern

### Benutzer
- `GET /api/users/` - Liste aller Benutzer
- `POST /api/users/` - Neuen Benutzer erstellen
- `GET /api/users/{id}/` - Benutzer-Details
- `PUT /api/users/{id}/` - Benutzer aktualisieren
- `DELETE /api/users/{id}/` - Benutzer löschen
- `GET /api/users/me/` - Aktueller Benutzer

### Lieferanten
- `GET /api/suppliers/suppliers/` - Liste aller Lieferanten
- `POST /api/suppliers/suppliers/` - Neuen Lieferanten erstellen
- `GET /api/suppliers/suppliers/{id}/` - Lieferanten-Details
- `PUT /api/suppliers/suppliers/{id}/` - Lieferanten aktualisieren
- `DELETE /api/suppliers/suppliers/{id}/` - Lieferanten löschen

### Lieferanten-Kontakte
- `GET /api/suppliers/contacts/` - Liste aller Kontakte
- `POST /api/suppliers/contacts/` - Neuen Kontakt erstellen

### Produkte
- `GET /api/suppliers/products/` - Liste aller Vertriebswaren
- `POST /api/suppliers/products/` - Neue Vertriebsware erstellen
- `GET /api/suppliers/categories/` - Produktkategorien

### Dashboard
- `GET /api/core/dashboard/` - Dashboard Statistiken und Module
- `GET /api/core/modules/` - Alle verfügbaren Module

## 👥 Lieferanten-Datenmodell

### Hauptfelder:
- Firmenname (Pflichtfeld)
- Adresse
- E-Mail
- Telefonnummer
- Notizen
- Status (Aktiv/Inaktiv)

### Kontakte (mehrfach möglich):
Für jeden Kontakttyp (Service, Vertrieb, Bestellungen):
- Ansprechpartner
- Funktion
- Adresse
- E-Mail
- Telefonnummer
- Notizen

### Produktverknüpfungen:
- Vertriebswaren können mit Lieferanten verknüpft werden
- Lieferantenspezifische Informationen:
  - Lieferanten-Artikelnummer
  - Einkaufspreis
  - Währung
  - Lieferzeit (Tage)
  - Mindestbestellmenge
  - Bevorzugter Lieferant (Ja/Nein)

## 🔧 Konfiguration

### Environment Variables (für Produktion)

Erstellen Sie eine `.env` Datei im Backend-Verzeichnis:

```env
DEBUG=False
SECRET_KEY=ihr-geheimer-schlüssel
ALLOWED_HOSTS=ihre-domain.de,localhost

POSTGRES_DB=verp_db
POSTGRES_USER=verp_user
POSTGRES_PASSWORD=sicheres-passwort
POSTGRES_HOST=db
POSTGRES_PORT=5432
```

## 📦 Deployment auf Synology NAS

1. **Docker und Docker Compose auf Synology installieren**
   - Öffnen Sie das Paketzentrum
   - Installieren Sie "Container Manager" (ehemals Docker)

2. **Projekt auf NAS hochladen**
   - Kopieren Sie das gesamte VERP-Verzeichnis auf Ihre NAS
   - Z.B. nach `/volume1/docker/verp/`

3. **Docker Compose ausführen**
   - Öffnen Sie SSH oder das Terminal
   - Navigieren Sie zum Projektverzeichnis
   - Führen Sie aus: `docker-compose up -d`

4. **Initiale Setup-Schritte**
   ```bash
   docker-compose exec backend python manage.py migrate
   docker-compose exec backend python manage.py createsuperuser
   ```

5. **Zugriff auf die Anwendung**
   - Öffnen Sie im Browser: `http://ihre-nas-ip`

## 🔒 Sicherheit

Für die Produktion beachten Sie:
- Ändern Sie `SECRET_KEY` in den Django-Einstellungen
- Setzen Sie `DEBUG=False`
- Konfigurieren Sie `ALLOWED_HOSTS` korrekt
- Verwenden Sie starke Passwörter für die Datenbank
- Aktivieren Sie HTTPS mit einem SSL-Zertifikat
- Konfigurieren Sie eine Firewall

## 📝 Entwicklung

### Neue Django App hinzufügen:
```powershell
cd backend
python manage.py startapp neue_app
```

Vergessen Sie nicht, die App in `INSTALLED_APPS` in `settings.py` hinzuzufügen.

### Datenmodell-Änderungen:
```powershell
python manage.py makemigrations
python manage.py migrate
```

### Tests ausführen:
```powershell
python manage.py test
```

## 🐛 Troubleshooting

### Backend startet nicht:
- Überprüfen Sie die Datenbankverbindung
- Stellen Sie sicher, dass alle Migrationen ausgeführt wurden
- Prüfen Sie die Logs: `docker-compose logs backend`

### Frontend zeigt keine Daten:
- Überprüfen Sie die CORS-Einstellungen im Backend
- Stellen Sie sicher, dass das Backend läuft
- Prüfen Sie die Browser-Konsole auf Fehler

### Docker-Container startet nicht:
- Prüfen Sie die Logs: `docker-compose logs`
- Stellen Sie sicher, dass die Ports nicht belegt sind
- Führen Sie `docker-compose down` und dann `docker-compose up -d` aus

## 📧 Kontakt

Visitron Systems GmbH

---

**Version:** 0.1.0  
**Letzte Aktualisierung:** Dezember 2025
