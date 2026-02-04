#!/usr/bin/env python
"""
Update Advertising Status for Customers without Newsletter
===========================================================

Setzt den Werbestatus auf "abgelehnt" für alle Kunden, bei denen 
keine E-Mail-Adresse eine Newsletter-Zustimmung hat.

Logik:
- Kunde hat mindestens eine E-Mail mit newsletter_consent=True -> keine Änderung
- Kunde hat keine E-Mail mit newsletter_consent=True -> Werbestatus auf "abgelehnt"
"""

import os
import sys
import django

# Django Setup
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'verp.settings')
django.setup()

from django.db.models import Exists, OuterRef
from customers.models import Customer, CustomerEmail


def main(dry_run=True):
    """
    Hauptfunktion für das Update des Werbestatus.
    
    Args:
        dry_run: Wenn True, nur Vorschau ohne tatsächliche Änderungen
    """
    print("=" * 70)
    print("Update Advertising Status for Customers without Newsletter")
    print("=" * 70)
    print(f"Modus: {'DRY RUN (Vorschau)' if dry_run else 'LIVE (Änderungen werden gespeichert)'}")
    print()
    
    # Finde Kunden OHNE Newsletter-Zustimmung
    # (keine E-Mail mit newsletter_consent=True)
    customers_without_newsletter = Customer.objects.exclude(
        Exists(CustomerEmail.objects.filter(
            customer=OuterRef('pk'),
            newsletter_consent=True
        ))
    )
    
    # Davon nur die, deren Werbestatus NICHT bereits "abgelehnt" ist
    customers_to_update = customers_without_newsletter.exclude(
        advertising_status='abgelehnt'
    )
    
    total_without_newsletter = customers_without_newsletter.count()
    to_update_count = customers_to_update.count()
    
    print(f"Kunden ohne Newsletter-Zustimmung: {total_without_newsletter}")
    print(f"Davon bereits 'abgelehnt':         {total_without_newsletter - to_update_count}")
    print(f"Zu aktualisieren:                  {to_update_count}")
    print()
    
    if to_update_count == 0:
        print("Keine Kunden zu aktualisieren.")
        return
    
    # Statistiken nach aktuellem Werbestatus
    stats = {}
    for customer in customers_to_update:
        status = customer.advertising_status or 'leer'
        stats[status] = stats.get(status, 0) + 1
    
    print("Aktuelle Werbestatus-Verteilung der zu ändernden Kunden:")
    for status, count in sorted(stats.items()):
        print(f"  {status}: {count}")
    print()
    
    # Beispiele anzeigen
    print("-" * 70)
    print("BEISPIELE (erste 20):")
    print("-" * 70)
    for customer in customers_to_update[:20]:
        emails = list(customer.emails.values_list('email', 'newsletter_consent'))
        email_info = ', '.join([f"{e[0]} (NL:{e[1]})" for e in emails]) if emails else 'keine E-Mails'
        print(f"{customer.customer_number}: {customer.first_name} {customer.last_name}")
        print(f"  Aktueller Werbestatus: {customer.advertising_status or 'leer'}")
        print(f"  E-Mails: {email_info}")
    print()
    
    if not dry_run:
        # Bulk Update
        updated = customers_to_update.update(advertising_status='abgelehnt')
        print(f"✓ {updated} Kunden auf Werbestatus 'abgelehnt' gesetzt.")
    else:
        print("=" * 70)
        print("Dies war ein DRY RUN - keine Änderungen wurden gespeichert.")
        print("Führen Sie das Script mit --execute aus, um die Änderungen zu speichern.")
        print("=" * 70)


if __name__ == '__main__':
    import argparse
    
    parser = argparse.ArgumentParser(
        description='Setzt Werbestatus auf "abgelehnt" für Kunden ohne Newsletter-Zustimmung'
    )
    parser.add_argument(
        '--execute',
        action='store_true',
        help='Führt die Änderungen tatsächlich aus (ohne diesen Parameter nur Vorschau)'
    )
    
    args = parser.parse_args()
    
    main(dry_run=not args.execute)
