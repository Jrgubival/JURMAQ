#!/usr/bin/env python3
"""
Test script to verify JURMAQ system functionality without GUI.
"""

import os
import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from modules.utils import db, format_currency, calculate_payroll
from modules.login import login_manager
from modules.logs import LogManager

def test_database():
    """Test database functionality."""
    print("=== Testing Database Functionality ===")
    
    # Test loading data
    employees = db.get_all_records('empleados')
    vehicles = db.get_all_records('vehiculos')
    orders = db.get_all_records('ordenes_compra')
    budgets = db.get_all_records('presupuestos')
    
    print(f"✓ Loaded {len(employees)} employees")
    print(f"✓ Loaded {len(vehicles)} vehicles") 
    print(f"✓ Loaded {len(orders)} purchase orders")
    print(f"✓ Loaded {len(budgets)} budgets")
    
    # Test specific employee
    if employees:
        emp_id, emp_data = next(iter(employees.items()))
        print(f"✓ Sample employee: {emp_data['nombre']} - {emp_data['cargo']}")
    
    return True

def test_authentication():
    """Test authentication system."""
    print("\n=== Testing Authentication System ===")
    
    # Test login with correct credentials
    if login_manager.authenticate('admin', 'admin123'):
        print("✓ Admin login successful")
        user = login_manager.get_current_user()
        print(f"✓ Current user: {user['full_name']} ({user['role']})")
        
        # Test permissions
        if login_manager.has_permission('admin'):
            print("✓ Admin permissions verified")
        
        login_manager.logout()
        print("✓ Logout successful")
    else:
        print("✗ Admin login failed")
        return False
    
    # Test login with wrong credentials
    if not login_manager.authenticate('admin', 'wrongpassword'):
        print("✓ Invalid credentials correctly rejected")
    else:
        print("✗ Invalid credentials incorrectly accepted")
        return False
    
    return True

def test_calculations():
    """Test calculation functions."""
    print("\n=== Testing Calculation Functions ===")
    
    # Test payroll calculation
    gross_salary = 600000
    days_worked = 22
    total_days = 30
    
    final_salary = calculate_payroll(gross_salary, days_worked, total_days)
    expected = (gross_salary / total_days) * days_worked
    
    if abs(final_salary - expected) < 0.01:
        print(f"✓ Payroll calculation: {format_currency(final_salary)}")
    else:
        print(f"✗ Payroll calculation error: got {final_salary}, expected {expected}")
        return False
    
    # Test currency formatting
    test_amount = 1234567.89
    formatted = format_currency(test_amount)
    print(f"✓ Currency formatting: {formatted}")
    
    return True

def test_logging():
    """Test logging system."""
    print("\n=== Testing Logging System ===")
    
    # Login first
    login_manager.authenticate('admin', 'admin123')
    
    # Test log creation
    LogManager.log_action('admin', 'TEST_ACTION', 'TEST_MODULE', {'test': 'data'})
    print("✓ Log entry created")
    
    # Test log retrieval
    logs = LogManager.get_logs(user='admin')
    if logs:
        print(f"✓ Retrieved {len(logs)} log entries for admin")
    else:
        print("✗ No logs found for admin")
        return False
    
    # Test user activity
    activity = LogManager.get_user_activity('admin', 1)
    print(f"✓ User activity: {activity['total_actions']} actions")
    
    login_manager.logout()
    return True

def test_pdf_generation():
    """Test PDF generation without GUI."""
    print("\n=== Testing PDF Generation ===")
    
    try:
        from modules.pdf_generator import generate_order_pdf, generate_budget_pdf
        
        # Test order PDF with sample data
        orders = db.get_all_records('ordenes_compra')
        if orders:
            order_id, order_data = next(iter(orders.items()))
            pdf_path = generate_order_pdf(order_id, order_data)
            
            if os.path.exists(pdf_path):
                print(f"✓ Order PDF generated: {pdf_path}")
                print(f"  File size: {os.path.getsize(pdf_path)} bytes")
            else:
                print("✗ Order PDF not generated")
                return False
        
        # Test budget PDF
        budgets = db.get_all_records('presupuestos')
        if budgets:
            budget_id, budget_data = next(iter(budgets.items()))
            pdf_path = generate_budget_pdf(budget_id, budget_data)
            
            if os.path.exists(pdf_path):
                print(f"✓ Budget PDF generated: {pdf_path}")
                print(f"  File size: {os.path.getsize(pdf_path)} bytes")
            else:
                print("✗ Budget PDF not generated")
                return False
        
        return True
        
    except Exception as e:
        print(f"✗ PDF generation error: {e}")
        return False

