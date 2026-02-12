"""
Redmine → VERP Ticket-Synchronisation

Synchronisiert Tickets und Zeitaufwendungen aus Redmine in die VERP-Datenbank.

Redmine-Projekte → VERP-Module:
  - "Visiview"                → VisiViewTicket
  - "Dokumentation"           → SalesTicket
  - "Service & Support"       → ServiceTicket
  - "Troubleshooting Guide"   → TroubleshootingTicket
  - "Zeiterfassung"           → MaintenanceTimeCredit + MaintenanceTimeExpenditure
"""

import logging
from datetime import datetime, timedelta, date
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.utils import timezone

from redminelib import Redmine
from redminelib.exceptions import (
    ResourceNotFoundError, AuthError, ServerError, ForbiddenError
)

logger = logging.getLogger(__name__)

# ============================================================================
# Konfiguration
# ============================================================================

REDMINE_URL = 'http://192.168.0.1:32768'
REDMINE_API_KEY = 'd5a35c41fc5cdd3cd7942c0c83865b08087613eb'

# Redmine-Projekt-Kandidaten je Modul
# Hinweis: Redmine erwartet Projekt-Identifier (klein), wir versuchen aber
# auch Name-Matching (case-insensitive), falls es ein Unterprojekt ist.
PROJECT_CANDIDATES = {
    'visiview_tickets': ['visiview', 'VisiView'],
    'sales_tickets': ['dokumentation', 'Dokumentation'],
    'service_tickets': ['service-support', 'Service & Support'],
    'troubleshooting_tickets': ['troubleshooting-guide', 'Troubleshooting Guide'],
    'maintenance': ['zeiterfassung', 'Zeiterfassung'],
}

PROJECT_MODULES = list(PROJECT_CANDIDATES.keys())

_project_cache = {}


def _load_all_projects(redmine):
    try:
        projects = list(redmine.project.all())
        return projects
    except Exception as e:
        logger.error(f"Fehler beim Laden der Redmine-Projekte: {e}")
        return []


def resolve_project_identifier(redmine, module_key):
    """Ermittelt den Redmine-Projekt-Identifier für ein Modul."""
    if module_key in _project_cache:
        return _project_cache[module_key]

    candidates = PROJECT_CANDIDATES.get(module_key, [])
    # 1) Direkt per Identifier versuchen
    for candidate in candidates:
        try:
            project = redmine.project.get(candidate)
            _project_cache[module_key] = project.identifier
            return project.identifier
        except ResourceNotFoundError:
            continue
        except Exception as e:
            logger.error(f"Projekt-Lookup Fehler ({candidate}): {e}")

    # 2) Fallback: Name-Matching (case-insensitive)
    projects = _load_all_projects(redmine)
    candidates_lower = {c.lower() for c in candidates}
    for project in projects:
        try:
            if project.name.lower() in candidates_lower:
                _project_cache[module_key] = project.identifier
                return project.identifier
        except Exception:
            continue

    _project_cache[module_key] = None
    return None


# ============================================================================
# Redmine-Verbindung
# ============================================================================

def get_redmine_connection(url=None, api_key=None):
    """Erstellt eine Redmine-Verbindung"""
    url = url or REDMINE_URL
    api_key = api_key or REDMINE_API_KEY
    return Redmine(url, key=api_key)


def test_redmine_connection(url=None, api_key=None):
    """Testet die Verbindung zum Redmine-Server"""
    try:
        redmine = get_redmine_connection(url, api_key)
        # Versuche den aktuellen User abzufragen
        current_user = redmine.user.get('current')

        # Projekte abrufen
        projects = {}
        for module_key in PROJECT_MODULES:
            identifier = resolve_project_identifier(redmine, module_key)
            candidates = PROJECT_CANDIDATES.get(module_key, [])
            if identifier:
                try:
                    project = redmine.project.get(identifier)
                    issues = redmine.issue.filter(
                        project_id=identifier, status_id='*', limit=1
                    )
                    # Force evaluation so total_count is populated
                    list(issues)
                    issue_count = issues.total_count
                    projects[module_key] = {
                        'name': project.name,
                        'identifier': project.identifier,
                        'issue_count': issue_count,
                        'found': True,
                        'candidates': candidates,
                    }
                except Exception as e:
                    projects[module_key] = {
                        'name': candidates[0] if candidates else module_key,
                        'identifier': identifier,
                        'issue_count': 0,
                        'found': False,
                        'error': str(e),
                        'candidates': candidates,
                    }
            else:
                projects[module_key] = {
                    'name': candidates[0] if candidates else module_key,
                    'identifier': None,
                    'issue_count': 0,
                    'found': False,
                    'candidates': candidates,
                }

        return {
            'success': True,
            'user': str(current_user),
            'projects': projects,
            'server_url': url or REDMINE_URL,
        }
    except AuthError:
        return {'success': False, 'error': 'Authentifizierung fehlgeschlagen (ungültiger API-Key)'}
    except ServerError as e:
        return {'success': False, 'error': f'Redmine-Server Fehler: {str(e)}'}
    except Exception as e:
        return {'success': False, 'error': f'Verbindung fehlgeschlagen: {str(e)}'}


# ============================================================================
# Benutzer-Zuordnung
# ============================================================================

User = get_user_model()
_user_cache = {}


