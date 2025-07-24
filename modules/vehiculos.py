from PyQt5.QtWidgets import (QWidget, QVBoxLayout, QHBoxLayout, QLabel, 
                             QTableWidget, QTableWidgetItem, QPushButton,
                             QDialog, QFormLayout, QLineEdit, QComboBox,
                             QDateEdit, QDoubleSpinBox, QTextEdit, QMessageBox,
                             QFrame, QTabWidget, QSpinBox, QHeaderView, QAbstractItemView,
                             QCheckBox, QGroupBox, QGridLayout)
from PyQt5.QtCore import Qt, QDate
from PyQt5.QtGui import QFont
from datetime import datetime, timedelta

from .utils import db, generate_id, format_currency
from .logs import LogManager
from .login import login_manager

class VehiculosWidget(QWidget):
    """Widget for managing vehicles and fuel tracking."""
    
    def __init__(self):
        super().__init__()
        self.setup_ui()
        self.load_data()
        
    def setup_ui(self):
        """Setup user interface."""
        layout = QVBoxLayout(self)
        
        # Header
        header_frame = QFrame()
        header_layout = QHBoxLayout(header_frame)
        
        title_label = QLabel("Gestión de Vehículos")
        title_label.setStyleSheet("font-size: 18px; font-weight: bold; color: #2c3e50;")
        header_layout.addWidget(title_label)
        
        header_layout.addStretch()
        
        # Action buttons (only for authorized users)
        if login_manager.has_permission('secretaria'):
            self.new_btn = QPushButton("Nuevo Vehículo")
            self.new_btn.clicked.connect(self.new_vehicle)
            header_layout.addWidget(self.new_btn)
            
            self.edit_btn = QPushButton("Editar")
            self.edit_btn.clicked.connect(self.edit_vehicle)
            self.edit_btn.setEnabled(False)
            header_layout.addWidget(self.edit_btn)
            
            self.delete_btn = QPushButton("Eliminar")
            self.delete_btn.clicked.connect(self.delete_vehicle)
            self.delete_btn.setEnabled(False)
            self.delete_btn.setStyleSheet("background-color: #e74c3c;")
            header_layout.addWidget(self.delete_btn)
        
        self.fuel_btn = QPushButton("Registro Combustible")
        self.fuel_btn.clicked.connect(self.add_fuel_record)
        self.fuel_btn.setEnabled(False)
        self.fuel_btn.setStyleSheet("background-color: #f39c12;")
        header_layout.addWidget(self.fuel_btn)
        
        self.stats_btn = QPushButton("Estadísticas")
        self.stats_btn.clicked.connect(self.show_stats)
        self.stats_btn.setEnabled(False)
        self.stats_btn.setStyleSheet("background-color: #9b59b6;")
        header_layout.addWidget(self.stats_btn)
        
        layout.addWidget(header_frame)
        
        # Filters
        filter_frame = QFrame()
        filter_layout = QHBoxLayout(filter_frame)
        
        filter_layout.addWidget(QLabel("Estado:"))
        self.status_filter = QComboBox()
        self.status_filter.addItems(["Todos", "Activo", "Inactivo"])
        self.status_filter.currentTextChanged.connect(self.apply_filters)
        filter_layout.addWidget(self.status_filter)
        
        filter_layout.addWidget(QLabel("Tipo:"))
        self.type_filter = QComboBox()
        self.type_filter.addItems(["Todos", "Camión", "Camioneta", "Auto", "Maquinaria"])
        self.type_filter.currentTextChanged.connect(self.apply_filters)
        filter_layout.addWidget(self.type_filter)
        
        filter_layout.addStretch()
        
        layout.addWidget(filter_frame)
        
        # Vehicles table
        self.vehicles_table = QTableWidget()
        self.vehicles_table.setColumnCount(8)
        self.vehicles_table.setHorizontalHeaderLabels([
            "Patente", "Marca", "Modelo", "Año", "Tipo", "Estado", "Combustible Mes", "Último Uso"
        ])
        
        # Configure table
        header = self.vehicles_table.horizontalHeader()
        header.setStretchLastSection(True)
        self.vehicles_table.setSelectionBehavior(QAbstractItemView.SelectRows)
        self.vehicles_table.setAlternatingRowColors(True)
        
        # Connect selection
        self.vehicles_table.itemSelectionChanged.connect(self.on_selection_changed)
        
        layout.addWidget(self.vehicles_table)
        
    def load_data(self):
        """Load vehicles data."""
        vehicles = db.get_all_records('vehiculos')
        self.populate_table(vehicles)
        
    def populate_table(self, vehicles):
        """Populate the vehicles table."""
        self.vehicles_table.setRowCount(len(vehicles))
        
        # Get current month for fuel calculation
        current_month = datetime.now().strftime('%Y-%m')
        
        for row, (vehicle_id, vehicle_data) in enumerate(vehicles.items()):
            self.vehicles_table.setItem(row, 0, QTableWidgetItem(vehicle_data.get('patente', '')))
            self.vehicles_table.setItem(row, 1, QTableWidgetItem(vehicle_data.get('marca', '')))
            self.vehicles_table.setItem(row, 2, QTableWidgetItem(vehicle_data.get('modelo', '')))
            self.vehicles_table.setItem(row, 3, QTableWidgetItem(str(vehicle_data.get('año', ''))))
            self.vehicles_table.setItem(row, 4, QTableWidgetItem(vehicle_data.get('tipo', '')))
            
            estado = "Activo" if vehicle_data.get('activo', True) else "Inactivo"
            self.vehicles_table.setItem(row, 5, QTableWidgetItem(estado))
            
            # Calculate monthly fuel
            monthly_fuel = self.calculate_monthly_fuel(vehicle_id, current_month)
            self.vehicles_table.setItem(row, 6, QTableWidgetItem(format_currency(monthly_fuel)))
            
            # Last use
            last_use = self.get_last_use(vehicle_id)
            self.vehicles_table.setItem(row, 7, QTableWidgetItem(last_use))
            
    def calculate_monthly_fuel(self, vehicle_id, month):
        """Calculate fuel consumption for a specific month."""
        fuel_records = db.get_all_records('combustible_vehiculos')
        total = 0
        
        for record in fuel_records.values():
            if (record.get('vehiculo_id') == vehicle_id and 
                record.get('fecha', '').startswith(month)):
                total += record.get('monto', 0)
                
        return total
        
    def get_last_use(self, vehicle_id):
        """Get last use date of vehicle."""
        # Check in fuel records
        fuel_records = db.get_all_records('combustible_vehiculos')
        last_date = None
        
        for record in fuel_records.values():
            if record.get('vehiculo_id') == vehicle_id:
                record_date = record.get('fecha', '')
                if not last_date or record_date > last_date:
                    last_date = record_date
                    
        # Check in purchase orders
        orders = db.get_all_records('ordenes_compra')
        for order in orders.values():
            if order.get('vehiculo_id') == vehicle_id:
                order_date = order.get('fecha', '')
                if not last_date or order_date > last_date:
                    last_date = order_date
                    
        return last_date if last_date else 'Sin registros'
        
    def apply_filters(self):
        """Apply filters to the table."""
        status_filter = self.status_filter.currentText()
        type_filter = self.type_filter.currentText()
        
        vehicles = db.get_all_records('vehiculos')
        filtered_vehicles = {}
        
        for vehicle_id, vehicle_data in vehicles.items():
            # Status filter
            if status_filter != "Todos":
                is_active = vehicle_data.get('activo', True)
                if status_filter == "Activo" and not is_active:
                    continue
                elif status_filter == "Inactivo" and is_active:
                    continue
                    
            # Type filter
            if type_filter != "Todos":
                if vehicle_data.get('tipo', '') != type_filter:
                    continue
                    
            filtered_vehicles[vehicle_id] = vehicle_data
            
        self.populate_table(filtered_vehicles)
        
    def on_selection_changed(self):
        """Handle selection change."""
        has_selection = len(self.vehicles_table.selectedItems()) > 0
        
        if login_manager.has_permission('secretaria'):
            self.edit_btn.setEnabled(has_selection)
            self.delete_btn.setEnabled(has_selection)
            
        self.fuel_btn.setEnabled(has_selection)
        self.stats_btn.setEnabled(has_selection)
        
    def get_selected_vehicle_id(self):
        """Get selected vehicle ID."""
        current_row = self.vehicles_table.currentRow()
        if current_row >= 0:
            patente = self.vehicles_table.item(current_row, 0).text()
            # Find vehicle ID by patente
            vehicles = db.get_all_records('vehiculos')
            for vehicle_id, vehicle_data in vehicles.items():
                if vehicle_data.get('patente') == patente:
                    return vehicle_id
        return None
        
    def new_vehicle(self):
        """Create new vehicle."""
        dialog = VehicleDialog()
        if dialog.exec_() == QDialog.Accepted:
            self.load_data()
            
    def edit_vehicle(self):
        """Edit selected vehicle."""
        vehicle_id = self.get_selected_vehicle_id()
        if vehicle_id:
            vehicle_data = db.get_record('vehiculos', vehicle_id)
            if vehicle_data:
                dialog = VehicleDialog(vehicle_data=vehicle_data, vehicle_id=vehicle_id)
                if dialog.exec_() == QDialog.Accepted:
                    self.load_data()
                    
    def delete_vehicle(self):
        """Delete selected vehicle."""
        vehicle_id = self.get_selected_vehicle_id()
        if vehicle_id:
            reply = QMessageBox.question(
                self, 'Confirmar Eliminación',
                f'¿Está seguro que desea eliminar el vehículo {vehicle_id}?',
                QMessageBox.Yes | QMessageBox.No
            )
            
            if reply == QMessageBox.Yes:
                db.delete_record('vehiculos', vehicle_id)
                
                user = login_manager.get_current_user()
                LogManager.log_delete(user['username'], 'VEHICULOS', 'VEHICULO', vehicle_id)
                
                QMessageBox.information(self, 'Éxito', 'Vehículo eliminado correctamente')
                self.load_data()
                
    def add_fuel_record(self):
        """Add fuel consumption record."""
        vehicle_id = self.get_selected_vehicle_id()
        if vehicle_id:
            dialog = FuelRecordDialog(vehicle_id)
            if dialog.exec_() == QDialog.Accepted:
                self.load_data()
                
    def show_stats(self):
        """Show vehicle statistics."""
        vehicle_id = self.get_selected_vehicle_id()
        if vehicle_id:
            dialog = VehicleStatsDialog(vehicle_id)
            dialog.exec_()

