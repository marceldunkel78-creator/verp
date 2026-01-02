#!/usr/bin/env python
"""
Import-Skript für VisiView Tickets aus issues.csv (Redmine Export)

Importiert Bug/Fehler und Feature Request Tickets aus der CSV-Datei
in das VisiView Ticketsystem.

Verwendung:
    python manage.py shell < import_visiview_tickets.py
    
    oder im Django-Shell:
    exec(open('import_visiview_tickets.py').read())
"""

import os
import sys
import csv
import django
from datetime import datetime
from decimal import Decimal, InvalidOperation

# Django Setup
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'verp.settings')
django.setup()

from django.contrib.auth import get_user_model
from visiview.models import VisiViewTicket, VisiViewTicketComment

User = get_user_model()


def parse_datetime(date_str):
    """Parst ein Datum aus dem CSV-Format DD.MM.YYYY HH:MM"""
    if not date_str or date_str.strip() == '':
        return None
    try:
        # Format: DD.MM.YYYY HH:MM
        return datetime.strptime(date_str.strip(), '%d.%m.%Y %H:%M')
    except ValueError:
        try:
            # Format: DD.MM.YYYY
            return datetime.strptime(date_str.strip(), '%d.%m.%Y')
        except ValueError:
            return None


def parse_date(date_str):
    """Parst ein Datum aus dem CSV-Format DD.MM.YYYY"""
    if not date_str or date_str.strip() == '':
        return None
    try:
        return datetime.strptime(date_str.strip(), '%d.%m.%Y').date()
    except ValueError:
        return None


def parse_decimal(value_str):
    """Parst eine Dezimalzahl aus dem CSV-Format (mit Komma als Dezimaltrenner)"""
    if not value_str or value_str.strip() == '':
        return None
    try:
        # Ersetze Komma durch Punkt für Dezimalzahlen
        cleaned = value_str.strip().replace(',', '.')
        return Decimal(cleaned)
    except InvalidOperation:
        return None


def parse_int(value_str):
    """Parst eine Ganzzahl aus dem CSV"""
    if not value_str or value_str.strip() == '':
        return 0
    try:
        return int(value_str.strip())
    except ValueError:
        return 0


def map_tracker(tracker_str):
    """Mappt den Tracker-Typ aus dem CSV auf die Model-Choices"""
    tracker_str = tracker_str.strip().lower()
    if 'bug' in tracker_str or 'fehler' in tracker_str:
        return 'bug'
    elif 'feature' in tracker_str:
        return 'feature'
    return 'bug'


def map_status(status_str):
    """Mappt den Status aus dem CSV auf die Model-Choices"""
    status_mapping = {
        'neu': 'new',
        'new': 'new',
        'zugewiesen': 'assigned',
        'assigned': 'assigned',
        'bearbeitet': 'in_progress',
        'in progress': 'in_progress',
        'in bearbeitung': 'in_progress',
        'testen: extern': 'testing',
        'testing': 'testing',
        'getestet': 'tested',
        'tested': 'tested',
        'gelöst': 'resolved',
        'resolved': 'resolved',
        'geschlossen': 'closed',
        'closed': 'closed',
        'abgelehnt': 'rejected',
        'rejected': 'rejected',
    }
    status_lower = status_str.strip().lower()
    return status_mapping.get(status_lower, 'new')


def map_priority(priority_str):
    """Mappt die Priorität aus dem CSV auf die Model-Choices"""
    priority_mapping = {
        'niedrig': 'low',
        'low': 'low',
        'normal': 'normal',
        'hoch': 'high',
        'high': 'high',
        'dringend': 'urgent',
        'urgent': 'urgent',
        'sofort': 'immediate',
        'immediate': 'immediate',
    }
    priority_lower = priority_str.strip().lower()
    return priority_mapping.get(priority_lower, 'normal')