def resolve_redmine_user(redmine_user):
    """
    Ordnet einen Redmine-Benutzer einem Django-User zu.
    Nutzt Cache für wiederholte Abfragen.
    """
    if redmine_user is None:
        return None, ''

    try:
        name = str(redmine_user)
        redmine_user_id = redmine_user.id
    except Exception:
        name = str(redmine_user)
        redmine_user_id = None

    if name in _user_cache:
        return _user_cache[name]

    user = None

    # Versuche Name aufzuspalten (Vorname Nachname)
    parts = name.strip().split(' ', 1)
    if len(parts) == 2:
        first_name, last_name = parts
        user = User.objects.filter(
            first_name__iexact=first_name,
            last_name__iexact=last_name
        ).first()

    # Fallback: username
    if not user:
        user = User.objects.filter(username__iexact=name).first()

    # Fallback: Nachname
    if not user and len(parts) >= 1:
        user = User.objects.filter(last_name__iexact=parts[-1]).first()

    result = (user, name)
    _user_cache[name] = result
    return result


def clear_user_cache():
    """Cache leeren (z.B. zwischen Sync-Läufen)"""
    global _user_cache
    _user_cache = {}


# ============================================================================
# Status/Priorität/Kategorie-Mappings
# ============================================================================

# --- VisiView Tickets ---
VISIVIEW_TRACKER_MAP = {
    'Bug': 'bug',
    'Fehler': 'bug',
    'Feature': 'feature',
}

VISIVIEW_STATUS_MAP = {
    'Neu': 'new',
    'New': 'new',
    'Zugewiesen': 'assigned',
    'Assigned': 'assigned',
    'Bearbeitet': 'in_progress',
    'In Progress': 'in_progress',
    'In Bearbeitung': 'in_progress',
    'Testen': 'testing',
    'Testen: Extern': 'testing',
    'Testing': 'testing',
    'Getestet': 'tested',
    'Tested': 'tested',
    'Gelöst': 'resolved',
    'Resolved': 'resolved',
    'Geschlossen': 'closed',
    'Closed': 'closed',
    'Abgelehnt': 'rejected',
    'Rejected': 'rejected',
}

VISIVIEW_PRIORITY_MAP = {
    'Niedrig': 'low',
    'Low': 'low',
    'Normal': 'normal',
    'Hoch': 'high',
    'High': 'high',
    'Dringend': 'urgent',
    'Urgent': 'urgent',
    'Sofort': 'immediate',
    'Immediate': 'immediate',
}

VISIVIEW_CATEGORY_MAP = {
    'Applikation': 'application',
    'Application': 'application',
    'Datenanalyse Allgemein': 'data_analysis',
    'Datenmanagement': 'data_management',
    'Deconvolution': 'deconvolution',
    'Hardware: Kamera': 'hardware_camera',
    'Hardware: Mikroskop': 'hardware_microscope',
    'Hardware: Orbital': 'hardware_orbital',
    'Hardware: VisiTIRF/FRAP': 'hardware_tirf_frap',
    'Hardware: Sonstiges': 'hardware_other',
    'Sonstiges': 'other',
    'Other': 'other',
}

# --- Sales Tickets ---
SALES_CATEGORY_MAP = {
    'AppNote': 'appnote',
    'TechNote': 'technote',
    'User Manual': 'usermanual',
    'Field Service Manual': 'fieldservicemanual',
    'Broschüre': 'brochure',
    'Newsletter': 'newsletter',
    'Training Video': 'trainingvideo',
    'Marketing Video': 'marketingvideo',
    'Helpeintrag': 'helparticle',
    'Markterkundung': 'marketresearch',
}

SALES_STATUS_MAP = {
    'Neu': 'new',
    'New': 'new',
    'Zugewiesen': 'assigned',
    'Assigned': 'assigned',
    'In Bearbeitung': 'in_progress',
    'In Progress': 'in_progress',
    'Bearbeitet': 'in_progress',
    'Review': 'review',
    'Erledigt': 'completed',
    'Completed': 'completed',
    'Gelöst': 'completed',
    'Geschlossen': 'completed',
    'Closed': 'completed',
    'Abgelehnt': 'rejected',
    'Rejected': 'rejected',
}

# --- Service Tickets ---
SERVICE_STATUS_MAP = {
    'Neu': 'new',
    'New': 'new',
    'Zugewiesen': 'assigned',
    'Assigned': 'assigned',
    'Warten Kunde': 'waiting_customer',
    'Warten Third-Party': 'waiting_thirdparty',
    'Keine Lösung': 'no_solution',
    'Gelöst': 'resolved',
    'Resolved': 'resolved',
    'Geschlossen': 'resolved',
    'Closed': 'resolved',
    'In Bearbeitung': 'assigned',
    'In Progress': 'assigned',
}

# --- Troubleshooting Tickets ---
TROUBLESHOOTING_STATUS_MAP = {
    'Neu': 'new',
    'New': 'new',
    'In Bearbeitung': 'in_progress',
    'In Progress': 'in_progress',
    'Bearbeitet': 'in_progress',
    'Zugewiesen': 'in_progress',
    'Assigned': 'in_progress',
    'Gelöst': 'resolved',
    'Resolved': 'resolved',
    'Geschlossen': 'closed',
    'Closed': 'closed',
}

TROUBLESHOOTING_CATEGORY_MAP = {
    'Hardware': 'hardware',
    'Software': 'software',
    'Applikation': 'application',
    'Application': 'application',
    'Artefakte': 'artefakte',
    'Sonstiges': 'other',
    'Other': 'other',
}

PRIORITY_MAP = {
    'Niedrig': 'low',
    'Low': 'low',
    'Normal': 'normal',
    'Hoch': 'high',
    'High': 'high',
    'Dringend': 'urgent',
    'Urgent': 'urgent',
    'Sofort': 'immediate',
    'Immediate': 'immediate',
}

# --- Maintenance Zeiterfassung ---
ACTIVITY_MAP = {
    'Remote Support': 'remote_support',
    'Telefon Support': 'phone_support',
    'EMail Support': 'email_support',
    'Email Support': 'email_support',
    'Phone Support': 'phone_support',
}

