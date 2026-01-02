#!/usr/bin/env python
"""
Master Import Script - Imports all product CSVs
Runs all import scripts in sequence
"""
import os
import sys
import subprocess

def run_import_script(script_name):
    """Run a single import script"""
    print("\n")
    print("=" * 80)
    print(f"Running {script_name}")
    print("=" * 80)
    
    script_path = os.path.join(os.path.dirname(__file__), script_name)
    
    if not os.path.exists(script_path):
        print(f"ERROR: Script not found: {script_path}")
        return False
    
    try:
        result = subprocess.run(
            [sys.executable, script_path],
            check=True,
            capture_output=False
        )
        return True
    except subprocess.CalledProcessError as e:
        print(f"ERROR: Script failed with exit code {e.returncode}")
        return False
    except Exception as e:
        print(f"ERROR: {str(e)}")
        return False


def main():
    """Run all import scripts"""
    print("=" * 80)
    print("VERP Product Import - Master Script")
    print("=" * 80)
    print()
    print("This will import:")
    print("  1. Trading Products (Handelswaren)")
    print("  2. VisiView Products")
    print("  3. VS-Hardware Products")
    print("  4. VS-Service Products")
    print()
    print("All products will have prices valid until March 2026")
    print()
    
    response = input("Continue? (y/n): ").strip().lower()
    if response != 'y':
        print("Import cancelled.")
        return
    
    scripts = [
        'import_trading_products.py',
        'import_visiview_products.py',
        'import_vshardware.py',
        'import_vsservice_products.py'
    ]
    
    results = {}
    for script in scripts:
        success = run_import_script(script)
        results[script] = success
    
    # Summary
    print("\n")
    print("=" * 80)
    print("Import Summary")
    print("=" * 80)
    
    for script, success in results.items():
        status = "✓ SUCCESS" if success else "✗ FAILED"
        print(f"{status}: {script}")
    
    all_success = all(results.values())
    if all_success:
        print("\n✓ All imports completed successfully!")
    else:
        print("\n✗ Some imports failed. Please check the logs above.")
        sys.exit(1)


if __name__ == '__main__':
    main()