def map_category(category_str):
    """Mappt die Kategorie aus dem CSV auf die Model-Choices"""
    category_mapping = {
        'applikation': 'application',
        'application': 'application',
        'datenanalyse allgemein': 'data_analysis',
        'data analysis': 'data_analysis',
        'datenmanagement': 'data_management',
        'data management': 'data_management',
        'deconvolution': 'deconvolution',
        'hardware: kamera': 'hardware_camera',
        'hardware: mikroskop': 'hardware_microscope',
        'hardware: orbital': 'hardware_orbital',
        'hardware: visitirf/frap': 'hardware_tirf_frap',
        'hardware: sonstiges': 'hardware_other',
        'sonstiges': 'other',
    }
    category_lower = category_str.strip().lower()
    return category_mapping.get(category_lower, '')


def find_user_by_name(name_str):
    """Versucht einen User anhand des Namens zu finden"""
    if not name_str or name_str.strip() == '':
        return None
    
    name_str = name_str.strip()
    
    # Versuche exakte Übereinstimmung mit Vor- und Nachname
    parts = name_str.split()
    if len(parts) >= 2:
        first_name = parts[0]
        last_name = ' '.join(parts[1:])
        user = User.objects.filter(first_name__iexact=first_name, last_name__iexact=last_name).first()
        if user:
            return user
    
    # Versuche mit Username
    user = User.objects.filter(username__iexact=name_str).first()
    if user:
        return user
    
    # Versuche mit nur Nachname
    user = User.objects.filter(last_name__iexact=name_str).first()
    if user:
        return user
    
    return None