TASK_TYPE_MAP = {
    'Bugs': 'bugs',
    'Bug Fix': 'bugs',
    'Sonstiges': 'other',
    'Other': 'other',
    'Schulung': 'training',
    'Training': 'training',
    'Test': 'testing',
    'Testing': 'testing',
}


# ============================================================================
# Hilfsfunktionen
# ============================================================================

def safe_attr(resource, attr, default=''):
    """Sicherer Zugriff auf Redmine-Resource-Attribute"""
    try:
        val = getattr(resource, attr, default)
        if val is None:
            return default
        return val
    except Exception:
        return default


def safe_str(resource, attr, default=''):
    """Sichere String-Konvertierung eines Redmine-Attributs"""
    val = safe_attr(resource, attr, default)
    try:
        return str(val) if val else default
    except Exception:
        return default


def safe_decimal(resource, attr, default=Decimal('0')):
    """Sichere Decimal-Konvertierung"""
    val = safe_attr(resource, attr, None)
    if val is None:
        return default
    try:
        return Decimal(str(val))
    except Exception:
        return default


def safe_date(resource, attr, default=None):
    """Sichere Date-Konvertierung"""
    val = safe_attr(resource, attr, None)
    if val is None:
        return default
    if isinstance(val, datetime):
        return val.date()
    if isinstance(val, date):
        return val
    try:
        return datetime.strptime(str(val), '%Y-%m-%d').date()
    except Exception:
        return default


def safe_datetime(resource, attr, default=None):
    """Sichere DateTime-Konvertierung"""
    val = safe_attr(resource, attr, None)
    if val is None:
        return default
    if isinstance(val, datetime):
        if timezone.is_naive(val):
            return timezone.make_aware(val)
        return val
    try:
        dt = datetime.fromisoformat(str(val).replace('Z', '+00:00'))
        if timezone.is_naive(dt):
            return timezone.make_aware(dt)
        return dt
    except Exception:
        return default


def safe_int(resource, attr, default=0):
    """Sichere Integer-Konvertierung"""
    val = safe_attr(resource, attr, None)
    if val is None:
        return default
    try:
        return int(val)
    except Exception:
        return default


# ============================================================================
# Sync-Status abrufen
# ============================================================================

def get_sync_status():
    """Gibt den aktuellen Synchronisationsstatus zurück"""
    from visiview.models import (
        VisiViewTicket, MaintenanceTimeCredit, MaintenanceTimeExpenditure
    )
    from service.models import ServiceTicket, TroubleshootingTicket
    from sales.models import SalesTicket

    return {
        'visiview_tickets': {
            'total': VisiViewTicket.objects.count(),
            'synced': VisiViewTicket.objects.filter(redmine_id__isnull=False).count(),
            'unsynced': VisiViewTicket.objects.filter(redmine_id__isnull=True).count(),
            'last_sync': _get_last_sync_time(VisiViewTicket),
        },
        'sales_tickets': {
            'total': SalesTicket.objects.count(),
            'synced': SalesTicket.objects.filter(redmine_id__isnull=False).count(),
            'unsynced': SalesTicket.objects.filter(redmine_id__isnull=True).count(),
            'last_sync': _get_last_sync_time(SalesTicket),
        },
        'service_tickets': {
            'total': ServiceTicket.objects.count(),
            'synced': ServiceTicket.objects.filter(redmine_id__isnull=False).count(),
            'unsynced': ServiceTicket.objects.filter(redmine_id__isnull=True).count(),
            'last_sync': _get_last_sync_time(ServiceTicket),
        },
        'troubleshooting_tickets': {
            'total': TroubleshootingTicket.objects.count(),
            'synced': TroubleshootingTicket.objects.filter(redmine_id__isnull=False).count(),
            'unsynced': TroubleshootingTicket.objects.filter(redmine_id__isnull=True).count(),
            'last_sync': _get_last_sync_time(TroubleshootingTicket),
        },
        'maintenance_credits': {
            'total': MaintenanceTimeCredit.objects.count(),
            'synced': MaintenanceTimeCredit.objects.filter(redmine_id__isnull=False).count(),
        },
        'maintenance_expenditures': {
            'total': MaintenanceTimeExpenditure.objects.count(),
            'synced': MaintenanceTimeExpenditure.objects.filter(
                redmine_time_entry_id__isnull=False
            ).count(),
        },
    }


def _get_last_sync_time(model):
    """Letzter Sync-Zeitpunkt für ein Modell"""
    obj = model.objects.filter(
        redmine_updated_on__isnull=False
    ).order_by('-redmine_updated_on').first()
    if obj:
        return obj.redmine_updated_on.isoformat()
    return None


# ============================================================================
# Inkrementelle Abfrage: nur geänderte Issues holen
# ============================================================================

def fetch_updated_issues(redmine, module_key, since=None, limit=100):
    """
    Holt Issues aus einem Redmine-Projekt.

    - Wenn `since` angegeben: nur Issues die seit diesem Zeitpunkt geändert wurden
    - Sonst: alle Issues (für initialen Sync)

    Die Redmine-API unterstützt updated_on>=<timestamp> Filter.
    """
    project_id = resolve_project_identifier(redmine, module_key)
    if not project_id:
        logger.warning(f"Kein Redmine-Projekt gefunden für Modul: {module_key}")
        return []

    kwargs = {
        'project_id': project_id,
        'status_id': '*',  # offen + geschlossen
        'sort': 'updated_on:desc',
        'limit': limit,
    }

    if since:
        # Redmine-Filter: updated_on>=<ISO-Timestamp>
        if isinstance(since, datetime):
            since_str = since.strftime('%Y-%m-%dT%H:%M:%SZ')
        else:
            since_str = str(since)
        kwargs['updated_on'] = f'>={since_str}'

    try:
        issues = redmine.issue.filter(**kwargs)
        return list(issues)
    except Exception as e:
        logger.error(f"Fehler beim Abrufen von Issues aus {project_id}: {e}")
        return []


