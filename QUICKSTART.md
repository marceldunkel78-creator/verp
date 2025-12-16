# VERP Quick Start Guide

## Erste Schritte nach der Installation

### 1. Erstellen Sie einen Admin-Benutzer

```powershell
# Lokale Entwicklung
cd backend
python manage.py createsuperuser

# Docker
docker-compose exec backend python manage.py createsuperuser
```

Geben Sie die gewünschten Daten ein:
- Benutzername
- E-Mail
- Passwort

### 2. Öffnen Sie die Anwendung

- **Lokale Entwicklung**: http://localhost:3000
- **Docker**: http://localhost

Melden Sie sich mit dem gerade erstellten Admin-Account an.

### 3. Dashboard erkunden

Nach dem Login sehen Sie das Dashboard mit:
- Statistiken (Benutzer, Lieferanten, Produkte)
- Modul-Buttons für verschiedene Bereiche

### 4. Ersten Lieferanten anlegen

1. Klicken Sie auf "Lieferanten" im Dashboard oder in der Sidebar
2. Klicken Sie auf "+ Neuer Lieferant"
3. Füllen Sie die Felder aus:
   - Firmenname (Pflichtfeld)
   - Adresse, E-Mail, Telefon
   - Notizen
4. Optional: Fügen Sie Kontakte hinzu (Service, Vertrieb, Bestellungen)
5. Klicken Sie auf "Speichern"

### 5. Weitere Benutzer anlegen (Admin-Funktion)

1. Klicken Sie auf "Benutzerverwaltung"
2. Klicken Sie auf "+ Neuer Benutzer"
3. Füllen Sie die Felder aus und weisen Sie Berechtigungen zu
4. Speichern

## Tipps

- **Admin-Interface**: Für erweiterte Funktionen können Sie auch das Django Admin-Interface nutzen: http://localhost:8000/admin
- **API-Dokumentation**: Die REST API ist verfügbar unter http://localhost:8000/api/
- **Produktkategorien**: Erstellen Sie zuerst Produktkategorien über das Admin-Interface, bevor Sie Produkte anlegen

## Nächste Schritte

- Erkunden Sie die verschiedenen Module
- Passen Sie Berechtigungen für Benutzer an
- Verknüpfen Sie Produkte mit Lieferanten
- Erweitern Sie das System nach Bedarf

## Hilfe benötigt?

Schauen Sie in die Hauptdokumentation (README.md) für detaillierte Informationen.
