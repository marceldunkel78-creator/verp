"""
Import Troubleshooting tickets from CSV file.

Usage:
    python manage.py import_troubleshooting --dry-run --file=../Datenvorlagen/troubleshooting.csv
    python manage.py import_troubleshooting --file=../Datenvorlagen/troubleshooting.csv
"""

import csv
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils import timezone
from datetime import datetime
import re

from service.models import TroubleshootingTicket

User = get_user_model()


class Command(BaseCommand):
    help = 'Import Troubleshooting tickets from CSV file'

    def add_arguments(self, parser):
        parser.add_argument(
            '--file',
            type=str,
            required=True,
            help='Path to the CSV file'
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be imported without making changes'
        )

    def handle(self, *args, **options):
        file_path = options['file']
        dry_run = options['dry_run']

        self.stdout.write(f"{'DRY RUN - ' if dry_run else ''}Importing from {file_path}")

        # Try different encodings
        encodings = ['utf-8-sig', 'latin-1', 'cp1252', 'iso-8859-1']
        rows = None
        
        for encoding in encodings:
            try:
                with open(file_path, 'r', encoding=encoding) as f:
                    reader = csv.DictReader(f, delimiter=';')
                    rows = list(reader)
                self.stdout.write(self.style.SUCCESS(f"Successfully read file with encoding: {encoding}"))
                break
            except UnicodeDecodeError:
                continue
            except Exception as e:
                self.stdout.write(self.style.ERROR(f"Error with encoding {encoding}: {e}"))
                continue

        if rows is None:
            self.stdout.write(self.style.ERROR("Could not read file with any encoding"))
            return

        self.stdout.write(f"Found {len(rows)} rows to import")

        # Get user mapping
        user_map = self._build_user_map()
        
        stats = {
            'created': 0,
            'updated': 0,
            'skipped': 0,
            'errors': 0
        }

        if dry_run:
            for row in rows:
                self._process_row_dry_run(row, user_map, stats)
        else:
            with transaction.atomic():
                for row in rows:
                    self._process_row(row, user_map, stats)

        # Summary
        self.stdout.write("\n" + "=" * 60)
        self.stdout.write(f"{'DRY RUN ' if dry_run else ''}IMPORT SUMMARY")
        self.stdout.write("=" * 60)
        self.stdout.write(f"Total rows processed: {stats['created'] + stats['updated'] + stats['skipped'] + stats['errors']}")
        self.stdout.write(f"Tickets created: {stats['created']}")
        self.stdout.write(f"Tickets updated: {stats['updated']}")
        self.stdout.write(f"Skipped: {stats['skipped']}")
        self.stdout.write(f"Errors: {stats['errors']}")

    def _build_user_map(self):
        """Build mapping of user names to User objects"""
        user_map = {}
        for user in User.objects.all():
            full_name = f"{user.first_name} {user.last_name}".strip()
            if full_name:
                user_map[full_name.lower()] = user
            user_map[user.username.lower()] = user
        return user_map

    def _parse_date(self, date_str):
        """Parse German date format DD.MM.YYYY HH:MM or DD.MM.YYYY"""
        if not date_str or not date_str.strip():
            return None
        date_str = date_str.strip()
        
        formats = [
            '%d.%m.%Y %H:%M',
            '%d.%m.%Y',
            '%Y-%m-%d %H:%M:%S',
            '%Y-%m-%d'
        ]
        
        for fmt in formats:
            try:
                dt = datetime.strptime(date_str, fmt)
                return timezone.make_aware(dt) if timezone.is_naive(dt) else dt
            except ValueError:
                continue
        return None

    def _map_status(self, status_str):
        """Map German status to model status"""
        status_str = (status_str or '').strip().lower()
        mapping = {
            'neu': 'new',
            'in bearbeitung': 'in_progress',
            'gelöst': 'resolved',
            'geschlossen': 'closed',
            'offen': 'new',
        }
        return mapping.get(status_str, 'new')

    def _map_priority(self, priority_str):
        """Map German priority to model priority"""
        priority_str = (priority_str or '').strip().lower()
        mapping = {
            'niedrig': 'low',
            'normal': 'normal',
            'hoch': 'high',
            'dringend': 'urgent',
        }
        return mapping.get(priority_str, 'normal')

    def _map_category(self, category_str):
        """Map German category to model category"""
        category_str = (category_str or '').strip().lower()
        mapping = {
            'hardware': 'hardware',
            'software': 'software',
            'applikation': 'application',
            'sonstiges': 'other',
        }
        return mapping.get(category_str, 'other')

    def _get_user(self, name_str, user_map):
        """Find user by name"""
        if not name_str or not name_str.strip():
            return None
        name = name_str.strip().lower()
        return user_map.get(name)

    def _process_row_dry_run(self, row, user_map, stats):
        """Process a single row in dry-run mode"""
        try:
            legacy_id = row.get('#', '').strip()
            if not legacy_id:
                stats['skipped'] += 1
                return

            try:
                legacy_id_int = int(legacy_id)
            except ValueError:
                self.stdout.write(self.style.WARNING(f"Invalid legacy ID: {legacy_id}"))
                stats['skipped'] += 1
                return

            title = row.get('Thema', '').strip()
            if not title:
                stats['skipped'] += 1
                return

            # Check if exists
            existing = TroubleshootingTicket.objects.filter(legacy_id=legacy_id_int).first()
            
            if existing:
                self.stdout.write(f"Would UPDATE: #{legacy_id} - {title[:50]}...")
                stats['updated'] += 1
            else:
                self.stdout.write(f"Would CREATE: #{legacy_id} - {title[:50]}...")
                stats['created'] += 1

        except Exception as e:
            self.stdout.write(self.style.ERROR(f"Error processing row: {e}"))
            stats['errors'] += 1

    def _process_row(self, row, user_map, stats):
        """Process a single row"""
        try:
            legacy_id = row.get('#', '').strip()
            if not legacy_id:
                stats['skipped'] += 1
                return

            try:
                legacy_id_int = int(legacy_id)
            except ValueError:
                self.stdout.write(self.style.WARNING(f"Invalid legacy ID: {legacy_id}"))
                stats['skipped'] += 1
                return

            title = row.get('Thema', '').strip()
            if not title:
                self.stdout.write(self.style.WARNING(f"Skipping row with no title: #{legacy_id}"))
                stats['skipped'] += 1
                return

            # Map fields
            status = self._map_status(row.get('Status', ''))
            priority = self._map_priority(row.get('Priorität', row.get('Prioritat', '')))
            category = self._map_category(row.get('Kategorie', ''))
            
            description = row.get('Beschreibung', '').strip()
            root_cause = row.get('Root Cause', '').strip()
            corrective_action = row.get('Corrective Action', '').strip()
            affected_version = row.get('Betroffene Version', '').strip()
            related_tickets = row.get('Zugehörige Tickets', row.get('Zugeh\xf6rige Tickets', '')).strip()
            files = row.get('Dateien', '').strip()
            last_comments = row.get('Letzte Kommentare', '').strip()
            
            # Users
            author = self._get_user(row.get('Autor', ''), user_map)
            assigned_to = self._get_user(row.get('Zugewiesen an', ''), user_map)
            last_changed_by = self._get_user(row.get('Zuletzt geändert von', row.get('Zuletzt ge\xe4ndert von', '')), user_map)
            
            # Dates
            closed_at = self._parse_date(row.get('Geschlossen am', ''))

            # Check if exists
            existing = TroubleshootingTicket.objects.filter(legacy_id=legacy_id_int).first()
            
            if existing:
                # Update existing
                existing.title = title
                existing.description = description
                existing.status = status
                existing.priority = priority
                existing.category = category
                existing.root_cause = root_cause
                existing.corrective_action = corrective_action
                existing.affected_version = affected_version
                existing.related_tickets = related_tickets
                existing.files = files
                existing.last_comments = last_comments
                existing.assigned_to = assigned_to
                existing.last_changed_by = last_changed_by
                existing.closed_at = closed_at
                existing.save()
                
                self.stdout.write(f"✓ Updated: #{legacy_id} - {title[:40]}...")
                stats['updated'] += 1
            else:
                # Create new
                ticket = TroubleshootingTicket.objects.create(
                    legacy_id=legacy_id_int,
                    title=title,
                    description=description,
                    status=status,
                    priority=priority,
                    category=category,
                    root_cause=root_cause,
                    corrective_action=corrective_action,
                    affected_version=affected_version,
                    related_tickets=related_tickets,
                    files=files,
                    last_comments=last_comments,
                    author=author,
                    assigned_to=assigned_to,
                    last_changed_by=last_changed_by,
                    closed_at=closed_at
                )
                
                self.stdout.write(f"✓ Created: {ticket.ticket_number} (#{legacy_id}) - {title[:40]}...")
                stats['created'] += 1

        except Exception as e:
            self.stdout.write(self.style.ERROR(f"Error processing row #{row.get('#', '?')}: {e}"))
            stats['errors'] += 1