def fetch_updated_time_entries(redmine, module_key, since_date=None, limit=100):
    """
    Holt Zeiteinträge aus einem Redmine-Projekt.
    """
    project_id = resolve_project_identifier(redmine, module_key)
    if not project_id:
        logger.warning(f"Kein Redmine-Projekt gefunden für Modul: {module_key}")
        return []

    kwargs = {
        'project_id': project_id,
        'limit': limit,
    }

    if since_date:
        kwargs['from_date'] = since_date.strftime('%Y-%m-%d')

    try:
        entries = redmine.time_entry.filter(**kwargs)
        return list(entries)
    except Exception as e:
        logger.error(f"Fehler beim Abrufen von Time Entries aus {project_id}: {e}")
        return []


# ============================================================================
# VisiView Tickets synchronisieren
# ============================================================================

def sync_visiview_tickets(redmine, since=None, limit=200, dry_run=False):
    """
    Synchronisiert VisiView-Tickets aus Redmine.
    Redmine-Projekt: 'visiview'
    """
    from visiview.models import VisiViewTicket, VisiViewTicketComment

    issues = fetch_updated_issues(redmine, 'visiview_tickets', since=since, limit=limit)

    stats = {'fetched': len(issues), 'created': 0, 'updated': 0, 'skipped': 0, 'errors': []}
    preview_items = []

    for issue in issues:
        try:
            redmine_id = issue.id
            existing = VisiViewTicket.objects.filter(redmine_id=redmine_id).first()

            # Prüfe ob Update nötig
            redmine_updated = safe_datetime(issue, 'updated_on')
            if existing and existing.redmine_updated_on and redmine_updated:
                if existing.redmine_updated_on >= redmine_updated:
                    stats['skipped'] += 1
                    continue

            # Auch über ticket_number suchen (Legacy aus CSV-Import)
            if not existing:
                existing = VisiViewTicket.objects.filter(
                    ticket_number=str(issue.id)
                ).first()

            tracker_name = safe_str(issue, 'tracker')
            status_name = safe_str(issue, 'status')
            priority_name = safe_str(issue, 'priority')
            category_name = safe_str(issue, 'category', '')
            author_user, author_name = resolve_redmine_user(safe_attr(issue, 'author', None))
            assigned_user, assigned_name = resolve_redmine_user(safe_attr(issue, 'assigned_to', None))

            # Custom Fields auslesen
            visiview_id = ''
            customers = ''
            rank = ''
            add_to_worklist = False
            try:
                for cf in issue.custom_fields:
                    cf_name = cf.get('name', '') if isinstance(cf, dict) else safe_str(cf, 'name', '')
                    cf_value = cf.get('value', '') if isinstance(cf, dict) else safe_str(cf, 'value', '')
                    if cf_name == 'VisiView ID':
                        visiview_id = cf_value
                    elif cf_name == 'Kunden':
                        customers = cf_value
                    elif cf_name == 'Rank':
                        rank = cf_value
                    elif cf_name == 'Add to Worklist':
                        add_to_worklist = cf_value in ('1', 'Yes', 'Ja', True)
            except Exception:
                pass

            # Parent Ticket
            parent_ticket = None
            parent_id = safe_attr(issue, 'parent', None)
            if parent_id:
                try:
                    pid = parent_id.id if hasattr(parent_id, 'id') else int(parent_id)
                    parent_ticket = VisiViewTicket.objects.filter(redmine_id=pid).first()
                    if not parent_ticket:
                        parent_ticket = VisiViewTicket.objects.filter(ticket_number=str(pid)).first()
                except Exception:
                    pass

            data = {
                'ticket_number': str(issue.id),
                'tracker': VISIVIEW_TRACKER_MAP.get(tracker_name, 'bug'),
                'parent_ticket': parent_ticket,
                'title': safe_str(issue, 'subject', 'Ohne Titel')[:500],
                'description': safe_str(issue, 'description', ''),
                'status': VISIVIEW_STATUS_MAP.get(status_name, 'new'),
                'priority': VISIVIEW_PRIORITY_MAP.get(priority_name, 'normal'),
                'category': VISIVIEW_CATEGORY_MAP.get(category_name, ''),
                'author': author_name,
                'author_user': author_user,
                'assigned_to': assigned_user,
                'assigned_to_name': assigned_name if not assigned_user else '',
                'target_version': safe_str(issue, 'fixed_version', ''),
                'visiview_id': visiview_id,
                'start_date': safe_date(issue, 'start_date'),
                'due_date': safe_date(issue, 'due_date'),
                'estimated_hours': safe_decimal(issue, 'estimated_hours', None),
                'spent_hours': safe_decimal(issue, 'spent_hours', Decimal('0')),
                'percent_done': safe_int(issue, 'done_ratio', 0),
                'customers': customers,
                'is_private': bool(safe_attr(issue, 'is_private', False)),
                'add_to_worklist': add_to_worklist,
                'rank': rank,
                'redmine_id': redmine_id,
                'redmine_updated_on': redmine_updated,
                'imported_created_at': safe_datetime(issue, 'created_on'),
                'imported_updated_at': redmine_updated,
            }

            action = 'update' if existing else 'create'
            preview_items.append({
                'redmine_id': redmine_id,
                'ticket_number': str(issue.id),
                'title': data['title'][:80],
                'status': data['status'],
                'action': action,
            })

            if not dry_run:
                if existing:
                    for key, value in data.items():
                        if key not in ('ticket_number',):  # Don't overwrite ticket_number
                            setattr(existing, key, value)
                    existing.save()
                    stats['updated'] += 1
                else:
                    ticket = VisiViewTicket.objects.create(**data)
                    stats['created'] += 1

                    # Journals/Kommentare synchronisieren
                    _sync_visiview_comments(redmine, issue, ticket if not existing else existing)

        except Exception as e:
            stats['errors'].append({
                'redmine_id': getattr(issue, 'id', '?'),
                'error': str(e),
            })
            logger.error(f"Fehler bei VisiView Ticket #{getattr(issue, 'id', '?')}: {e}")

    stats['preview_items'] = preview_items
    return stats


