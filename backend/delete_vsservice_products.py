import os
import sys
import django

# Django Setup
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'verp.settings')
django.setup()

from service.models import VSService, VSServicePrice

def delete_all_vsservice_products():
    """Delete all VS-Service products and their prices."""
    
    print("Deleting all VS-Service products and prices...")
    print("=" * 80)
    
    # Count before deletion
    product_count = VSService.objects.count()
    price_count = VSServicePrice.objects.count()
    
    print(f"Found {product_count} VS-Service products")
    print(f"Found {price_count} VS-Service prices")
    print("-" * 80)
    
    # Delete prices first (due to foreign key)
    deleted_prices = VSServicePrice.objects.all().delete()
    print(f"Deleted {deleted_prices[0]} price records")
    
    # Delete products
    deleted_products = VSService.objects.all().delete()
    print(f"Deleted {deleted_products[0]} product records")
    
    print("=" * 80)
    print("Deletion completed successfully!")
    
    # Verify deletion
    remaining_products = VSService.objects.count()
    remaining_prices = VSServicePrice.objects.count()
    print(f"Remaining products: {remaining_products}")
    print(f"Remaining prices: {remaining_prices}")

if __name__ == '__main__':
    delete_all_vsservice_products()
