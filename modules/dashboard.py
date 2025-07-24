from PyQt5.QtWidgets import (QWidget, QVBoxLayout, QHBoxLayout, QLabel, 
                             QFrame, QGridLayout, QPushButton, QScrollArea,
                             QGroupBox, QProgressBar, QTableWidget, QTableWidgetItem)
from PyQt5.QtCore import Qt, QTimer
from PyQt5.QtGui import QFont, QPixmap
from datetime import datetime, timedelta
import os

from .utils import db, format_currency, COMPANY_INFO
from .logs import LogManager

class DashboardWidget(QWidget):
    """Dashboard showing company statistics and quick access."""
    
    def __init__(self):
        super().__init__()
        self.setup_ui()
        self.setup_auto_refresh()
        
    def setup_ui(self):
        """Setup dashboard user interface."""
        main_layout = QVBoxLayout(self)
        
        # Welcome header
        header = self.create_welcome_header()
        main_layout.addWidget(header)
        
        # Statistics cards
        stats_frame = self.create_stats_cards()
        main_layout.addWidget(stats_frame)
        
        # Recent activity and quick actions
        bottom_frame = QFrame()
        bottom_layout = QHBoxLayout(bottom_frame)
        
        # Recent activity
        activity_group = self.create_recent_activity()
        bottom_layout.addWidget(activity_group)
        
        # Quick actions
        actions_group = self.create_quick_actions()
        bottom_layout.addWidget(actions_group)
        
        main_layout.addWidget(bottom_frame)
        
        # Load initial data
        self.refresh_data()
        
    def create_welcome_header(self):
        """Create welcome header section."""
        header_frame = QFrame()
        header_frame.setFrameStyle(QFrame.Box)
        header_frame.setStyleSheet("background-color: #3498db; color: white; border-radius: 10px;")
        header_frame.setFixedHeight(100)
        
        layout = QHBoxLayout(header_frame)
        
        # Company logo (if exists)
        logo_label = QLabel()
        if os.path.exists("assets/logo.png"):
            pixmap = QPixmap("assets/logo.png")
            logo_label.setPixmap(pixmap.scaled(80, 80, Qt.KeepAspectRatio, Qt.SmoothTransformation))
        else:
            logo_label.setText("LOGO")
            logo_label.setStyleSheet("border: 2px solid white; padding: 20px;")
        layout.addWidget(logo_label)
        
        # Welcome text
        welcome_layout = QVBoxLayout()
        
        welcome_label = QLabel(f"Bienvenido al Sistema JURMAQ")
        welcome_label.setStyleSheet("font-size: 18px; font-weight: bold;")
        welcome_layout.addWidget(welcome_label)
        
        company_label = QLabel(COMPANY_INFO['name'])
        company_label.setStyleSheet("font-size: 14px;")
        welcome_layout.addWidget(company_label)
        
        date_label = QLabel(f"Fecha: {datetime.now().strftime('%d/%m/%Y %H:%M')}")
        date_label.setStyleSheet("font-size: 12px;")
        welcome_layout.addWidget(date_label)
        
        layout.addLayout(welcome_layout)
        layout.addStretch()
        
        return header_frame
        
    def create_stats_cards(self):
        """Create statistics cards."""
        stats_frame = QFrame()
        stats_layout = QGridLayout(stats_frame)
        
        # Get statistics data
        stats = self.get_statistics()
        
        # Orders card
        orders_card = self.create_stat_card(
            "Órdenes de Compra", 
            str(stats['total_orders']), 
            f"Pendientes: {stats['pending_orders']}",
            "#e74c3c"
        )
        stats_layout.addWidget(orders_card, 0, 0)
        
        # Budgets card
        budgets_card = self.create_stat_card(
            "Presupuestos", 
            str(stats['total_budgets']), 
            f"Aprobados: {stats['approved_budgets']}",
            "#f39c12"
        )
        stats_layout.addWidget(budgets_card, 0, 1)
        
        # Vehicles card
        vehicles_card = self.create_stat_card(
            "Vehículos", 
            str(stats['total_vehicles']), 
            f"Activos: {stats['active_vehicles']}",
            "#27ae60"
        )
        stats_layout.addWidget(vehicles_card, 0, 2)
        
        # Personnel card
        personnel_card = self.create_stat_card(
            "Personal", 
            str(stats['total_employees']), 
            f"Activos: {stats['active_employees']}",
            "#9b59b6"
        )
        stats_layout.addWidget(personnel_card, 0, 3)
        
        # Monthly expenses card
        expenses_card = self.create_stat_card(
            "Gastos del Mes", 
            format_currency(stats['monthly_expenses']), 
            f"Combustible: {format_currency(stats['fuel_expenses'])}",
            "#34495e"
        )
        stats_layout.addWidget(expenses_card, 1, 0, 1, 2)
        
        # Monthly payroll card
        payroll_card = self.create_stat_card(
            "Nómina del Mes", 
            format_currency(stats['monthly_payroll']), 
            f"Empleados: {stats['payroll_employees']}",
            "#16a085"
        )
        stats_layout.addWidget(payroll_card, 1, 2, 1, 2)
        
        return stats_frame
        
    def create_stat_card(self, title, value, subtitle, color):
        """Create a statistics card."""
        card = QFrame()
        card.setFrameStyle(QFrame.Box)
        card.setStyleSheet(f"""
            QFrame {{
                background-color: white;
                border: 1px solid #bdc3c7;
                border-radius: 8px;
                border-left: 4px solid {color};
            }}
        """)
        card.setFixedHeight(120)
        
        layout = QVBoxLayout(card)
        
        title_label = QLabel(title)
        title_label.setStyleSheet("font-size: 12px; color: #7f8c8d; font-weight: bold;")
        layout.addWidget(title_label)
        
        value_label = QLabel(value)
        value_label.setStyleSheet(f"font-size: 24px; color: {color}; font-weight: bold;")
        layout.addWidget(value_label)
        
        subtitle_label = QLabel(subtitle)
        subtitle_label.setStyleSheet("font-size: 10px; color: #95a5a6;")
        layout.addWidget(subtitle_label)
        
        layout.addStretch()
        
        return card
        
    def create_recent_activity(self):
        """Create recent activity section."""
        group = QGroupBox("Actividad Reciente")
        layout = QVBoxLayout(group)
        
        activity_table = QTableWidget()
        activity_table.setColumnCount(3)
        activity_table.setHorizontalHeaderLabels(["Hora", "Usuario", "Acción"])
        activity_table.horizontalHeader().setStretchLastSection(True)
        activity_table.setMaximumHeight(200)
        
        # Get recent logs
        recent_logs = LogManager.get_logs()
        sorted_logs = sorted(recent_logs.items(), 
                           key=lambda x: x[1].get('timestamp', ''), 
                           reverse=True)[:10]
        
        activity_table.setRowCount(len(sorted_logs))
        for row, (log_id, log_data) in enumerate(sorted_logs):
            timestamp = log_data.get('timestamp', '')
            if timestamp:
                time_str = datetime.fromisoformat(timestamp).strftime('%H:%M')
            else:
                time_str = ''
                
            activity_table.setItem(row, 0, QTableWidgetItem(time_str))
            activity_table.setItem(row, 1, QTableWidgetItem(log_data.get('user', '')))
            activity_table.setItem(row, 2, QTableWidgetItem(log_data.get('action', '')))
        
        layout.addWidget(activity_table)
        
        return group
        
    def create_quick_actions(self):
        """Create quick actions section."""
        group = QGroupBox("Acciones Rápidas")
        layout = QVBoxLayout(group)
        
        # Quick action buttons
        actions = [
            ("Nueva Orden de Compra", self.new_order),
            ("Nuevo Presupuesto", self.new_budget),
            ("Registrar Combustible", self.new_fuel_order),
            ("Ver Vehículos", self.view_vehicles),
            ("Asistencia Personal", self.view_attendance),
            ("Generar Reportes", self.generate_reports)
        ]
        
        for action_name, action_func in actions:
            button = QPushButton(action_name)
            button.clicked.connect(action_func)
            button.setStyleSheet("""
                QPushButton {
                    text-align: left;
                    padding: 10px;
                    margin: 2px;
                    border: 1px solid #bdc3c7;
                    border-radius: 4px;
                    background-color: #ecf0f1;
                    color: #2c3e50;
                }
                QPushButton:hover {
                    background-color: #d5dbdb;
                }
            """)
            layout.addWidget(button)
            
        layout.addStretch()
        
        return group
        
    def get_statistics(self):
        """Get dashboard statistics."""
        # Get data from different modules
        orders = db.get_all_records('ordenes_compra')
        budgets = db.get_all_records('presupuestos')
        vehicles = db.get_all_records('vehiculos')
        employees = db.get_all_records('empleados')
        
        # Calculate statistics
        stats = {
            'total_orders': len(orders),
            'pending_orders': len([o for o in orders.values() if o.get('estado') == 'pendiente']),
            'total_budgets': len(budgets),
            'approved_budgets': len([b for b in budgets.values() if b.get('estado') == 'aprobado']),
            'total_vehicles': len(vehicles),
            'active_vehicles': len([v for v in vehicles.values() if v.get('activo', True)]),
            'total_employees': len(employees),
            'active_employees': len([e for e in employees.values() if e.get('activo', True)]),
            'monthly_expenses': 0,
            'fuel_expenses': 0,
            'monthly_payroll': 0,
            'payroll_employees': 0
        }
        
        # Calculate monthly expenses
        current_month = datetime.now().strftime('%Y-%m')
        for order in orders.values():
            if order.get('fecha', '').startswith(current_month):
                stats['monthly_expenses'] += order.get('total', 0)
                if order.get('tipo') == 'combustible':
                    stats['fuel_expenses'] += order.get('total', 0)
        
        # Calculate payroll
        payroll_records = db.get_all_records('nomina')
        for record in payroll_records.values():
            if record.get('periodo', '').startswith(current_month):
                stats['monthly_payroll'] += record.get('sueldo_liquido', 0)
                stats['payroll_employees'] += 1
        
        return stats
        
    def setup_auto_refresh(self):
        """Setup auto-refresh timer."""
        self.refresh_timer = QTimer()
        self.refresh_timer.timeout.connect(self.refresh_data)
        self.refresh_timer.start(60000)  # Refresh every minute
        
    def refresh_data(self):
        """Refresh dashboard data."""
        # Update statistics - this would normally trigger a UI refresh
        # For now, we'll just log the refresh
        from .login import login_manager
        user = login_manager.get_current_user()
        if user:
            LogManager.log_action(user['username'], 'DASHBOARD_REFRESH', 'DASHBOARD')
        
    # Quick action methods
    def new_order(self):
        """Create new purchase order."""
        # This would be handled by the parent window to switch tabs
        pass
        
    def new_budget(self):
        """Create new budget."""
        pass
        
    def new_fuel_order(self):
        """Create new fuel order."""
        pass
        
    def view_vehicles(self):
        """View vehicles."""
        pass
        
    def view_attendance(self):
        """View attendance."""
        pass
        
    def generate_reports(self):
        """Generate reports."""
        pass