def _sync_visiview_comments(redmine, issue, ticket):
    """Synchronisiert Journals/Kommentare eines VisiView-Tickets"""
    from visiview.models import VisiViewTicketComment

    try:
        # Issue mit Journals neu laden
        full_issue = redmine.issue.get(issue.id, include=['journals'])
        journals = safe_attr(full_issue, 'journals', [])

        for journal in journals:
            notes = safe_str(journal, 'notes', '')
            if not notes.strip():
                continue

            journal_id = safe_attr(journal, 'id', None)
            if journal_id and VisiViewTicketComment.objects.filter(
                redmine_journal_id=journal_id
            ).exists():
                continue

            author_user, author_name = resolve_redmine_user(
                safe_attr(journal, 'user', None)
            )

            VisiViewTicketComment.objects.create(
                ticket=ticket,
                comment=notes,
                is_imported=True,
                created_by=author_user,
                created_by_name=author_name,
                redmine_journal_id=journal_id,
            )
    except Exception as e:
        logger.error(f"Fehler beim Sync der Kommentare für Ticket #{ticket.ticket_number}: {e}")


# ============================================================================
# Sales Tickets synchronisieren
# ============================================================================

def sync_sales_tickets(redmine, since=None, limit=200, dry_run=False):
    """
    Synchronisiert Sales-Tickets aus Redmine.
    Redmine-Projekt: 'dokumentation'
    """
    from sales.models import SalesTicket

    issues = fetch_updated_issues(redmine, 'sales_tickets', since=since, limit=limit)

    stats = {'fetched': len(issues), 'created': 0, 'updated': 0, 'skipped': 0, 'errors': []}
    preview_items = []

    for issue in issues:
        try:
            redmine_id = issue.id
            existing = SalesTicket.objects.filter(redmine_id=redmine_id).first()

            redmine_updated = safe_datetime(issue, 'updated_on')
            if existing and existing.redmine_updated_on and redmine_updated:
                if existing.redmine_updated_on >= redmine_updated:
                    stats['skipped'] += 1
                    continue

            status_name = safe_str(issue, 'status')
            category_name = safe_str(issue, 'tracker', '')  # Redmine tracker als Kategorie
            author_user, author_name = resolve_redmine_user(safe_attr(issue, 'author', None))
            assigned_user, assigned_name = resolve_redmine_user(safe_attr(issue, 'assigned_to', None))

            data = {
                'title': safe_str(issue, 'subject', 'Ohne Titel')[:300],
                'description': safe_str(issue, 'description', ''),
                'category': SALES_CATEGORY_MAP.get(category_name, 'technote'),
                'status': SALES_STATUS_MAP.get(status_name, 'new'),
                'assigned_to': assigned_user,
                'created_by': author_user,
                'due_date': safe_date(issue, 'due_date'),
                'redmine_id': redmine_id,
                'redmine_updated_on': redmine_updated,
            }

            action = 'update' if existing else 'create'
            preview_items.append({
                'redmine_id': redmine_id,
                'title': data['title'][:80],
                'status': data['status'],
                'action': action,
            })

            if not dry_run:
                if existing:
                    for key, value in data.items():
                        setattr(existing, key, value)
                    existing.save()
                    stats['updated'] += 1
                else:
                    ticket = SalesTicket(**data)
                    ticket.save()  # trigger ticket_number generation
                    stats['created'] += 1

        except Exception as e:
            stats['errors'].append({
                'redmine_id': getattr(issue, 'id', '?'),
                'error': str(e),
            })
            logger.error(f"Fehler bei Sales Ticket #{getattr(issue, 'id', '?')}: {e}")

    stats['preview_items'] = preview_items
    return stats


# ============================================================================
# Service Tickets synchronisieren
# ============================================================================

def sync_service_tickets(redmine, since=None, limit=200, dry_run=False):
    """
    Synchronisiert Service-Tickets aus Redmine.
    Redmine-Projekt: 'service-support'
    """
    from service.models import ServiceTicket

    issues = fetch_updated_issues(redmine, 'service_tickets', since=since, limit=limit)

    stats = {'fetched': len(issues), 'created': 0, 'updated': 0, 'skipped': 0, 'errors': []}
    preview_items = []

    for issue in issues:
        try:
            redmine_id = issue.id
            existing = ServiceTicket.objects.filter(redmine_id=redmine_id).first()

            redmine_updated = safe_datetime(issue, 'updated_on')
            if existing and existing.redmine_updated_on and redmine_updated:
                if existing.redmine_updated_on >= redmine_updated:
                    stats['skipped'] += 1
                    continue

            status_name = safe_str(issue, 'status')
            author_user, author_name = resolve_redmine_user(safe_attr(issue, 'author', None))
            assigned_user, assigned_name = resolve_redmine_user(safe_attr(issue, 'assigned_to', None))

            data = {
                'title': safe_str(issue, 'subject', 'Ohne Titel')[:200],
                'description': safe_str(issue, 'description', ''),
                'status': SERVICE_STATUS_MAP.get(status_name, 'new'),
                'assigned_to': assigned_user,
                'created_by': author_user,
                'redmine_id': redmine_id,
                'redmine_updated_on': redmine_updated,
            }

            action = 'update' if existing else 'create'
            preview_items.append({
                'redmine_id': redmine_id,
                'title': data['title'][:80],
                'status': data['status'],
                'action': action,
            })

            if not dry_run:
                if existing:
                    for key, value in data.items():
                        setattr(existing, key, value)
                    existing.save()
                    stats['updated'] += 1
                else:
                    ticket = ServiceTicket(**data)
                    ticket.save()  # trigger ticket_number generation
                    stats['created'] += 1

        except Exception as e:
            stats['errors'].append({
                'redmine_id': getattr(issue, 'id', '?'),
                'error': str(e),
            })
            logger.error(f"Fehler bei Service Ticket #{getattr(issue, 'id', '?')}: {e}")

    stats['preview_items'] = preview_items
    return stats