class VehicleDialog(QDialog):
    """Dialog for creating/editing vehicles."""
    
    def __init__(self, vehicle_data=None, vehicle_id=None):
        super().__init__()
        self.vehicle_data = vehicle_data
        self.vehicle_id = vehicle_id
        self.is_edit_mode = vehicle_data is not None
        
        title = "Editar Vehículo" if self.is_edit_mode else "Nuevo Vehículo"
        self.setWindowTitle(title)
        self.setModal(True)
        self.resize(500, 600)
        self.setup_ui()
        
        if self.is_edit_mode:
            self.load_vehicle_data()
            
    def setup_ui(self):
        """Setup dialog user interface."""
        layout = QVBoxLayout(self)
        
        # Tab widget
        tab_widget = QTabWidget()
        
        # Basic information tab
        basic_tab = QWidget()
        basic_layout = QFormLayout(basic_tab)
        
        self.patente_edit = QLineEdit()
        self.patente_edit.setPlaceholderText("Ej: ABC-1234")
        basic_layout.addRow("Patente:", self.patente_edit)
        
        self.marca_edit = QLineEdit()
        basic_layout.addRow("Marca:", self.marca_edit)
        
        self.modelo_edit = QLineEdit()
        basic_layout.addRow("Modelo:", self.modelo_edit)
        
        self.year_spin = QSpinBox()
        self.year_spin.setRange(1990, datetime.now().year + 1)
        self.year_spin.setValue(datetime.now().year)
        basic_layout.addRow("Año:", self.year_spin)
        
        self.tipo_combo = QComboBox()
        self.tipo_combo.addItems(["Camión", "Camioneta", "Auto", "Maquinaria"])
        basic_layout.addRow("Tipo:", self.tipo_combo)
        
        self.color_edit = QLineEdit()
        basic_layout.addRow("Color:", self.color_edit)
        
        self.active_check = QCheckBox()
        self.active_check.setChecked(True)
        basic_layout.addRow("Activo:", self.active_check)
        
        tab_widget.addTab(basic_tab, "Información Básica")
        
        # Technical information tab
        tech_tab = QWidget()
        tech_layout = QFormLayout(tech_tab)
        
        self.motor_edit = QLineEdit()
        tech_layout.addRow("Motor:", self.motor_edit)
        
        self.chasis_edit = QLineEdit()
        tech_layout.addRow("N° Chasis:", self.chasis_edit)
        
        self.combustible_combo = QComboBox()
        self.combustible_combo.addItems(["Gasolina", "Diesel", "Gas", "Eléctrico"])
        tech_layout.addRow("Combustible:", self.combustible_combo)
        
        self.capacidad_spin = QDoubleSpinBox()
        self.capacidad_spin.setRange(0, 999)
        self.capacidad_spin.setSuffix(" L")
        tech_layout.addRow("Cap. Estanque:", self.capacidad_spin)
        
        tab_widget.addTab(tech_tab, "Información Técnica")
        
        # Documents tab
        docs_tab = QWidget()
        docs_layout = QFormLayout(docs_tab)
        
        self.revision_date = QDateEdit()
        self.revision_date.setCalendarPopup(True)
        docs_layout.addRow("Revisión Técnica:", self.revision_date)
        
        self.seguro_date = QDateEdit()
        self.seguro_date.setCalendarPopup(True)
        docs_layout.addRow("Seguro:", self.seguro_date)
        
        self.permiso_date = QDateEdit()
        self.permiso_date.setCalendarPopup(True)
        docs_layout.addRow("Permiso Circulación:", self.permiso_date)
        
        tab_widget.addTab(docs_tab, "Documentos")
        
        # Notes tab
        notes_tab = QWidget()
        notes_layout = QVBoxLayout(notes_tab)
        
        self.notes_edit = QTextEdit()
        self.notes_edit.setPlaceholderText("Observaciones adicionales sobre el vehículo...")
        notes_layout.addWidget(self.notes_edit)
        
        tab_widget.addTab(notes_tab, "Observaciones")
        
        layout.addWidget(tab_widget)
        
        # Buttons
        button_frame = QFrame()
        button_layout = QHBoxLayout(button_frame)
        
        button_layout.addStretch()
        
        cancel_btn = QPushButton("Cancelar")
        cancel_btn.clicked.connect(self.reject)
        button_layout.addWidget(cancel_btn)
        
        save_btn = QPushButton("Guardar")
        save_btn.clicked.connect(self.save_vehicle)
        save_btn.setStyleSheet("background-color: #27ae60;")
        button_layout.addWidget(save_btn)
        
        layout.addWidget(button_frame)
        
    def load_vehicle_data(self):
        """Load vehicle data for editing."""
        if not self.vehicle_data:
            return
            
        self.patente_edit.setText(self.vehicle_data.get('patente', ''))
        self.marca_edit.setText(self.vehicle_data.get('marca', ''))
        self.modelo_edit.setText(self.vehicle_data.get('modelo', ''))
        self.year_spin.setValue(self.vehicle_data.get('año', datetime.now().year))
        self.tipo_combo.setCurrentText(self.vehicle_data.get('tipo', 'Camión'))
        self.color_edit.setText(self.vehicle_data.get('color', ''))
        self.active_check.setChecked(self.vehicle_data.get('activo', True))
        
        self.motor_edit.setText(self.vehicle_data.get('motor', ''))
        self.chasis_edit.setText(self.vehicle_data.get('chasis', ''))
        self.combustible_combo.setCurrentText(self.vehicle_data.get('tipo_combustible', 'Diesel'))
        self.capacidad_spin.setValue(self.vehicle_data.get('capacidad_estanque', 0))
        
        # Load dates
        for date_field, date_widget in [
            ('revision_tecnica', self.revision_date),
            ('seguro', self.seguro_date),
            ('permiso_circulacion', self.permiso_date)
        ]:
            date_str = self.vehicle_data.get(date_field, '')
            if date_str:
                try:
                    date_obj = datetime.strptime(date_str, '%Y-%m-%d').date()
                    date_widget.setDate(QDate(date_obj))
                except ValueError:
                    pass
                    
        self.notes_edit.setPlainText(self.vehicle_data.get('observaciones', ''))
        
    def save_vehicle(self):
        """Save vehicle data."""
        if not self.validate_form():
            return
            
        vehicle_data = {
            'patente': self.patente_edit.text().upper(),
            'marca': self.marca_edit.text(),
            'modelo': self.modelo_edit.text(),
            'año': self.year_spin.value(),
            'tipo': self.tipo_combo.currentText(),
            'color': self.color_edit.text(),
            'activo': self.active_check.isChecked(),
            'motor': self.motor_edit.text(),
            'chasis': self.chasis_edit.text(),
            'tipo_combustible': self.combustible_combo.currentText(),
            'capacidad_estanque': self.capacidad_spin.value(),
            'revision_tecnica': self.revision_date.date().toString('yyyy-MM-dd'),
            'seguro': self.seguro_date.date().toString('yyyy-MM-dd'),
            'permiso_circulacion': self.permiso_date.date().toString('yyyy-MM-dd'),
            'observaciones': self.notes_edit.toPlainText()
        }
        
        user = login_manager.get_current_user()
        
        if self.is_edit_mode:
            db.update_record('vehiculos', self.vehicle_id, vehicle_data)
            LogManager.log_update(user['username'], 'VEHICULOS', 'VEHICULO', self.vehicle_id, vehicle_data)
        else:
            vehicle_id = generate_id('VEH')
            db.add_record('vehiculos', vehicle_id, vehicle_data)
            LogManager.log_create(user['username'], 'VEHICULOS', 'VEHICULO', vehicle_id, vehicle_data)
            
        self.accept()
        
    def validate_form(self):
        """Validate form data."""
        if not self.patente_edit.text().strip():
            QMessageBox.warning(self, 'Error de Validación', 'La patente es obligatoria')
            return False
            
        if not self.marca_edit.text().strip():
            QMessageBox.warning(self, 'Error de Validación', 'La marca es obligatoria')
            return False
            
        return True

