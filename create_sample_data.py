#!/usr/bin/env python3
"""
Script to create sample data for the JURMAQ system.
"""

import os
import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from datetime import datetime, timedelta
from modules.utils import db, generate_id, calculate_payroll
from modules.login import login_manager

def create_sample_data():
    """Create sample data for testing the system."""
    print("Creating sample data for JURMAQ system...")
    
    # Sample employees
    employees_data = {
        'EMP_001': {
            'rut': '12.345.678-9',
            'nombre': 'Juan Carlos Pérez Silva',
            'cargo': 'Maestro Constructor',
            'telefono': '+569 8765 4321',
            'email': 'juan.perez@jurmaq.cl',
            'direccion': 'Av. Libertad 123, Curicó',
            'fecha_ingreso': '2022-01-15',
            'sueldo_base': 800000,
            'dias_vacaciones_disponibles': 12,
            'activo': True,
            'created_at': datetime.now().isoformat(),
            'updated_at': datetime.now().isoformat()
        },
        'EMP_002': {
            'rut': '98.765.432-1',
            'nombre': 'María Elena González Torres',
            'cargo': 'Jefe de Obra',
            'telefono': '+569 9876 5432',
            'email': 'maria.gonzalez@jurmaq.cl',
            'direccion': 'Los Aromos 456, Curicó',
            'fecha_ingreso': '2021-08-20',
            'sueldo_base': 950000,
            'dias_vacaciones_disponibles': 15,
            'activo': True,
            'created_at': datetime.now().isoformat(),
            'updated_at': datetime.now().isoformat()
        },
        'EMP_003': {
            'rut': '11.222.333-4',
            'nombre': 'Carlos Alberto Rojas Mendoza',
            'cargo': 'Operador de Maquinaria',
            'telefono': '+569 1122 3344',
            'email': 'carlos.rojas@jurmaq.cl',
            'direccion': 'Santa Rosa 789, Curicó',
            'fecha_ingreso': '2023-03-10',
            'sueldo_base': 650000,
            'dias_vacaciones_disponibles': 15,
            'activo': True,
            'created_at': datetime.now().isoformat(),
            'updated_at': datetime.now().isoformat()
        }
    }
    
    # Sample vehicles
    vehicles_data = {
        'VEH_001': {
            'patente': 'ABC-123',
            'marca': 'Mercedes-Benz',
            'modelo': 'Atego 1726',
            'año': 2020,
            'tipo': 'Camión',
            'color': 'Blanco',
            'activo': True,
            'motor': 'OM924LA',
            'chasis': 'WDB9700451L123456',
            'tipo_combustible': 'Diesel',
            'capacidad_estanque': 200,
            'revision_tecnica': '2024-06-15',
            'seguro': '2024-12-31',
            'permiso_circulacion': '2024-03-31',
            'observaciones': 'Vehículo en excelente estado',
            'created_at': datetime.now().isoformat(),
            'updated_at': datetime.now().isoformat()
        },
        'VEH_002': {
            'patente': 'DEF-456',
            'marca': 'Ford',
            'modelo': 'Ranger XLT',
            'año': 2021,
            'tipo': 'Camioneta',
            'color': 'Gris',
            'activo': True,
            'motor': '2.2 TDCi',
            'chasis': 'WF0AXXTTGAXB12345',
            'tipo_combustible': 'Diesel',
            'capacidad_estanque': 80,
            'revision_tecnica': '2024-08-20',
            'seguro': '2024-11-30',
            'permiso_circulacion': '2024-03-31',
            'observaciones': 'Vehículo para supervisión de obras',
            'created_at': datetime.now().isoformat(),
            'updated_at': datetime.now().isoformat()
        },
        'VEH_003': {
            'patente': 'GHI-789',
            'marca': 'Caterpillar',
            'modelo': '320D',
            'año': 2019,
            'tipo': 'Maquinaria',
            'color': 'Amarillo',
            'activo': True,
            'motor': 'Cat C6.4',
            'chasis': 'CAT0320DLCPS1234',
            'tipo_combustible': 'Diesel',
            'capacidad_estanque': 400,
            'revision_tecnica': '2024-04-10',
            'seguro': '2024-10-15',
            'permiso_circulacion': '2024-03-31',
            'observaciones': 'Excavadora para movimiento de tierra',
            'created_at': datetime.now().isoformat(),
            'updated_at': datetime.now().isoformat()
        }
    }
    
    # Sample purchase orders
    orders_data = {
        'OC_20241101_001': {
            'tipo': 'normal',
            'proveedor': 'Ferretería Los Andes S.A.',
            'proveedor_rut': '96.123.456-7',
            'fecha': '2024-01-15',
            'estado': 'entregada',
            'descripcion': 'Materiales de construcción para obra Maquehua',
            'items': [
                {
                    'descripcion': 'Cemento Ultra 42.5 kg',
                    'cantidad': 50,
                    'precio_unitario': 8500,
                    'subtotal': 425000
                },
                {
                    'descripcion': 'Fierro 12mm x 12m',
                    'cantidad': 20,
                    'precio_unitario': 15000,
                    'subtotal': 300000
                },
                {
                    'descripcion': 'Arena de construcción m3',
                    'cantidad': 10,
                    'precio_unitario': 25000,
                    'subtotal': 250000
                }
            ],
            'total': 975000,
            'creado_por': 'admin',
            'created_at': datetime.now().isoformat(),
            'updated_at': datetime.now().isoformat()
        },
        'OC_20241101_002': {
            'tipo': 'combustible',
            'proveedor': 'COMERCIAL MAQUEHUA SPA',
            'proveedor_rut': '77.346.747-1',
            'fecha': '2024-01-20',
            'estado': 'entregada',
            'descripcion': 'Combustible para vehículo ABC-123',
            'vehiculo_id': 'VEH_001',
            'vehiculo': 'ABC-123',
            'monto_combustible': 80000,
            'total': 80000,
            'creado_por': 'secretaria',
            'created_at': datetime.now().isoformat(),
            'updated_at': datetime.now().isoformat()
        }
    }
    
    # Sample budgets
    budgets_data = {
        'PPTO_20241101_001': {
            'cliente': 'Municipalidad de Curicó',
            'cliente_rut': '69.123.456-7',
            'contacto': 'Pedro Silva',
            'telefono': '+56 75 2345678',
            'email': 'pedro.silva@curicopublica.cl',
            'fecha': '2024-01-10',
            'vigencia': 30,
            'estado': 'enviado',
            'observaciones': 'Construcción de vereda en Av. Maquehua. Incluye materiales y mano de obra.',
            'items': [
                {
                    'descripcion': 'Excavación y nivelación',
                    'cantidad': 100,
                    'precio_unitario': 8500,
                    'subtotal': 850000
                },
                {
                    'descripcion': 'Hormigón para vereda m2',
                    'cantidad': 200,
                    'precio_unitario': 12000,
                    'subtotal': 2400000
                },
                {
                    'descripcion': 'Mano de obra especializada',
                    'cantidad': 1,
                    'precio_unitario': 1500000,
                    'subtotal': 1500000
                }
            ],
            'total': 4750000,
            'creado_por': 'admin',
            'created_at': datetime.now().isoformat(),
            'updated_at': datetime.now().isoformat()
        }
    }
    
    # Sample fuel records
    fuel_records = {}
    today = datetime.now()
    
    for i in range(12):  # 12 months of fuel records
        month_date = today - timedelta(days=30*i)
        record_id = f"COMB_{month_date.strftime('%Y%m%d')}_{i:03d}"
        
        fuel_records[record_id] = {
            'vehiculo_id': 'VEH_001',
            'fecha': month_date.strftime('%Y-%m-%d'),
            'monto': 75000 + (i * 5000),  # Varying amounts
            'litros': 80 + (i * 5),
            'kilometraje': 150000 + (i * 2000),
            'observaciones': f'Carga combustible mensual {month_date.strftime("%B %Y")}',
            'registrado_por': 'admin',
            'created_at': datetime.now().isoformat(),
            'updated_at': datetime.now().isoformat()
        }
    
    # Sample attendance records
    attendance_records = {}
    current_month = today.strftime('%Y-%m')
    
    for emp_id in employees_data.keys():
        att_id = f"{emp_id}_{current_month}"
        attendance_records[att_id] = {
            'empleado_id': emp_id,
            'empleado_nombre': employees_data[emp_id]['nombre'],
            'periodo': current_month,
            'dias_trabajados': 22,
            'horas_extras': 8,
            'observaciones': 'Asistencia normal',
            'created_at': datetime.now().isoformat(),
            'updated_at': datetime.now().isoformat()
        }
    
    # Sample payroll records
    payroll_records = {}
    
    for emp_id, emp_data in employees_data.items():
        attendance = attendance_records.get(f"{emp_id}_{current_month}")
        if attendance:
            sueldo_base = emp_data['sueldo_base']
            dias_trabajados = attendance['dias_trabajados']
            horas_extras = attendance['horas_extras']
            
            sueldo_proporcional = calculate_payroll(sueldo_base, dias_trabajados, 30)
            bonos = horas_extras * 5000
            descuentos_previsionales = sueldo_proporcional * 0.12
            total_descuentos = descuentos_previsionales
            sueldo_liquido = sueldo_proporcional + bonos - total_descuentos
            
            payroll_id = f"{emp_id}_{current_month}"
            payroll_records[payroll_id] = {
                'empleado_id': emp_id,
                'empleado_nombre': emp_data['nombre'],
                'empleado_rut': emp_data['rut'],
                'cargo': emp_data['cargo'],
                'periodo': current_month,
                'sueldo_base': sueldo_base,
                'dias_trabajados': dias_trabajados,
                'sueldo_proporcional': sueldo_proporcional,
                'bonos': bonos,
                'total_haberes': sueldo_proporcional + bonos,
                'descuentos_previsionales': descuentos_previsionales,
                'descuentos_otros': 0,
                'total_descuentos': total_descuentos,
                'sueldo_liquido': sueldo_liquido,
                'estado': 'calculado',
                'created_at': datetime.now().isoformat(),
                'updated_at': datetime.now().isoformat()
            }
    
    # Sample vacation requests
    vacation_records = {
        'VAC_20241101_001': {
            'empleado_id': 'EMP_001',
            'empleado_nombre': 'Juan Carlos Pérez Silva',
            'fecha_inicio': '2024-02-15',
            'fecha_fin': '2024-02-25',
            'dias': 10,
            'motivo': 'Vacaciones familiares',
            'estado': 'aprobada',
            'fecha_solicitud': '2024-01-15',
            'fecha_aprobacion': '2024-01-16',
            'created_at': datetime.now().isoformat(),
            'updated_at': datetime.now().isoformat()
        },
        'VAC_20241101_002': {
            'empleado_id': 'EMP_002',
            'empleado_nombre': 'María Elena González Torres',
            'fecha_inicio': '2024-03-01',
            'fecha_fin': '2024-03-07',
            'dias': 7,
            'motivo': 'Descanso médico',
            'estado': 'pendiente',
            'fecha_solicitud': '2024-02-15',
            'created_at': datetime.now().isoformat(),
            'updated_at': datetime.now().isoformat()
        }
    }
    
    # Save all data to database
    print("Saving employees...")
    for emp_id, emp_data in employees_data.items():
        db.add_record('empleados', emp_id, emp_data)
    
    print("Saving vehicles...")
    for veh_id, veh_data in vehicles_data.items():
        db.add_record('vehiculos', veh_id, veh_data)
    
    print("Saving purchase orders...")
    for order_id, order_data in orders_data.items():
        db.add_record('ordenes_compra', order_id, order_data)
    
    print("Saving budgets...")
    for budget_id, budget_data in budgets_data.items():
        db.add_record('presupuestos', budget_id, budget_data)
    
    print("Saving fuel records...")
    for fuel_id, fuel_data in fuel_records.items():
        db.add_record('combustible_vehiculos', fuel_id, fuel_data)
    
    print("Saving attendance records...")
    for att_id, att_data in attendance_records.items():
        db.add_record('asistencia', att_id, att_data)
    
    print("Saving payroll records...")
    for pay_id, pay_data in payroll_records.items():
        db.add_record('nomina', pay_id, pay_data)
    
    print("Saving vacation records...")
    for vac_id, vac_data in vacation_records.items():
        db.add_record('vacaciones', vac_id, vac_data)
    
    print("Sample data created successfully!")
    print(f"- {len(employees_data)} employees")
    print(f"- {len(vehicles_data)} vehicles")
    print(f"- {len(orders_data)} purchase orders")
    print(f"- {len(budgets_data)} budgets")
    print(f"- {len(fuel_records)} fuel records")
    print(f"- {len(attendance_records)} attendance records")
    print(f"- {len(payroll_records)} payroll records")
    print(f"- {len(vacation_records)} vacation requests")

if __name__ == "__main__":
    create_sample_data()