# ============================================================================
# Troubleshooting Tickets synchronisieren
# ============================================================================

def sync_troubleshooting_tickets(redmine, since=None, limit=200, dry_run=False):
    """
    Synchronisiert Troubleshooting-Tickets aus Redmine.
    Redmine-Projekt: 'troubleshooting-guide' (Unterprojekt)
    """
    from service.models import TroubleshootingTicket

    issues = fetch_updated_issues(
        redmine, 'troubleshooting_tickets', since=since, limit=limit
    )

    stats = {'fetched': len(issues), 'created': 0, 'updated': 0, 'skipped': 0, 'errors': []}
    preview_items = []

    for issue in issues:
        try:
            redmine_id = issue.id
            existing = TroubleshootingTicket.objects.filter(redmine_id=redmine_id).first()

            # Auch über legacy_id suchen
            if not existing:
                existing = TroubleshootingTicket.objects.filter(legacy_id=redmine_id).first()

            redmine_updated = safe_datetime(issue, 'updated_on')
            if existing and existing.redmine_updated_on and redmine_updated:
                if existing.redmine_updated_on >= redmine_updated:
                    stats['skipped'] += 1
                    continue

            status_name = safe_str(issue, 'status')
            priority_name = safe_str(issue, 'priority')
            category_name = safe_str(issue, 'category', '')
            author_user, author_name = resolve_redmine_user(safe_attr(issue, 'author', None))
            assigned_user, assigned_name = resolve_redmine_user(safe_attr(issue, 'assigned_to', None))

            # Custom Fields (Root Cause, Corrective Action)
            root_cause = ''
            corrective_action = ''
            affected_version = safe_str(issue, 'fixed_version', '')
            try:
                for cf in issue.custom_fields:
                    cf_name = cf.get('name', '') if isinstance(cf, dict) else safe_str(cf, 'name', '')
                    cf_value = cf.get('value', '') if isinstance(cf, dict) else safe_str(cf, 'value', '')
                    if cf_name in ('Root Cause', 'Ursache'):
                        root_cause = cf_value
                    elif cf_name in ('Corrective Action', 'Korrekturmaßnahme'):
                        corrective_action = cf_value
            except Exception:
                pass

            data = {
                'title': safe_str(issue, 'subject', 'Ohne Titel')[:300],
                'description': safe_str(issue, 'description', ''),
                'status': TROUBLESHOOTING_STATUS_MAP.get(status_name, 'new'),
                'priority': PRIORITY_MAP.get(priority_name, 'normal'),
                'category': TROUBLESHOOTING_CATEGORY_MAP.get(category_name, 'other'),
                'assigned_to': assigned_user,
                'author': author_user,
                'affected_version': affected_version[:100],
                'root_cause': root_cause,
                'corrective_action': corrective_action,
                'legacy_id': redmine_id,
                'redmine_id': redmine_id,
                'redmine_updated_on': redmine_updated,
            }

            action = 'update' if existing else 'create'
            preview_items.append({
                'redmine_id': redmine_id,
                'title': data['title'][:80],
                'status': data['status'],
                'action': action,
            })

            if not dry_run:
                if existing:
                    for key, value in data.items():
                        if key != 'legacy_id' and value is not None:
                            setattr(existing, key, value)
                    existing.save()
                    stats['updated'] += 1
                else:
                    ticket = TroubleshootingTicket(**data)
                    ticket.save()  # trigger ticket_number generation
                    stats['created'] += 1

        except Exception as e:
            stats['errors'].append({
                'redmine_id': getattr(issue, 'id', '?'),
                'error': str(e),
            })
            logger.error(f"Fehler bei Troubleshooting Ticket #{getattr(issue, 'id', '?')}: {e}")

    stats['preview_items'] = preview_items
    return stats


# ============================================================================
# Maintenance Zeitguthaben + Zeitaufwendungen synchronisieren
# ============================================================================

