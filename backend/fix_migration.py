#!/usr/bin/env python
"""
Fix migration history by manually applying the schema changes
"""
import os
import sys
import django
from django.db import connection

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'verp.settings')
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
django.setup()

def fix_migration():
    """Manually apply the migration changes"""
    with connection.cursor() as cursor:
        # Add city field
        cursor.execute("""
            ALTER TABLE users_travelperdiemrate 
            ADD COLUMN IF NOT EXISTS city VARCHAR(100) NULL;
        """)
        print("✓ Added city column")
        
        # Drop old unique constraint on country
        cursor.execute("""
            ALTER TABLE users_travelperdiemrate 
            DROP CONSTRAINT IF EXISTS users_travelperdiemrate_country_key;
        """)
        print("✓ Dropped old unique constraint")
        
        # Add new unique constraint on country + city
        cursor.execute("""
            ALTER TABLE users_travelperdiemrate 
            DROP CONSTRAINT IF EXISTS users_travelperdiemrate_country_city_e5a8cb9d_uniq;
        """)
        cursor.execute("""
            ALTER TABLE users_travelperdiemrate 
            ADD CONSTRAINT users_travelperdiemrate_country_city_e5a8cb9d_uniq 
            UNIQUE (country, city);
        """)
        print("✓ Added new unique constraint (country, city)")
        
        # Mark migration as applied
        cursor.execute("""
            INSERT INTO django_migrations (app, name, applied)
            VALUES ('users', '0027_alter_travelperdiemrate_options_and_more', NOW())
            ON CONFLICT DO NOTHING;
        """)
        print("✓ Marked migration as applied")
        
    print("\n" + "="*50)
    print("Migration applied successfully!")

if __name__ == '__main__':
    print("Fixing migration history...")
    print("="*50)
    fix_migration()