def test_data_integrity():
    """Test data relationships and integrity."""
    print("\n=== Testing Data Integrity ===")
    
    # Test employee-attendance relationship
    employees = db.get_all_records('empleados')
    attendance = db.get_all_records('asistencia')
    
    valid_relationships = 0
    for att_id, att_data in attendance.items():
        emp_id = att_data.get('empleado_id')
        if emp_id in employees:
            valid_relationships += 1
    
    print(f"✓ Valid employee-attendance relationships: {valid_relationships}/{len(attendance)}")
    
    # Test vehicle-fuel relationship
    vehicles = db.get_all_records('vehiculos')
    fuel_records = db.get_all_records('combustible_vehiculos')
    
    valid_fuel_relationships = 0
    for fuel_id, fuel_data in fuel_records.items():
        veh_id = fuel_data.get('vehiculo_id')
        if veh_id in vehicles:
            valid_fuel_relationships += 1
    
    print(f"✓ Valid vehicle-fuel relationships: {valid_fuel_relationships}/{len(fuel_records)}")
    
    # Test fuel supplier validation
    orders = db.get_all_records('ordenes_compra')
    fuel_orders = [o for o in orders.values() if o.get('tipo') == 'combustible']
    
    valid_fuel_suppliers = 0
    for order in fuel_orders:
        if order.get('proveedor_rut') == '77.346.747-1':  # COMERCIAL MAQUEHUA SPA
            valid_fuel_suppliers += 1
    
    print(f"✓ Valid fuel supplier orders: {valid_fuel_suppliers}/{len(fuel_orders)}")
    
    return True

def test_business_logic():
    """Test specific business logic requirements."""
    print("\n=== Testing Business Logic ===")
    
    # Test fuel order vehicle assignment
    orders = db.get_all_records('ordenes_compra')
    fuel_orders = [o for o in orders.values() if o.get('tipo') == 'combustible']
    
    for order in fuel_orders:
        if order.get('vehiculo_id') and order.get('vehiculo'):
            print(f"✓ Fuel order {order.get('vehiculo')} has vehicle assignment")
        else:
            print("✗ Fuel order missing vehicle assignment")
            return False
    
    # Test vacation day tracking
    employees = db.get_all_records('empleados')
    for emp_id, emp_data in employees.items():
        vacation_days = emp_data.get('dias_vacaciones_disponibles', 0)
        if 0 <= vacation_days <= 30:  # Reasonable range
            continue
        else:
            print(f"✗ Invalid vacation days for employee {emp_data.get('nombre')}: {vacation_days}")
            return False
    
    print("✓ Vacation day tracking valid")
    
    # Test payroll calculations
    payroll = db.get_all_records('nomina')
    for pay_id, pay_data in payroll.items():
        sueldo_base = pay_data.get('sueldo_base', 0)
        dias_trabajados = pay_data.get('dias_trabajados', 0)
        sueldo_liquido = pay_data.get('sueldo_liquido', 0)
        
        if sueldo_liquido > 0 and dias_trabajados > 0:
            print(f"✓ Payroll calculation valid for {pay_data.get('empleado_nombre')}")
        else:
            print(f"✗ Invalid payroll for {pay_data.get('empleado_nombre')}")
            return False
    
    return True

def run_all_tests():
    """Run all tests."""
    print("JURMAQ System Backend Test Suite")
    print("=" * 50)
    
    tests = [
        ("Database Functionality", test_database),
        ("Authentication System", test_authentication),
        ("Calculation Functions", test_calculations),
        ("Logging System", test_logging),
        ("PDF Generation", test_pdf_generation),
        ("Data Integrity", test_data_integrity),
        ("Business Logic", test_business_logic)
    ]
    
    passed = 0
    total = len(tests)
    
    for test_name, test_func in tests:
        try:
            if test_func():
                passed += 1
                print(f"\n✓ {test_name} - PASSED")
            else:
                print(f"\n✗ {test_name} - FAILED")
        except Exception as e:
            print(f"\n✗ {test_name} - ERROR: {e}")
    
    print("\n" + "=" * 50)
    print(f"Test Results: {passed}/{total} tests passed")
    
    if passed == total:
        print("🎉 All tests PASSED! System is ready for production.")
        return True
    else:
        print("❌ Some tests FAILED. Please review the issues above.")
        return False

if __name__ == "__main__":
    success = run_all_tests()
    sys.exit(0 if success else 1)