def sync_maintenance(redmine, since=None, limit=200, dry_run=False):
    """
    Synchronisiert Maintenance-Daten aus Redmine.
    Redmine-Projekt: 'zeiterfassung'

    - Issues → MaintenanceTimeCredit (Tickets = gekaufte Zeitguthaben)
    - Time Entries → MaintenanceTimeExpenditure (Zeitaufwendungen pro Ticket)
    """
    from visiview.models import (
        VisiViewLicense, MaintenanceTimeCredit, MaintenanceTimeExpenditure
    )

    stats = {
        'credits_fetched': 0, 'credits_created': 0, 'credits_updated': 0, 'credits_skipped': 0,
        'entries_fetched': 0, 'entries_created': 0, 'entries_updated': 0, 'entries_skipped': 0,
        'errors': [],
    }
    preview_items = []

    # --- 1. Zeitguthaben (Issues) synchronisieren ---
    issues = fetch_updated_issues(redmine, 'maintenance', since=since, limit=limit)
    stats['credits_fetched'] = len(issues)

    for issue in issues:
        try:
            redmine_id = issue.id
            existing = MaintenanceTimeCredit.objects.filter(redmine_id=redmine_id).first()

            redmine_updated = safe_datetime(issue, 'updated_on')
            if existing and existing.redmine_updated_on and redmine_updated:
                if existing.redmine_updated_on >= redmine_updated:
                    stats['credits_skipped'] += 1
                    continue

            # VisiView-Lizenz ermitteln über Custom Field oder Subject
            license_obj = _find_license_for_maintenance(issue)

            if not license_obj:
                stats['errors'].append({
                    'redmine_id': redmine_id,
                    'error': f'Keine Lizenz gefunden für Issue #{redmine_id}: {safe_str(issue, "subject", "")}'
                })
                continue

            credit_hours = safe_decimal(issue, 'estimated_hours', Decimal('0'))
            start_date = safe_date(issue, 'start_date') or safe_date(issue, 'created_on')
            due_date = safe_date(issue, 'due_date')

            if not due_date:
                # Standard: 1 Jahr Gültigkeit
                if start_date:
                    from dateutil.relativedelta import relativedelta
                    due_date = start_date + relativedelta(years=1)
                else:
                    due_date = date.today() + timedelta(days=365)

            if not start_date:
                start_date = date.today()

            assigned_user, _ = resolve_redmine_user(safe_attr(issue, 'assigned_to', None))
            author_user, _ = resolve_redmine_user(safe_attr(issue, 'author', None))

            action = 'update' if existing else 'create'
            preview_items.append({
                'redmine_id': redmine_id,
                'title': safe_str(issue, 'subject', '')[:80],
                'type': 'credit',
                'license': license_obj.license_number if license_obj else '?',
                'hours': str(credit_hours),
                'action': action,
            })

            if not dry_run:
                if existing:
                    existing.license = license_obj
                    existing.start_date = start_date
                    existing.end_date = due_date
                    existing.credit_hours = credit_hours
                    existing.redmine_updated_on = redmine_updated
                    existing.user = assigned_user or existing.user
                    existing.save()
                    stats['credits_updated'] += 1
                else:
                    MaintenanceTimeCredit.objects.create(
                        license=license_obj,
                        start_date=start_date,
                        end_date=due_date,
                        credit_hours=credit_hours,
                        remaining_hours=credit_hours,
                        user=assigned_user,
                        created_by=author_user,
                        redmine_id=redmine_id,
                        redmine_updated_on=redmine_updated,
                    )
                    stats['credits_created'] += 1

        except Exception as e:
            stats['errors'].append({
                'redmine_id': getattr(issue, 'id', '?'),
                'error': str(e),
            })

    # --- 2. Zeitaufwendungen (Time Entries) synchronisieren ---
    since_date = None
    if since:
        try:
            since_date = since.date() if isinstance(since, datetime) else since
        except Exception:
            pass

    time_entries = fetch_updated_time_entries(
        redmine, 'maintenance', since_date=since_date, limit=limit
    )
    stats['entries_fetched'] = len(time_entries)

    for entry in time_entries:
        try:
            entry_id = entry.id
            existing_entry = MaintenanceTimeExpenditure.objects.filter(
                redmine_time_entry_id=entry_id
            ).first()

            if existing_entry:
                stats['entries_skipped'] += 1
                continue

            # Lizenz über das zugehörige Issue ermitteln
            issue_resource = safe_attr(entry, 'issue', None)
            license_obj = None
            if issue_resource:
                issue_id = issue_resource.id if hasattr(issue_resource, 'id') else int(issue_resource)
                # Prüfe ob wir das Issue schon als Credit haben
                credit = MaintenanceTimeCredit.objects.filter(redmine_id=issue_id).first()
                if credit:
                    license_obj = credit.license
                else:
                    # Versuche Issue direkt abzufragen
                    try:
                        rm_issue = redmine.issue.get(issue_id)
                        license_obj = _find_license_for_maintenance(rm_issue)
                    except Exception:
                        pass

            if not license_obj:
                stats['errors'].append({
                    'redmine_id': entry_id,
                    'error': f'Keine Lizenz für Time Entry #{entry_id}'
                })
                continue

            user_obj, _ = resolve_redmine_user(safe_attr(entry, 'user', None))
            activity_name = safe_str(entry, 'activity', '')
            hours_spent = safe_decimal(entry, 'hours', Decimal('0'))
            comment = safe_str(entry, 'comments', '')

            action = 'create'
            preview_items.append({
                'redmine_id': entry_id,
                'title': f'{comment[:60]}...' if len(comment) > 60 else comment,
                'type': 'expenditure',
                'license': license_obj.license_number if license_obj else '?',
                'hours': str(hours_spent),
                'action': action,
            })

            if not dry_run:
                MaintenanceTimeExpenditure.objects.create(
                    license=license_obj,
                    date=safe_date(entry, 'spent_on') or date.today(),
                    user=user_obj,
                    activity=ACTIVITY_MAP.get(activity_name, 'remote_support'),
                    task_type=TASK_TYPE_MAP.get(activity_name, 'other'),
                    hours_spent=hours_spent,
                    comment=comment,
                    created_by=user_obj,
                    redmine_time_entry_id=entry_id,
                )
                stats['entries_created'] += 1

        except Exception as e:
            stats['errors'].append({
                'redmine_id': getattr(entry, 'id', '?'),
                'error': str(e),
            })

    stats['preview_items'] = preview_items
    return stats