class FuelRecordDialog(QDialog):
    """Dialog for adding fuel consumption records."""
    
    def __init__(self, vehicle_id):
        super().__init__()
        self.vehicle_id = vehicle_id
        self.setWindowTitle("Registro de Combustible")
        self.setModal(True)
        self.resize(400, 300)
        self.setup_ui()
        
    def setup_ui(self):
        """Setup dialog user interface."""
        layout = QFormLayout(self)
        
        # Vehicle info
        vehicle_data = db.get_record('vehiculos', self.vehicle_id)
        if vehicle_data:
            vehicle_info = f"{vehicle_data.get('patente', '')} - {vehicle_data.get('marca', '')} {vehicle_data.get('modelo', '')}"
            layout.addRow("Vehículo:", QLabel(vehicle_info))
        
        # Date
        self.date_edit = QDateEdit()
        self.date_edit.setDate(QDate.currentDate())
        self.date_edit.setCalendarPopup(True)
        layout.addRow("Fecha:", self.date_edit)
        
        # Amount
        self.amount_spin = QDoubleSpinBox()
        self.amount_spin.setRange(0, 999999)
        self.amount_spin.setDecimals(0)
        self.amount_spin.setSuffix(" pesos")
        layout.addRow("Monto:", self.amount_spin)
        
        # Liters (optional)
        self.liters_spin = QDoubleSpinBox()
        self.liters_spin.setRange(0, 999)
        self.liters_spin.setDecimals(2)
        self.liters_spin.setSuffix(" L")
        layout.addRow("Litros (opcional):", self.liters_spin)
        
        # Odometer reading (optional)
        self.odometer_spin = QSpinBox()
        self.odometer_spin.setRange(0, 9999999)
        self.odometer_spin.setSuffix(" km")
        layout.addRow("Kilometraje:", self.odometer_spin)
        
        # Notes
        self.notes_edit = QTextEdit()
        self.notes_edit.setMaximumHeight(80)
        self.notes_edit.setPlaceholderText("Observaciones adicionales...")
        layout.addRow("Observaciones:", self.notes_edit)
        
        # Buttons
        button_frame = QFrame()
        button_layout = QHBoxLayout(button_frame)
        
        button_layout.addStretch()
        
        cancel_btn = QPushButton("Cancelar")
        cancel_btn.clicked.connect(self.reject)
        button_layout.addWidget(cancel_btn)
        
        save_btn = QPushButton("Guardar")
        save_btn.clicked.connect(self.save_record)
        save_btn.setStyleSheet("background-color: #27ae60;")
        button_layout.addWidget(save_btn)
        
        layout.addWidget(button_frame)
        
    def save_record(self):
        """Save fuel record."""
        if self.amount_spin.value() <= 0:
            QMessageBox.warning(self, 'Error', 'El monto debe ser mayor a 0')
            return
            
        record_data = {
            'vehiculo_id': self.vehicle_id,
            'fecha': self.date_edit.date().toString('yyyy-MM-dd'),
            'monto': self.amount_spin.value(),
            'litros': self.liters_spin.value() if self.liters_spin.value() > 0 else None,
            'kilometraje': self.odometer_spin.value() if self.odometer_spin.value() > 0 else None,
            'observaciones': self.notes_edit.toPlainText()
        }
        
        user = login_manager.get_current_user()
        record_data['registrado_por'] = user['username'] if user else 'unknown'
        
        record_id = generate_id('COMB')
        db.add_record('combustible_vehiculos', record_id, record_data)
        
        LogManager.log_create(user['username'], 'VEHICULOS', 'COMBUSTIBLE', record_id, record_data)
        
        QMessageBox.information(self, 'Éxito', 'Registro de combustible guardado correctamente')
        self.accept()