def import_tickets(csv_path, dry_run=False):
    """
    Importiert Tickets aus der CSV-Datei
    
    Args:
        csv_path: Pfad zur CSV-Datei
        dry_run: Wenn True, werden keine Daten geschrieben
    """
    print(f"\n{'='*60}")
    print(f"VisiView Ticket Import")
    print(f"{'='*60}")
    print(f"CSV-Datei: {csv_path}")
    print(f"Dry Run: {dry_run}")
    print(f"{'='*60}\n")
    
    if not os.path.exists(csv_path):
        print(f"FEHLER: CSV-Datei nicht gefunden: {csv_path}")
        return
    
    # Statistiken
    stats = {
        'total': 0,
        'imported': 0,
        'updated': 0,
        'skipped': 0,
        'errors': 0,
        'bugs': 0,
        'features': 0,
    }
    
    # CSV einlesen mit verschiedenen Encodings probieren
    encodings = ['utf-8', 'utf-8-sig', 'latin-1', 'cp1252', 'iso-8859-1']
    rows = None
    
    for encoding in encodings:
        try:
            with open(csv_path, 'r', encoding=encoding) as f:
                # Semikolon als Trennzeichen (deutsches CSV-Format)
                reader = csv.DictReader(f, delimiter=';')
                rows = list(reader)
            print(f"CSV erfolgreich mit Encoding '{encoding}' gelesen")
            break
        except UnicodeDecodeError:
            continue
        except Exception as e:
            print(f"Fehler beim Lesen mit Encoding '{encoding}': {e}")
            continue
    
    if rows is None:
        print("FEHLER: CSV konnte mit keinem Encoding gelesen werden")
        return
    
    print(f"Gefundene Zeilen: {len(rows)}")
    print(f"Spalten: {rows[0].keys() if rows else 'Keine'}")
    print()
    
    # Spalten-Mapping (CSV-Spaltenname -> interner Name)
    # Die CSV hat möglicherweise BOM oder andere Kodierungsprobleme in Spaltennamen
    def get_column(row, *possible_names):
        """Holt einen Wert aus einer Zeile, versucht verschiedene Spaltennamen"""
        for name in possible_names:
            if name in row:
                return row[name]
            # Versuche auch mit Encoding-Artefakten
            for key in row.keys():
                if name.lower() in key.lower():
                    return row[key]
        return ''
    
    for row in rows:
        stats['total'] += 1
        
        try:
            # Ticket-Nummer (erste Spalte #)
            ticket_number = get_column(row, '#', 'Nr', 'Nummer', 'ID')
            if not ticket_number or not ticket_number.strip().isdigit():
                print(f"  Überspringe Zeile ohne gültige Ticket-Nummer: {ticket_number}")
                stats['skipped'] += 1
                continue
            
            ticket_number = ticket_number.strip()
            
            # Prüfe ob nur VisiView-Projekt
            project = get_column(row, 'Projekt', 'Project')
            if project and 'visiview' not in project.lower():
                print(f"  Überspringe Ticket #{ticket_number} (Projekt: {project})")
                stats['skipped'] += 1
                continue
            
            # Tracker-Typ
            tracker = map_tracker(get_column(row, 'Tracker', 'Type'))
            
            # Übergeordnetes Ticket
            parent_ticket_num = get_column(row, 'Übergeordnetes Ticket', 'übergeordnetes Ticket', 'Parent')
            parent_ticket = None
            if parent_ticket_num and parent_ticket_num.strip():
                parent_ticket = VisiViewTicket.objects.filter(ticket_number=parent_ticket_num.strip()).first()
            
            # Basis-Informationen
            title = get_column(row, 'Thema', 'Subject', 'Title')
            description = get_column(row, 'Beschreibung', 'Description')
            
            # Status und Priorität
            status = map_status(get_column(row, 'Status'))
            priority = map_priority(get_column(row, 'Priorität', 'Prioritat', 'Priority'))
            
            # Kategorie
            category = map_category(get_column(row, 'Kategorie', 'Category'))
            
            # Personen
            author = get_column(row, 'Autor', 'Author')
            author_user = find_user_by_name(author)
            
            assigned_to_name = get_column(row, 'Zugewiesen an', 'Assigned to')
            assigned_to = find_user_by_name(assigned_to_name)
            
            last_changed_by = get_column(row, 'Zuletzt geändert von', 'Last changed by')
            
            # Versionen
            target_version = get_column(row, 'Zielversion', 'Target version')
            affected_version = get_column(row, 'Betroffene Version', 'Affected version')
            visiview_id = get_column(row, 'VisiView ID')
            
            # Zeitplanung
            start_date = parse_date(get_column(row, 'Beginn', 'Start'))
            due_date = parse_date(get_column(row, 'Abgabedatum', 'Due date'))
            
            # Aufwand
            estimated_hours = parse_decimal(get_column(row, 'Geschätzter Aufwand', 'Estimated hours'))
            total_estimated_hours = parse_decimal(get_column(row, 'Summe des geschätzten Aufwands', 'Total estimated'))
            spent_hours = parse_decimal(get_column(row, 'Aufgewendete Zeit', 'Spent time')) or Decimal('0')
            
            # Fortschritt
            percent_done = parse_int(get_column(row, '% erledigt', 'Done', 'Progress'))
            
            # Kunden
            customers = get_column(row, 'Kunden', 'Customers')
            
            # Dateien
            attachments = get_column(row, 'Dateien', 'Files', 'Attachments')
            
            # Zugehörige Tickets
            related_tickets = get_column(row, 'Zugehörige Tickets', 'Related issues')
            
            # Flags
            is_private_str = get_column(row, 'Privat', 'Private')
            is_private = is_private_str.lower() in ['ja', 'yes', 'true', '1'] if is_private_str else False
            
            add_to_worklist_str = get_column(row, 'Add to Worklist')
            add_to_worklist = add_to_worklist_str.lower() in ['ja', 'yes', 'true', '1'] if add_to_worklist_str else False
            
            rank = get_column(row, 'Rank')
            
            # Timestamps
            created_at = parse_datetime(get_column(row, 'Angelegt', 'Created'))
            updated_at = parse_datetime(get_column(row, 'Aktualisiert', 'Updated'))
            closed_at = parse_datetime(get_column(row, 'Geschlossen am', 'Closed'))
            
            # Letzte Kommentare
            last_comments = get_column(row, 'Letzte Kommentare', 'Last comments')
            
            # Ticket erstellen oder aktualisieren
            existing_ticket = VisiViewTicket.objects.filter(ticket_number=ticket_number).first()
            
            ticket_data = {
                'tracker': tracker,
                'parent_ticket': parent_ticket,
                'title': title[:500] if title else '',
                'description': description or '',
                'status': status,
                'priority': priority,
                'category': category,
                'author': author or '',
                'author_user': author_user,
                'assigned_to': assigned_to,
                'assigned_to_name': assigned_to_name if not assigned_to else '',
                'last_changed_by': last_changed_by or '',
                'target_version': target_version or '',
                'affected_version': affected_version or '',
                'visiview_id': visiview_id or '',
                'start_date': start_date,
                'due_date': due_date,
                'estimated_hours': estimated_hours,
                'total_estimated_hours': total_estimated_hours,
                'spent_hours': spent_hours,
                'percent_done': percent_done,
                'customers': customers or '',
                'attachments': attachments or '',
                'related_tickets': related_tickets or '',
                'is_private': is_private,
                'add_to_worklist': add_to_worklist,
                'rank': rank or '',
                'imported_created_at': created_at,
                'imported_updated_at': updated_at,
                'closed_at': closed_at,
            }
            
            if not dry_run:
                if existing_ticket:
                    # Update
                    for key, value in ticket_data.items():
                        setattr(existing_ticket, key, value)
                    existing_ticket.save()
                    ticket = existing_ticket
                    stats['updated'] += 1
                    action = "AKTUALISIERT"
                else:
                    # Neu erstellen
                    ticket = VisiViewTicket.objects.create(
                        ticket_number=ticket_number,
                        **ticket_data
                    )
                    stats['imported'] += 1
                    action = "IMPORTIERT"
                
                # Letzte Kommentare als Kommentar importieren
                if last_comments and last_comments.strip():
                    # Prüfe ob schon importiert
                    existing_comment = VisiViewTicketComment.objects.filter(
                        ticket=ticket,
                        is_imported=True
                    ).first()
                    
                    if not existing_comment:
                        VisiViewTicketComment.objects.create(
                            ticket=ticket,
                            comment=last_comments,
                            is_imported=True,
                            created_by_name='Import'
                        )
            else:
                action = "DRY-RUN"
                stats['imported'] += 1
            
            # Statistik
            if tracker == 'bug':
                stats['bugs'] += 1
            else:
                stats['features'] += 1
            
            print(f"  [{action}] #{ticket_number}: {title[:50]}... ({tracker}, {status})")
            
        except Exception as e:
            stats['errors'] += 1
            print(f"  [FEHLER] Zeile {stats['total']}: {e}")
            import traceback
            traceback.print_exc()
    
    # Zusammenfassung
    print(f"\n{'='*60}")
    print(f"Import abgeschlossen")
    print(f"{'='*60}")
    print(f"Gesamt gelesen:     {stats['total']}")
    print(f"Importiert:         {stats['imported']}")
    print(f"Aktualisiert:       {stats['updated']}")
    print(f"Übersprungen:       {stats['skipped']}")
    print(f"Fehler:             {stats['errors']}")
    print(f"---")
    print(f"Bug/Fehler:         {stats['bugs']}")
    print(f"Feature Requests:   {stats['features']}")
    print(f"{'='*60}\n")
    
    return stats


if __name__ == '__main__':
    # Standard-Pfad zur CSV-Datei
    csv_path = os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        'Datenvorlagen',
        'issues.csv'
    )
    
    # Argumente verarbeiten
    dry_run = '--dry-run' in sys.argv or '-n' in sys.argv
    
    if len(sys.argv) > 1 and not sys.argv[1].startswith('-'):
        csv_path = sys.argv[1]
    
    import_tickets(csv_path, dry_run=dry_run)