def _find_license_for_maintenance(issue):
    """
    Sucht die VisiView-Lizenz für ein Maintenance-Issue.
    Sucht in Custom Fields nach 'VisiView ID' oder parst den Subject.
    """
    from visiview.models import VisiViewLicense

    # 1. Custom Fields durchsuchen
    try:
        for cf in issue.custom_fields:
            cf_name = cf.get('name', '') if isinstance(cf, dict) else safe_str(cf, 'name', '')
            cf_value = cf.get('value', '') if isinstance(cf, dict) else safe_str(cf, 'value', '')
            if cf_name == 'VisiView ID' and cf_value:
                lic = VisiViewLicense.objects.filter(serial_number=cf_value).first()
                if lic:
                    return lic
    except Exception:
        pass

    # 2. Subject parsen (oft Format "Maintenance <SerialNumber>" oder "VV <ID>")
    subject = safe_str(issue, 'subject', '')
    import re

    # Suche nach Seriennummern-Mustern
    patterns = [
        r'\b(\d{5,})\b',  # 5+ stellige Nummern (Dongle-Seriennummern)
        r'VV\s*(\d+)',  # VV 1234
        r'L-(\d+)',  # L-00001
    ]
    for pattern in patterns:
        match = re.search(pattern, subject)
        if match:
            serial = match.group(1)
            lic = VisiViewLicense.objects.filter(serial_number__icontains=serial).first()
            if lic:
                return lic
            lic = VisiViewLicense.objects.filter(license_number__icontains=serial).first()
            if lic:
                return lic

    return None


# ============================================================================
# Haupt-Sync Funktionen
# ============================================================================

def preview_sync(modules=None, url=None, api_key=None, limit=100):
    """
    Vorschau: zeigt was synchronisiert werden würde.
    modules: Liste von Modul-Namen oder None für alle
    """
    redmine = get_redmine_connection(url, api_key)
    clear_user_cache()

    if modules is None:
        modules = ['visiview_tickets', 'sales_tickets', 'service_tickets',
                    'troubleshooting_tickets', 'maintenance']

    results = {}

    if 'visiview_tickets' in modules:
        since = _get_last_sync_time_obj('visiview_tickets')
        results['visiview_tickets'] = sync_visiview_tickets(
            redmine, since=since, limit=limit, dry_run=True
        )

    if 'sales_tickets' in modules:
        since = _get_last_sync_time_obj('sales_tickets')
        results['sales_tickets'] = sync_sales_tickets(
            redmine, since=since, limit=limit, dry_run=True
        )

    if 'service_tickets' in modules:
        since = _get_last_sync_time_obj('service_tickets')
        results['service_tickets'] = sync_service_tickets(
            redmine, since=since, limit=limit, dry_run=True
        )

    if 'troubleshooting_tickets' in modules:
        since = _get_last_sync_time_obj('troubleshooting_tickets')
        results['troubleshooting_tickets'] = sync_troubleshooting_tickets(
            redmine, since=since, limit=limit, dry_run=True
        )

    if 'maintenance' in modules:
        since = _get_last_sync_time_obj('maintenance')
        results['maintenance'] = sync_maintenance(
            redmine, since=since, limit=limit, dry_run=True
        )

    return results


def execute_sync(modules=None, url=None, api_key=None, limit=500, full_sync=False):
    """
    Führt die Synchronisation aus.
    full_sync=True: ignoriert since-Zeitstempel (komplett neu synchronisieren)
    """
    redmine = get_redmine_connection(url, api_key)
    clear_user_cache()

    if modules is None:
        modules = ['visiview_tickets', 'sales_tickets', 'service_tickets',
                    'troubleshooting_tickets', 'maintenance']

    results = {}

    if 'visiview_tickets' in modules:
        since = None if full_sync else _get_last_sync_time_obj('visiview_tickets')
        results['visiview_tickets'] = sync_visiview_tickets(
            redmine, since=since, limit=limit
        )

    if 'sales_tickets' in modules:
        since = None if full_sync else _get_last_sync_time_obj('sales_tickets')
        results['sales_tickets'] = sync_sales_tickets(
            redmine, since=since, limit=limit
        )

    if 'service_tickets' in modules:
        since = None if full_sync else _get_last_sync_time_obj('service_tickets')
        results['service_tickets'] = sync_service_tickets(
            redmine, since=since, limit=limit
        )

    if 'troubleshooting_tickets' in modules:
        since = None if full_sync else _get_last_sync_time_obj('troubleshooting_tickets')
        results['troubleshooting_tickets'] = sync_troubleshooting_tickets(
            redmine, since=since, limit=limit
        )

    if 'maintenance' in modules:
        since = None if full_sync else _get_last_sync_time_obj('maintenance')
        results['maintenance'] = sync_maintenance(
            redmine, since=since, limit=limit
        )

    return results


def _get_last_sync_time_obj(module_key):
    """Gibt den letzten Sync-Zeitpunkt als datetime zurück"""
    from visiview.models import (
        VisiViewTicket, MaintenanceTimeCredit, MaintenanceTimeExpenditure
    )
    from service.models import ServiceTicket, TroubleshootingTicket
    from sales.models import SalesTicket

    model_map = {
        'visiview_tickets': VisiViewTicket,
        'sales_tickets': SalesTicket,
        'service_tickets': ServiceTicket,
        'troubleshooting_tickets': TroubleshootingTicket,
        'maintenance': MaintenanceTimeCredit,
    }

    model = model_map.get(module_key)
    if not model:
        return None

    obj = model.objects.filter(
        redmine_updated_on__isnull=False
    ).order_by('-redmine_updated_on').first()

    if obj:
        return obj.redmine_updated_on

    return None