class VehicleStatsDialog(QDialog):
    """Dialog showing vehicle statistics."""
    
    def __init__(self, vehicle_id):
        super().__init__()
        self.vehicle_id = vehicle_id
        self.setWindowTitle("Estadísticas del Vehículo")
        self.setModal(True)
        self.resize(600, 500)
        self.setup_ui()
        
    def setup_ui(self):
        """Setup dialog user interface."""
        layout = QVBoxLayout(self)
        
        # Vehicle info
        vehicle_data = db.get_record('vehiculos', self.vehicle_id)
        if vehicle_data:
            header = QLabel(f"Estadísticas - {vehicle_data.get('patente', '')} ({vehicle_data.get('marca', '')} {vehicle_data.get('modelo', '')})")
            header.setStyleSheet("font-size: 16px; font-weight: bold; color: #2c3e50;")
            layout.addWidget(header)
        
        # Statistics
        stats_frame = QFrame()
        stats_layout = QGridLayout(stats_frame)
        
        stats = self.calculate_stats()
        
        # Current month
        month_group = QGroupBox("Mes Actual")
        month_layout = QFormLayout(month_group)
        month_layout.addRow("Combustible:", QLabel(format_currency(stats['current_month_fuel'])))
        month_layout.addRow("Registros:", QLabel(str(stats['current_month_records'])))
        stats_layout.addWidget(month_group, 0, 0)
        
        # Last 3 months
        quarter_group = QGroupBox("Últimos 3 Meses")
        quarter_layout = QFormLayout(quarter_group)
        quarter_layout.addRow("Combustible:", QLabel(format_currency(stats['quarter_fuel'])))
        quarter_layout.addRow("Promedio Mensual:", QLabel(format_currency(stats['quarter_avg'])))
        stats_layout.addWidget(quarter_group, 0, 1)
        
        # Total
        total_group = QGroupBox("Totales")
        total_layout = QFormLayout(total_group)
        total_layout.addRow("Combustible Total:", QLabel(format_currency(stats['total_fuel'])))
        total_layout.addRow("Total Registros:", QLabel(str(stats['total_records'])))
        stats_layout.addWidget(total_group, 1, 0)
        
        # Efficiency
        efficiency_group = QGroupBox("Eficiencia")
        efficiency_layout = QFormLayout(efficiency_group)
        if stats['avg_consumption']:
            efficiency_layout.addRow("Promedio L/mes:", QLabel(f"{stats['avg_consumption']:.2f} L"))
        else:
            efficiency_layout.addRow("Promedio L/mes:", QLabel("Sin datos"))
        stats_layout.addWidget(efficiency_group, 1, 1)
        
        layout.addWidget(stats_frame)
        
        # Recent records table
        layout.addWidget(QLabel("Últimos Registros:"))
        
        records_table = QTableWidget()
        records_table.setColumnCount(4)
        records_table.setHorizontalHeaderLabels(["Fecha", "Monto", "Litros", "Kilometraje"])
        
        # Load recent records
        fuel_records = db.get_all_records('combustible_vehiculos')
        vehicle_records = []
        
        for record_id, record_data in fuel_records.items():
            if record_data.get('vehiculo_id') == self.vehicle_id:
                vehicle_records.append(record_data)
        
        # Sort by date (newest first)
        vehicle_records.sort(key=lambda x: x.get('fecha', ''), reverse=True)
        recent_records = vehicle_records[:10]  # Last 10 records
        
        records_table.setRowCount(len(recent_records))
        for row, record in enumerate(recent_records):
            records_table.setItem(row, 0, QTableWidgetItem(record.get('fecha', '')))
            records_table.setItem(row, 1, QTableWidgetItem(format_currency(record.get('monto', 0))))
            
            liters = record.get('litros')
            records_table.setItem(row, 2, QTableWidgetItem(f"{liters:.2f} L" if liters else "N/A"))
            
            km = record.get('kilometraje')
            records_table.setItem(row, 3, QTableWidgetItem(f"{km} km" if km else "N/A"))
        
        records_table.resizeColumnsToContents()
        layout.addWidget(records_table)
        
        # Close button
        close_btn = QPushButton("Cerrar")
        close_btn.clicked.connect(self.accept)
        layout.addWidget(close_btn)
        
    def calculate_stats(self):
        """Calculate vehicle statistics."""
        fuel_records = db.get_all_records('combustible_vehiculos')
        vehicle_records = []
        
        for record in fuel_records.values():
            if record.get('vehiculo_id') == self.vehicle_id:
                vehicle_records.append(record)
        
        now = datetime.now()
        current_month = now.strftime('%Y-%m')
        
        # Calculate statistics
        stats = {
            'current_month_fuel': 0,
            'current_month_records': 0,
            'quarter_fuel': 0,
            'quarter_avg': 0,
            'total_fuel': 0,
            'total_records': len(vehicle_records),
            'avg_consumption': 0
        }
        
        quarter_months = []
        for i in range(3):
            month_date = now - timedelta(days=30*i)
            quarter_months.append(month_date.strftime('%Y-%m'))
        
        total_liters = 0
        liters_count = 0
        
        for record in vehicle_records:
            monto = record.get('monto', 0)
            fecha = record.get('fecha', '')
            liters = record.get('litros')
            
            stats['total_fuel'] += monto
            
            if fecha.startswith(current_month):
                stats['current_month_fuel'] += monto
                stats['current_month_records'] += 1
            
            if any(fecha.startswith(month) for month in quarter_months):
                stats['quarter_fuel'] += monto
            
            if liters:
                total_liters += liters
                liters_count += 1
        
        if stats['quarter_fuel'] > 0:
            stats['quarter_avg'] = stats['quarter_fuel'] / 3
            
        if liters_count > 0:
            stats['avg_consumption'] = total_liters / liters_count
        
        return stats