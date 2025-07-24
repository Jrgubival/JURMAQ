from PyQt5.QtWidgets import (QWidget, QVBoxLayout, QHBoxLayout, QLabel, 
                             QTableWidget, QTableWidgetItem, QPushButton,
                             QDialog, QFormLayout, QLineEdit, QComboBox,
                             QDateEdit, QDoubleSpinBox, QTextEdit, QMessageBox,
                             QFrame, QTabWidget, QSpinBox, QHeaderView, QAbstractItemView,
                             QCheckBox, QGroupBox, QGridLayout, QFileDialog, QProgressBar)
from PyQt5.QtCore import Qt, QDate, QThread, pyqtSignal
from PyQt5.QtGui import QFont
from datetime import datetime, timedelta
import calendar

from .utils import db, generate_id, format_currency, calculate_payroll
from .logs import LogManager
from .login import login_manager

class PersonalWidget(QWidget):
    """Widget for managing personnel, attendance, payroll, and vacations."""
    
    def __init__(self):
        super().__init__()
        self.setup_ui()
        self.load_data()
        
    def setup_ui(self):
        """Setup user interface."""
        main_layout = QVBoxLayout(self)
        
        # Tab widget for different personnel functions
        self.tab_widget = QTabWidget()
        
        # Employees tab
        self.employees_tab = self.create_employees_tab()
        self.tab_widget.addTab(self.employees_tab, "👥 Empleados")
        
        # Attendance tab
        self.attendance_tab = self.create_attendance_tab()
        self.tab_widget.addTab(self.attendance_tab, "📅 Asistencia")
        
        # Payroll tab
        self.payroll_tab = self.create_payroll_tab()
        self.tab_widget.addTab(self.payroll_tab, "💰 Remuneraciones")
        
        # Vacations tab
        self.vacations_tab = self.create_vacations_tab()
        self.tab_widget.addTab(self.vacations_tab, "🏖️ Vacaciones")
        
        main_layout.addWidget(self.tab_widget)
        
    def create_employees_tab(self):
        """Create employees management tab."""
        widget = QWidget()
        layout = QVBoxLayout(widget)
        
        # Header
        header_frame = QFrame()
        header_layout = QHBoxLayout(header_frame)
        
        title_label = QLabel("Gestión de Empleados")
        title_label.setStyleSheet("font-size: 18px; font-weight: bold; color: #2c3e50;")
        header_layout.addWidget(title_label)
        
        header_layout.addStretch()
        
        # Action buttons
        self.new_employee_btn = QPushButton("Nuevo Empleado")
        self.new_employee_btn.clicked.connect(self.new_employee)
        header_layout.addWidget(self.new_employee_btn)
        
        self.edit_employee_btn = QPushButton("Editar")
        self.edit_employee_btn.clicked.connect(self.edit_employee)
        self.edit_employee_btn.setEnabled(False)
        header_layout.addWidget(self.edit_employee_btn)
        
        self.delete_employee_btn = QPushButton("Eliminar")
        self.delete_employee_btn.clicked.connect(self.delete_employee)
        self.delete_employee_btn.setEnabled(False)
        self.delete_employee_btn.setStyleSheet("background-color: #e74c3c;")
        header_layout.addWidget(self.delete_employee_btn)
        
        layout.addWidget(header_frame)
        
        # Filters
        filter_frame = QFrame()
        filter_layout = QHBoxLayout(filter_frame)
        
        filter_layout.addWidget(QLabel("Estado:"))
        self.employee_status_filter = QComboBox()
        self.employee_status_filter.addItems(["Todos", "Activo", "Inactivo"])
        self.employee_status_filter.currentTextChanged.connect(self.load_employees)
        filter_layout.addWidget(self.employee_status_filter)
        
        filter_layout.addStretch()
        
        layout.addWidget(filter_frame)
        
        # Employees table
        self.employees_table = QTableWidget()
        self.employees_table.setColumnCount(7)
        self.employees_table.setHorizontalHeaderLabels([
            "RUT", "Nombre", "Cargo", "Sueldo Base", "Fecha Ingreso", "Estado", "Vacaciones Disponibles"
        ])
        
        # Configure table
        header = self.employees_table.horizontalHeader()
        header.setStretchLastSection(True)
        self.employees_table.setSelectionBehavior(QAbstractItemView.SelectRows)
        self.employees_table.setAlternatingRowColors(True)
        
        # Connect selection
        self.employees_table.itemSelectionChanged.connect(self.on_employee_selection_changed)
        
        layout.addWidget(self.employees_table)
        
        return widget
        
    def create_attendance_tab(self):
        """Create attendance management tab."""
        widget = QWidget()
        layout = QVBoxLayout(widget)
        
        # Header
        header_frame = QFrame()
        header_layout = QHBoxLayout(header_frame)
        
        title_label = QLabel("Control de Asistencia")
        title_label.setStyleSheet("font-size: 18px; font-weight: bold; color: #2c3e50;")
        header_layout.addWidget(title_label)
        
        header_layout.addStretch()
        
        # Period selection
        period_layout = QHBoxLayout()
        period_layout.addWidget(QLabel("Período:"))
        
        self.attendance_month = QComboBox()
        self.attendance_month.addItems([f"{i:02d}" for i in range(1, 13)])
        self.attendance_month.setCurrentText(f"{datetime.now().month:02d}")
        period_layout.addWidget(self.attendance_month)
        
        self.attendance_year = QComboBox()
        current_year = datetime.now().year
        self.attendance_year.addItems([str(year) for year in range(current_year - 2, current_year + 1)])
        self.attendance_year.setCurrentText(str(current_year))
        period_layout.addWidget(self.attendance_year)
        
        header_layout.addLayout(period_layout)
        
        # Action buttons
        self.load_attendance_btn = QPushButton("Cargar Asistencia")
        self.load_attendance_btn.clicked.connect(self.load_attendance)
        header_layout.addWidget(self.load_attendance_btn)
        
        self.bulk_load_btn = QPushButton("Carga Masiva")
        self.bulk_load_btn.clicked.connect(self.bulk_load_attendance)
        self.bulk_load_btn.setStyleSheet("background-color: #f39c12;")
        header_layout.addWidget(self.bulk_load_btn)
        
        self.mark_attendance_btn = QPushButton("Marcar Asistencia")
        self.mark_attendance_btn.clicked.connect(self.mark_attendance)
        self.mark_attendance_btn.setEnabled(False)
        header_layout.addWidget(self.mark_attendance_btn)
        
        layout.addWidget(header_frame)
        
        # Attendance table
        self.attendance_table = QTableWidget()
        self.attendance_table.setColumnCount(6)
        self.attendance_table.setHorizontalHeaderLabels([
            "Empleado", "Días Trabajados", "Días Faltantes", "Asistencia %", "Horas Extras", "Observaciones"
        ])
        
        # Configure table
        header = self.attendance_table.horizontalHeader()
        header.setStretchLastSection(True)
        self.attendance_table.setSelectionBehavior(QAbstractItemView.SelectRows)
        self.attendance_table.itemSelectionChanged.connect(self.on_attendance_selection_changed)
        
        layout.addWidget(self.attendance_table)
        
        return widget
        
    def create_payroll_tab(self):
        """Create payroll management tab."""
        widget = QWidget()
        layout = QVBoxLayout(widget)
        
        # Header
        header_frame = QFrame()
        header_layout = QHBoxLayout(header_frame)
        
        title_label = QLabel("Remuneraciones")
        title_label.setStyleSheet("font-size: 18px; font-weight: bold; color: #2c3e50;")
        header_layout.addWidget(title_label)
        
        header_layout.addStretch()
        
        # Period selection
        period_layout = QHBoxLayout()
        period_layout.addWidget(QLabel("Período:"))
        
        self.payroll_month = QComboBox()
        self.payroll_month.addItems([f"{i:02d}" for i in range(1, 13)])
        self.payroll_month.setCurrentText(f"{datetime.now().month:02d}")
        period_layout.addWidget(self.payroll_month)
        
        self.payroll_year = QComboBox()
        current_year = datetime.now().year
        self.payroll_year.addItems([str(year) for year in range(current_year - 2, current_year + 1)])
        self.payroll_year.setCurrentText(str(current_year))
        period_layout.addWidget(self.payroll_year)
        
        header_layout.addLayout(period_layout)
        
        # Action buttons
        self.calculate_payroll_btn = QPushButton("Calcular Nómina")
        self.calculate_payroll_btn.clicked.connect(self.calculate_payroll)
        self.calculate_payroll_btn.setStyleSheet("background-color: #27ae60;")
        header_layout.addWidget(self.calculate_payroll_btn)
        
        self.generate_payroll_pdf_btn = QPushButton("Generar PDFs")
        self.generate_payroll_pdf_btn.clicked.connect(self.generate_payroll_pdfs)
        self.generate_payroll_pdf_btn.setEnabled(False)
        self.generate_payroll_pdf_btn.setStyleSheet("background-color: #3498db;")
        header_layout.addWidget(self.generate_payroll_pdf_btn)
        
        layout.addWidget(header_frame)
        
        # Payroll table
        self.payroll_table = QTableWidget()
        self.payroll_table.setColumnCount(7)
        self.payroll_table.setHorizontalHeaderLabels([
            "Empleado", "Sueldo Base", "Días Trabajados", "Bonos", "Descuentos", "Sueldo Líquido", "Estado"
        ])
        
        # Configure table
        header = self.payroll_table.horizontalHeader()
        header.setStretchLastSection(True)
        self.payroll_table.setSelectionBehavior(QAbstractItemView.SelectRows)
        
        layout.addWidget(self.payroll_table)
        
        return widget
        
    def create_vacations_tab(self):
        """Create vacations management tab."""
        widget = QWidget()
        layout = QVBoxLayout(widget)
        
        # Header
        header_frame = QFrame()
        header_layout = QHBoxLayout(header_frame)
        
        title_label = QLabel("Control de Vacaciones")
        title_label.setStyleSheet("font-size: 18px; font-weight: bold; color: #2c3e50;")
        header_layout.addWidget(title_label)
        
        header_layout.addStretch()
        
        # Action buttons
        self.new_vacation_btn = QPushButton("Nueva Solicitud")
        self.new_vacation_btn.clicked.connect(self.new_vacation)
        header_layout.addWidget(self.new_vacation_btn)
        
        self.approve_vacation_btn = QPushButton("Aprobar")
        self.approve_vacation_btn.clicked.connect(self.approve_vacation)
        self.approve_vacation_btn.setEnabled(False)
        self.approve_vacation_btn.setStyleSheet("background-color: #27ae60;")
        header_layout.addWidget(self.approve_vacation_btn)
        
        self.reject_vacation_btn = QPushButton("Rechazar")
        self.reject_vacation_btn.clicked.connect(self.reject_vacation)
        self.reject_vacation_btn.setEnabled(False)
        self.reject_vacation_btn.setStyleSheet("background-color: #e74c3c;")
        header_layout.addWidget(self.reject_vacation_btn)
        
        layout.addWidget(header_frame)
        
        # Filters
        filter_frame = QFrame()
        filter_layout = QHBoxLayout(filter_frame)
        
        filter_layout.addWidget(QLabel("Estado:"))
        self.vacation_status_filter = QComboBox()
        self.vacation_status_filter.addItems(["Todos", "Pendiente", "Aprobada", "Rechazada", "Tomada"])
        self.vacation_status_filter.currentTextChanged.connect(self.load_vacations)
        filter_layout.addWidget(self.vacation_status_filter)
        
        filter_layout.addStretch()
        
        layout.addWidget(filter_frame)
        
        # Vacations table
        self.vacations_table = QTableWidget()
        self.vacations_table.setColumnCount(7)
        self.vacations_table.setHorizontalHeaderLabels([
            "Empleado", "Fecha Inicio", "Fecha Fin", "Días", "Estado", "Solicitud", "Aprobación"
        ])
        
        # Configure table
        header = self.vacations_table.horizontalHeader()
        header.setStretchLastSection(True)
        self.vacations_table.setSelectionBehavior(QAbstractItemView.SelectRows)
        self.vacations_table.itemSelectionChanged.connect(self.on_vacation_selection_changed)
        
        layout.addWidget(self.vacations_table)
        
        return widget
        
    def load_data(self):
        """Load all personnel data."""
        self.load_employees()
        self.load_attendance()
        self.load_payroll()
        self.load_vacations()
        
    def load_employees(self):
        """Load employees data."""
        status_filter = self.employee_status_filter.currentText()
        employees = db.get_all_records('empleados')
        
        filtered_employees = {}
        for emp_id, emp_data in employees.items():
            if status_filter != "Todos":
                is_active = emp_data.get('activo', True)
                if status_filter == "Activo" and not is_active:
                    continue
                elif status_filter == "Inactivo" and is_active:
                    continue
            filtered_employees[emp_id] = emp_data
        
        self.employees_table.setRowCount(len(filtered_employees))
        
        for row, (emp_id, emp_data) in enumerate(filtered_employees.items()):
            self.employees_table.setItem(row, 0, QTableWidgetItem(emp_data.get('rut', '')))
            self.employees_table.setItem(row, 1, QTableWidgetItem(emp_data.get('nombre', '')))
            self.employees_table.setItem(row, 2, QTableWidgetItem(emp_data.get('cargo', '')))
            self.employees_table.setItem(row, 3, QTableWidgetItem(format_currency(emp_data.get('sueldo_base', 0))))
            self.employees_table.setItem(row, 4, QTableWidgetItem(emp_data.get('fecha_ingreso', '')))
            
            estado = "Activo" if emp_data.get('activo', True) else "Inactivo"
            self.employees_table.setItem(row, 5, QTableWidgetItem(estado))
            
            vacation_days = emp_data.get('dias_vacaciones_disponibles', 15)
            self.employees_table.setItem(row, 6, QTableWidgetItem(f"{vacation_days} días"))
            
    def load_attendance(self):
        """Load attendance data for selected period."""
        month = int(self.attendance_month.currentText())
        year = int(self.attendance_year.currentText())
        period = f"{year}-{month:02d}"
        
        employees = db.get_all_records('empleados')
        attendance_records = db.get_all_records('asistencia')
        
        # Filter attendance for the period
        period_attendance = {}
        for record_id, record_data in attendance_records.items():
            if record_data.get('periodo', '').startswith(period):
                emp_id = record_data.get('empleado_id')
                if emp_id:
                    period_attendance[emp_id] = record_data
        
        # Get days in month
        days_in_month = calendar.monthrange(year, month)[1]
        
        active_employees = {k: v for k, v in employees.items() if v.get('activo', True)}
        self.attendance_table.setRowCount(len(active_employees))
        
        for row, (emp_id, emp_data) in enumerate(active_employees.items()):
            attendance = period_attendance.get(emp_id, {})
            
            days_worked = attendance.get('dias_trabajados', 0)
            days_absent = days_in_month - days_worked
            attendance_pct = (days_worked / days_in_month) * 100 if days_in_month > 0 else 0
            
            self.attendance_table.setItem(row, 0, QTableWidgetItem(emp_data.get('nombre', '')))
            self.attendance_table.setItem(row, 1, QTableWidgetItem(str(days_worked)))
            self.attendance_table.setItem(row, 2, QTableWidgetItem(str(days_absent)))
            self.attendance_table.setItem(row, 3, QTableWidgetItem(f"{attendance_pct:.1f}%"))
            self.attendance_table.setItem(row, 4, QTableWidgetItem(str(attendance.get('horas_extras', 0))))
            self.attendance_table.setItem(row, 5, QTableWidgetItem(attendance.get('observaciones', '')))
            
    def load_payroll(self):
        """Load payroll data for selected period."""
        month = int(self.payroll_month.currentText())
        year = int(self.payroll_year.currentText())
        period = f"{year}-{month:02d}"
        
        payroll_records = db.get_all_records('nomina')
        period_payroll = {}
        
        for record_id, record_data in payroll_records.items():
            if record_data.get('periodo', '') == period:
                emp_id = record_data.get('empleado_id')
                if emp_id:
                    period_payroll[emp_id] = record_data
        
        self.payroll_table.setRowCount(len(period_payroll))
        has_payroll = len(period_payroll) > 0
        self.generate_payroll_pdf_btn.setEnabled(has_payroll)
        
        for row, (emp_id, payroll_data) in enumerate(period_payroll.items()):
            self.payroll_table.setItem(row, 0, QTableWidgetItem(payroll_data.get('empleado_nombre', '')))
            self.payroll_table.setItem(row, 1, QTableWidgetItem(format_currency(payroll_data.get('sueldo_base', 0))))
            self.payroll_table.setItem(row, 2, QTableWidgetItem(str(payroll_data.get('dias_trabajados', 0))))
            self.payroll_table.setItem(row, 3, QTableWidgetItem(format_currency(payroll_data.get('bonos', 0))))
            self.payroll_table.setItem(row, 4, QTableWidgetItem(format_currency(payroll_data.get('total_descuentos', 0))))
            self.payroll_table.setItem(row, 5, QTableWidgetItem(format_currency(payroll_data.get('sueldo_liquido', 0))))
            self.payroll_table.setItem(row, 6, QTableWidgetItem(payroll_data.get('estado', 'Calculado')))
            
    def load_vacations(self):
        """Load vacations data."""
        status_filter = self.vacation_status_filter.currentText()
        vacations = db.get_all_records('vacaciones')
        
        filtered_vacations = {}
        for vac_id, vac_data in vacations.items():
            if status_filter != "Todos":
                if vac_data.get('estado', '').lower() != status_filter.lower():
                    continue
            filtered_vacations[vac_id] = vac_data
        
        self.vacations_table.setRowCount(len(filtered_vacations))
        
        for row, (vac_id, vac_data) in enumerate(filtered_vacations.items()):
            self.vacations_table.setItem(row, 0, QTableWidgetItem(vac_data.get('empleado_nombre', '')))
            self.vacations_table.setItem(row, 1, QTableWidgetItem(vac_data.get('fecha_inicio', '')))
            self.vacations_table.setItem(row, 2, QTableWidgetItem(vac_data.get('fecha_fin', '')))
            self.vacations_table.setItem(row, 3, QTableWidgetItem(str(vac_data.get('dias', 0))))
            self.vacations_table.setItem(row, 4, QTableWidgetItem(vac_data.get('estado', '').title()))
            self.vacations_table.setItem(row, 5, QTableWidgetItem(vac_data.get('fecha_solicitud', '')))
            self.vacations_table.setItem(row, 6, QTableWidgetItem(vac_data.get('fecha_aprobacion', '')))
            
    # Event handlers
    def on_employee_selection_changed(self):
        """Handle employee selection change."""
        has_selection = len(self.employees_table.selectedItems()) > 0
        self.edit_employee_btn.setEnabled(has_selection)
        self.delete_employee_btn.setEnabled(has_selection)
        
    def on_attendance_selection_changed(self):
        """Handle attendance selection change."""
        has_selection = len(self.attendance_table.selectedItems()) > 0
        self.mark_attendance_btn.setEnabled(has_selection)
        
    def on_vacation_selection_changed(self):
        """Handle vacation selection change."""
        has_selection = len(self.vacations_table.selectedItems()) > 0
        self.approve_vacation_btn.setEnabled(has_selection)
        self.reject_vacation_btn.setEnabled(has_selection)
        
    # Action methods
    def new_employee(self):
        """Create new employee."""
        dialog = EmployeeDialog()
        if dialog.exec_() == QDialog.Accepted:
            self.load_employees()
            
    def edit_employee(self):
        """Edit selected employee."""
        current_row = self.employees_table.currentRow()
        if current_row >= 0:
            rut = self.employees_table.item(current_row, 0).text()
            # Find employee by RUT
            employees = db.get_all_records('empleados')
            emp_id = None
            emp_data = None
            
            for e_id, e_data in employees.items():
                if e_data.get('rut') == rut:
                    emp_id = e_id
                    emp_data = e_data
                    break
                    
            if emp_data:
                dialog = EmployeeDialog(employee_data=emp_data, employee_id=emp_id)
                if dialog.exec_() == QDialog.Accepted:
                    self.load_employees()
                    
    def delete_employee(self):
        """Delete selected employee."""
        current_row = self.employees_table.currentRow()
        if current_row >= 0:
            rut = self.employees_table.item(current_row, 0).text()
            name = self.employees_table.item(current_row, 1).text()
            
            reply = QMessageBox.question(
                self, 'Confirmar Eliminación',
                f'¿Está seguro que desea eliminar al empleado {name} (RUT: {rut})?',
                QMessageBox.Yes | QMessageBox.No
            )
            
            if reply == QMessageBox.Yes:
                # Find and delete employee
                employees = db.get_all_records('empleados')
                for emp_id, emp_data in employees.items():
                    if emp_data.get('rut') == rut:
                        db.delete_record('empleados', emp_id)
                        
                        user = login_manager.get_current_user()
                        LogManager.log_delete(user['username'], 'PERSONAL', 'EMPLEADO', emp_id)
                        
                        QMessageBox.information(self, 'Éxito', 'Empleado eliminado correctamente')
                        self.load_employees()
                        break
                        
    def bulk_load_attendance(self):
        """Load attendance data from file."""
        dialog = BulkAttendanceDialog()
        if dialog.exec_() == QDialog.Accepted:
            self.load_attendance()
            
    def mark_attendance(self):
        """Mark attendance for selected employee."""
        current_row = self.attendance_table.currentRow()
        if current_row >= 0:
            employee_name = self.attendance_table.item(current_row, 0).text()
            
            # Find employee
            employees = db.get_all_records('empleados')
            emp_id = None
            for e_id, e_data in employees.items():
                if e_data.get('nombre') == employee_name:
                    emp_id = e_id
                    break
                    
            if emp_id:
                month = int(self.attendance_month.currentText())
                year = int(self.attendance_year.currentText())
                dialog = AttendanceDialog(emp_id, month, year)
                if dialog.exec_() == QDialog.Accepted:
                    self.load_attendance()
                    
    def calculate_payroll(self):
        """Calculate payroll for selected period."""
        month = int(self.payroll_month.currentText())
        year = int(self.payroll_year.currentText())
        period = f"{year}-{month:02d}"
        
        # Get employees and attendance data
        employees = db.get_all_records('empleados')
        attendance_records = db.get_all_records('asistencia')
        
        calculated_count = 0
        
        for emp_id, emp_data in employees.items():
            if not emp_data.get('activo', True):
                continue
                
            # Find attendance record for this period
            attendance = None
            for att_id, att_data in attendance_records.items():
                if (att_data.get('empleado_id') == emp_id and 
                    att_data.get('periodo', '').startswith(period)):
                    attendance = att_data
                    break
            
            if not attendance:
                continue
                
            # Calculate payroll
            sueldo_base = emp_data.get('sueldo_base', 0)
            dias_trabajados = attendance.get('dias_trabajados', 0)
            
            # Calculate final salary (sueldo_bruto / 30 * dias_trabajados)
            sueldo_proporcional = calculate_payroll(sueldo_base, dias_trabajados, 30)
            
            # Bonuses (if any)
            bonos = attendance.get('horas_extras', 0) * 5000  # $5,000 per extra hour
            
            # Deductions (simplified)
            descuentos_previsionales = sueldo_proporcional * 0.12  # 12% AFP + Salud
            descuentos_otros = 0
            total_descuentos = descuentos_previsionales + descuentos_otros
            
            # Net salary
            sueldo_liquido = sueldo_proporcional + bonos - total_descuentos
            
            payroll_data = {
                'empleado_id': emp_id,
                'empleado_nombre': emp_data.get('nombre', ''),
                'empleado_rut': emp_data.get('rut', ''),
                'cargo': emp_data.get('cargo', ''),
                'periodo': period,
                'sueldo_base': sueldo_base,
                'dias_trabajados': dias_trabajados,
                'sueldo_proporcional': sueldo_proporcional,
                'bonos': bonos,
                'total_haberes': sueldo_proporcional + bonos,
                'descuentos_previsionales': descuentos_previsionales,
                'descuentos_otros': descuentos_otros,
                'total_descuentos': total_descuentos,
                'sueldo_liquido': sueldo_liquido,
                'estado': 'calculado'
            }
            
            # Save payroll record
            payroll_id = f"{emp_id}_{period}"
            db.add_record('nomina', payroll_id, payroll_data)
            calculated_count += 1
        
        user = login_manager.get_current_user()
        LogManager.log_action(user['username'], 'PAYROLL_CALCULATED', 'PERSONAL', 
                            {'period': period, 'employees': calculated_count})
        
        QMessageBox.information(self, 'Éxito', 
                              f'Nómina calculada para {calculated_count} empleados en el período {period}')
        self.load_payroll()
        
    def generate_payroll_pdfs(self):
        """Generate payroll PDFs for all employees."""
        month = int(self.payroll_month.currentText())
        year = int(self.payroll_year.currentText())
        period = f"{year}-{month:02d}"
        
        payroll_records = db.get_all_records('nomina')
        period_payroll = []
        
        for record_id, record_data in payroll_records.items():
            if record_data.get('periodo', '') == period:
                period_payroll.append((record_data.get('empleado_id'), record_data))
        
        if not period_payroll:
            QMessageBox.warning(self, 'Error', 'No hay registros de nómina para este período')
            return
            
        try:
            from .pdf_generator import generate_payroll_pdf
            generated_count = 0
            
            for emp_id, payroll_data in period_payroll:
                pdf_path = generate_payroll_pdf(emp_id, payroll_data)
                generated_count += 1
            
            user = login_manager.get_current_user()
            LogManager.log_action(user['username'], 'PAYROLL_PDFS_GENERATED', 'PERSONAL', 
                                {'period': period, 'count': generated_count})
            
            QMessageBox.information(self, 'Éxito', 
                                  f'Se generaron {generated_count} liquidaciones de sueldo')
                                  
        except Exception as e:
            QMessageBox.critical(self, 'Error', f'Error al generar PDFs: {str(e)}')
            
    def new_vacation(self):
        """Create new vacation request."""
        dialog = VacationDialog()
        if dialog.exec_() == QDialog.Accepted:
            self.load_vacations()
            self.load_employees()  # Update vacation days
            
    def approve_vacation(self):
        """Approve selected vacation."""
        self._process_vacation('aprobada')
        
    def reject_vacation(self):
        """Reject selected vacation."""
        self._process_vacation('rechazada')
        
    def _process_vacation(self, new_status):
        """Process vacation approval/rejection."""
        current_row = self.vacations_table.currentRow()
        if current_row >= 0:
            employee_name = self.vacations_table.item(current_row, 0).text()
            start_date = self.vacations_table.item(current_row, 1).text()
            
            # Find vacation record
            vacations = db.get_all_records('vacaciones')
            vac_id = None
            vac_data = None
            
            for v_id, v_data in vacations.items():
                if (v_data.get('empleado_nombre') == employee_name and 
                    v_data.get('fecha_inicio') == start_date):
                    vac_id = v_id
                    vac_data = v_data
                    break
                    
            if vac_data:
                # Update vacation status
                update_data = {
                    'estado': new_status,
                    'fecha_aprobacion': datetime.now().strftime('%Y-%m-%d')
                }
                
                # If approved, deduct vacation days from employee
                if new_status == 'aprobada':
                    emp_id = vac_data.get('empleado_id')
                    if emp_id:
                        employee = db.get_record('empleados', emp_id)
                        if employee:
                            current_days = employee.get('dias_vacaciones_disponibles', 15)
                            vacation_days = vac_data.get('dias', 0)
                            new_days = max(0, current_days - vacation_days)
                            
                            db.update_record('empleados', emp_id, 
                                           {'dias_vacaciones_disponibles': new_days})
                
                db.update_record('vacaciones', vac_id, update_data)
                
                user = login_manager.get_current_user()
                LogManager.log_action(user['username'], f'VACATION_{new_status.upper()}', 'PERSONAL', 
                                    {'vacation_id': vac_id, 'employee': employee_name})
                
                QMessageBox.information(self, 'Éxito', 
                                      f'Vacación {new_status} correctamente')
                self.load_vacations()
                self.load_employees()

# Dialog classes for personnel management

class EmployeeDialog(QDialog):
    """Dialog for creating/editing employees."""
    
    def __init__(self, employee_data=None, employee_id=None):
        super().__init__()
        self.employee_data = employee_data
        self.employee_id = employee_id
        self.is_edit_mode = employee_data is not None
        
        title = "Editar Empleado" if self.is_edit_mode else "Nuevo Empleado"
        self.setWindowTitle(title)
        self.setModal(True)
        self.resize(500, 600)
        self.setup_ui()
        
        if self.is_edit_mode:
            self.load_employee_data()
            
    def setup_ui(self):
        """Setup dialog user interface."""
        layout = QVBoxLayout(self)
        
        # Tab widget
        tab_widget = QTabWidget()
        
        # Personal information tab
        personal_tab = QWidget()
        personal_layout = QFormLayout(personal_tab)
        
        self.rut_edit = QLineEdit()
        self.rut_edit.setPlaceholderText("12.345.678-9")
        personal_layout.addRow("RUT:", self.rut_edit)
        
        self.name_edit = QLineEdit()
        personal_layout.addRow("Nombre Completo:", self.name_edit)
        
        self.position_edit = QLineEdit()
        personal_layout.addRow("Cargo:", self.position_edit)
        
        self.phone_edit = QLineEdit()
        personal_layout.addRow("Teléfono:", self.phone_edit)
        
        self.email_edit = QLineEdit()
        personal_layout.addRow("Email:", self.email_edit)
        
        self.address_edit = QTextEdit()
        self.address_edit.setMaximumHeight(60)
        personal_layout.addRow("Dirección:", self.address_edit)
        
        tab_widget.addTab(personal_tab, "Información Personal")
        
        # Employment information tab
        employment_tab = QWidget()
        employment_layout = QFormLayout(employment_tab)
        
        self.start_date_edit = QDateEdit()
        self.start_date_edit.setDate(QDate.currentDate())
        self.start_date_edit.setCalendarPopup(True)
        employment_layout.addRow("Fecha Ingreso:", self.start_date_edit)
        
        self.salary_spin = QDoubleSpinBox()
        self.salary_spin.setRange(0, 9999999)
        self.salary_spin.setDecimals(0)
        self.salary_spin.setSuffix(" pesos")
        employment_layout.addRow("Sueldo Base:", self.salary_spin)
        
        self.vacation_days_spin = QSpinBox()
        self.vacation_days_spin.setRange(0, 30)
        self.vacation_days_spin.setValue(15)
        employment_layout.addRow("Días Vacaciones:", self.vacation_days_spin)
        
        self.active_check = QCheckBox()
        self.active_check.setChecked(True)
        employment_layout.addRow("Activo:", self.active_check)
        
        tab_widget.addTab(employment_tab, "Información Laboral")
        
        layout.addWidget(tab_widget)
        
        # Buttons
        button_frame = QFrame()
        button_layout = QHBoxLayout(button_frame)
        
        button_layout.addStretch()
        
        cancel_btn = QPushButton("Cancelar")
        cancel_btn.clicked.connect(self.reject)
        button_layout.addWidget(cancel_btn)
        
        save_btn = QPushButton("Guardar")
        save_btn.clicked.connect(self.save_employee)
        save_btn.setStyleSheet("background-color: #27ae60;")
        button_layout.addWidget(save_btn)
        
        layout.addWidget(button_frame)
        
    def load_employee_data(self):
        """Load employee data for editing."""
        if not self.employee_data:
            return
            
        self.rut_edit.setText(self.employee_data.get('rut', ''))
        self.name_edit.setText(self.employee_data.get('nombre', ''))
        self.position_edit.setText(self.employee_data.get('cargo', ''))
        self.phone_edit.setText(self.employee_data.get('telefono', ''))
        self.email_edit.setText(self.employee_data.get('email', ''))
        self.address_edit.setPlainText(self.employee_data.get('direccion', ''))
        
        # Employment data
        start_date_str = self.employee_data.get('fecha_ingreso', '')
        if start_date_str:
            try:
                date_obj = datetime.strptime(start_date_str, '%Y-%m-%d').date()
                self.start_date_edit.setDate(QDate(date_obj))
            except ValueError:
                pass
                
        self.salary_spin.setValue(self.employee_data.get('sueldo_base', 0))
        self.vacation_days_spin.setValue(self.employee_data.get('dias_vacaciones_disponibles', 15))
        self.active_check.setChecked(self.employee_data.get('activo', True))
        
    def save_employee(self):
        """Save employee data."""
        if not self.validate_form():
            return
            
        employee_data = {
            'rut': self.rut_edit.text(),
            'nombre': self.name_edit.text(),
            'cargo': self.position_edit.text(),
            'telefono': self.phone_edit.text(),
            'email': self.email_edit.text(),
            'direccion': self.address_edit.toPlainText(),
            'fecha_ingreso': self.start_date_edit.date().toString('yyyy-MM-dd'),
            'sueldo_base': self.salary_spin.value(),
            'dias_vacaciones_disponibles': self.vacation_days_spin.value(),
            'activo': self.active_check.isChecked()
        }
        
        user = login_manager.get_current_user()
        
        if self.is_edit_mode:
            db.update_record('empleados', self.employee_id, employee_data)
            LogManager.log_update(user['username'], 'PERSONAL', 'EMPLEADO', self.employee_id, employee_data)
        else:
            employee_id = generate_id('EMP')
            db.add_record('empleados', employee_id, employee_data)
            LogManager.log_create(user['username'], 'PERSONAL', 'EMPLEADO', employee_id, employee_data)
            
        self.accept()
        
    def validate_form(self):
        """Validate form data."""
        if not self.rut_edit.text().strip():
            QMessageBox.warning(self, 'Error de Validación', 'El RUT es obligatorio')
            return False
            
        if not self.name_edit.text().strip():
            QMessageBox.warning(self, 'Error de Validación', 'El nombre es obligatorio')
            return False
            
        if self.salary_spin.value() <= 0:
            QMessageBox.warning(self, 'Error de Validación', 'El sueldo debe ser mayor a 0')
            return False
            
        return True

class BulkAttendanceDialog(QDialog):
    """Dialog for bulk loading attendance data."""
    
    def __init__(self):
        super().__init__()
        self.setWindowTitle("Carga Masiva de Asistencia")
        self.setModal(True)
        self.resize(600, 400)
        self.setup_ui()
        
    def setup_ui(self):
        """Setup dialog user interface."""
        layout = QVBoxLayout(self)
        
        # Instructions
        instructions = QLabel("""
        <b>Instrucciones para carga masiva:</b><br>
        1. Seleccione el período (mes/año)<br>
        2. Ingrese los datos de asistencia en el formato: RUT,Días_Trabajados,Horas_Extras<br>
        3. Un empleado por línea<br>
        <br>
        <b>Ejemplo:</b><br>
        12345678-9,22,5<br>
        98765432-1,20,0<br>
        """)
        instructions.setStyleSheet("background-color: #ecf0f1; padding: 10px; border-radius: 5px;")
        layout.addWidget(instructions)
        
        # Period selection
        period_frame = QFrame()
        period_layout = QHBoxLayout(period_frame)
        
        period_layout.addWidget(QLabel("Período:"))
        
        self.month_combo = QComboBox()
        self.month_combo.addItems([f"{i:02d}" for i in range(1, 13)])
        self.month_combo.setCurrentText(f"{datetime.now().month:02d}")
        period_layout.addWidget(self.month_combo)
        
        self.year_combo = QComboBox()
        current_year = datetime.now().year
        self.year_combo.addItems([str(year) for year in range(current_year - 2, current_year + 1)])
        self.year_combo.setCurrentText(str(current_year))
        period_layout.addWidget(self.year_combo)
        
        period_layout.addStretch()
        
        layout.addWidget(period_frame)
        
        # Data input
        layout.addWidget(QLabel("Datos de Asistencia:"))
        self.data_edit = QTextEdit()
        self.data_edit.setPlaceholderText("RUT,Días_Trabajados,Horas_Extras\n12345678-9,22,5\n98765432-1,20,0")
        layout.addWidget(self.data_edit)
        
        # Progress bar
        self.progress_bar = QProgressBar()
        self.progress_bar.setVisible(False)
        layout.addWidget(self.progress_bar)
        
        # Buttons
        button_frame = QFrame()
        button_layout = QHBoxLayout(button_frame)
        
        button_layout.addStretch()
        
        cancel_btn = QPushButton("Cancelar")
        cancel_btn.clicked.connect(self.reject)
        button_layout.addWidget(cancel_btn)
        
        self.process_btn = QPushButton("Procesar")
        self.process_btn.clicked.connect(self.process_data)
        self.process_btn.setStyleSheet("background-color: #27ae60;")
        button_layout.addWidget(self.process_btn)
        
        layout.addWidget(button_frame)
        
    def process_data(self):
        """Process bulk attendance data."""
        data_text = self.data_edit.toPlainText().strip()
        if not data_text:
            QMessageBox.warning(self, 'Error', 'No hay datos para procesar')
            return
            
        month = int(self.month_combo.currentText())
        year = int(self.year_combo.currentText())
        period = f"{year}-{month:02d}"
        
        lines = [line.strip() for line in data_text.split('\n') if line.strip()]
        
        self.progress_bar.setVisible(True)
        self.progress_bar.setRange(0, len(lines))
        
        processed_count = 0
        error_count = 0
        employees = db.get_all_records('empleados')
        
        # Create RUT to employee ID mapping
        rut_to_id = {}
        for emp_id, emp_data in employees.items():
            rut_to_id[emp_data.get('rut', '')] = emp_id
        
        for i, line in enumerate(lines):
            self.progress_bar.setValue(i + 1)
            
            try:
                parts = line.split(',')
                if len(parts) < 2:
                    error_count += 1
                    continue
                    
                rut = parts[0].strip()
                days_worked = int(parts[1].strip())
                hours_extra = int(parts[2].strip()) if len(parts) > 2 else 0
                
                emp_id = rut_to_id.get(rut)
                if not emp_id:
                    error_count += 1
                    continue
                    
                emp_data = employees[emp_id]
                
                attendance_data = {
                    'empleado_id': emp_id,
                    'empleado_nombre': emp_data.get('nombre', ''),
                    'periodo': period,
                    'dias_trabajados': days_worked,
                    'horas_extras': hours_extra,
                    'observaciones': f'Cargado masivamente el {datetime.now().strftime("%d/%m/%Y")}'
                }
                
                attendance_id = f"{emp_id}_{period}"
                db.add_record('asistencia', attendance_id, attendance_data)
                processed_count += 1
                
            except Exception as e:
                error_count += 1
                continue
        
        self.progress_bar.setVisible(False)
        
        user = login_manager.get_current_user()
        LogManager.log_action(user['username'], 'BULK_ATTENDANCE_LOADED', 'PERSONAL', 
                            {'period': period, 'processed': processed_count, 'errors': error_count})
        
        QMessageBox.information(self, 'Resultado', 
                              f'Procesados: {processed_count}\nErrores: {error_count}')
        
        if processed_count > 0:
            self.accept()

class AttendanceDialog(QDialog):
    """Dialog for marking individual attendance."""
    
    def __init__(self, employee_id, month, year):
        super().__init__()
        self.employee_id = employee_id
        self.month = month
        self.year = year
        self.period = f"{year}-{month:02d}"
        
        self.setWindowTitle("Marcar Asistencia")
        self.setModal(True)
        self.resize(400, 300)
        self.setup_ui()
        self.load_existing_data()
        
    def setup_ui(self):
        """Setup dialog user interface."""
        layout = QFormLayout(self)
        
        # Employee info
        employee = db.get_record('empleados', self.employee_id)
        if employee:
            layout.addRow("Empleado:", QLabel(employee.get('nombre', '')))
            layout.addRow("Período:", QLabel(self.period))
        
        # Days worked
        self.days_worked_spin = QSpinBox()
        days_in_month = calendar.monthrange(self.year, self.month)[1]
        self.days_worked_spin.setRange(0, days_in_month)
        self.days_worked_spin.setValue(days_in_month)
        layout.addRow("Días Trabajados:", self.days_worked_spin)
        
        # Extra hours
        self.hours_extra_spin = QSpinBox()
        self.hours_extra_spin.setRange(0, 100)
        layout.addRow("Horas Extras:", self.hours_extra_spin)
        
        # Observations
        self.observations_edit = QTextEdit()
        self.observations_edit.setMaximumHeight(80)
        layout.addRow("Observaciones:", self.observations_edit)
        
        # Buttons
        button_frame = QFrame()
        button_layout = QHBoxLayout(button_frame)
        
        button_layout.addStretch()
        
        cancel_btn = QPushButton("Cancelar")
        cancel_btn.clicked.connect(self.reject)
        button_layout.addWidget(cancel_btn)
        
        save_btn = QPushButton("Guardar")
        save_btn.clicked.connect(self.save_attendance)
        save_btn.setStyleSheet("background-color: #27ae60;")
        button_layout.addWidget(save_btn)
        
        layout.addWidget(button_frame)
        
    def load_existing_data(self):
        """Load existing attendance data if available."""
        attendance_id = f"{self.employee_id}_{self.period}"
        attendance = db.get_record('asistencia', attendance_id)
        
        if attendance:
            self.days_worked_spin.setValue(attendance.get('dias_trabajados', 0))
            self.hours_extra_spin.setValue(attendance.get('horas_extras', 0))
            self.observations_edit.setPlainText(attendance.get('observaciones', ''))
        
    def save_attendance(self):
        """Save attendance data."""
        employee = db.get_record('empleados', self.employee_id)
        
        attendance_data = {
            'empleado_id': self.employee_id,
            'empleado_nombre': employee.get('nombre', '') if employee else '',
            'periodo': self.period,
            'dias_trabajados': self.days_worked_spin.value(),
            'horas_extras': self.hours_extra_spin.value(),
            'observaciones': self.observations_edit.toPlainText()
        }
        
        attendance_id = f"{self.employee_id}_{self.period}"
        db.add_record('asistencia', attendance_id, attendance_data)
        
        user = login_manager.get_current_user()
        LogManager.log_action(user['username'], 'ATTENDANCE_MARKED', 'PERSONAL', 
                            {'employee_id': self.employee_id, 'period': self.period})
        
        QMessageBox.information(self, 'Éxito', 'Asistencia registrada correctamente')
        self.accept()

class VacationDialog(QDialog):
    """Dialog for creating vacation requests."""
    
    def __init__(self):
        super().__init__()
        self.setWindowTitle("Nueva Solicitud de Vacaciones")
        self.setModal(True)
        self.resize(400, 300)
        self.setup_ui()
        
    def setup_ui(self):
        """Setup dialog user interface."""
        layout = QFormLayout(self)
        
        # Employee selection
        self.employee_combo = QComboBox()
        self.load_employees()
        layout.addRow("Empleado:", self.employee_combo)
        
        # Start date
        self.start_date_edit = QDateEdit()
        self.start_date_edit.setDate(QDate.currentDate())
        self.start_date_edit.setCalendarPopup(True)
        layout.addRow("Fecha Inicio:", self.start_date_edit)
        
        # End date
        self.end_date_edit = QDateEdit()
        self.end_date_edit.setDate(QDate.currentDate().addDays(7))
        self.end_date_edit.setCalendarPopup(True)
        layout.addRow("Fecha Fin:", self.end_date_edit)
        
        # Days (calculated automatically)
        self.days_label = QLabel("0")
        layout.addRow("Días:", self.days_label)
        
        # Connect date changes to calculate days
        self.start_date_edit.dateChanged.connect(self.calculate_days)
        self.end_date_edit.dateChanged.connect(self.calculate_days)
        
        # Reason
        self.reason_edit = QTextEdit()
        self.reason_edit.setMaximumHeight(80)
        self.reason_edit.setPlaceholderText("Motivo de las vacaciones...")
        layout.addRow("Motivo:", self.reason_edit)
        
        # Available vacation days info
        self.available_days_label = QLabel()
        layout.addRow("Días Disponibles:", self.available_days_label)
        
        # Connect employee change to update available days
        self.employee_combo.currentTextChanged.connect(self.update_available_days)
        
        # Buttons
        button_frame = QFrame()
        button_layout = QHBoxLayout(button_frame)
        
        button_layout.addStretch()
        
        cancel_btn = QPushButton("Cancelar")
        cancel_btn.clicked.connect(self.reject)
        button_layout.addWidget(cancel_btn)
        
        save_btn = QPushButton("Solicitar")
        save_btn.clicked.connect(self.save_vacation)
        save_btn.setStyleSheet("background-color: #27ae60;")
        button_layout.addWidget(save_btn)
        
        layout.addWidget(button_frame)
        
        # Initial calculations
        self.calculate_days()
        self.update_available_days()
        
    def load_employees(self):
        """Load active employees."""
        employees = db.get_all_records('empleados')
        self.employee_combo.addItem("Seleccionar empleado...", "")
        
        for emp_id, emp_data in employees.items():
            if emp_data.get('activo', True):
                display_text = f"{emp_data.get('nombre', '')} ({emp_data.get('rut', '')})"
                self.employee_combo.addItem(display_text, emp_id)
                
    def calculate_days(self):
        """Calculate vacation days."""
        start_date = self.start_date_edit.date().toPyDate()
        end_date = self.end_date_edit.date().toPyDate()
        
        if end_date > start_date:
            days = (end_date - start_date).days + 1
            self.days_label.setText(str(days))
        else:
            self.days_label.setText("0")
            
    def update_available_days(self):
        """Update available vacation days for selected employee."""
        emp_id = self.employee_combo.currentData()
        if emp_id:
            employee = db.get_record('empleados', emp_id)
            if employee:
                available_days = employee.get('dias_vacaciones_disponibles', 15)
                self.available_days_label.setText(f"{available_days} días")
            else:
                self.available_days_label.setText("0 días")
        else:
            self.available_days_label.setText("")
            
    def save_vacation(self):
        """Save vacation request."""
        if not self.validate_form():
            return
            
        emp_id = self.employee_combo.currentData()
        employee = db.get_record('empleados', emp_id)
        
        vacation_data = {
            'empleado_id': emp_id,
            'empleado_nombre': employee.get('nombre', ''),
            'fecha_inicio': self.start_date_edit.date().toString('yyyy-MM-dd'),
            'fecha_fin': self.end_date_edit.date().toString('yyyy-MM-dd'),
            'dias': int(self.days_label.text()),
            'motivo': self.reason_edit.toPlainText(),
            'estado': 'pendiente',
            'fecha_solicitud': datetime.now().strftime('%Y-%m-%d')
        }
        
        vacation_id = generate_id('VAC')
        db.add_record('vacaciones', vacation_id, vacation_data)
        
        user = login_manager.get_current_user()
        LogManager.log_create(user['username'], 'PERSONAL', 'VACACION', vacation_id, vacation_data)
        
        QMessageBox.information(self, 'Éxito', 'Solicitud de vacaciones creada correctamente')
        self.accept()
        
    def validate_form(self):
        """Validate form data."""
        if not self.employee_combo.currentData():
            QMessageBox.warning(self, 'Error', 'Debe seleccionar un empleado')
            return False
            
        if int(self.days_label.text()) <= 0:
            QMessageBox.warning(self, 'Error', 'La fecha de fin debe ser posterior a la fecha de inicio')
            return False
            
        # Check available vacation days
        emp_id = self.employee_combo.currentData()
        employee = db.get_record('empleados', emp_id)
        if employee:
            available_days = employee.get('dias_vacaciones_disponibles', 15)
            requested_days = int(self.days_label.text())
            
            if requested_days > available_days:
                QMessageBox.warning(self, 'Error', 
                                  f'No tiene suficientes días disponibles. Disponibles: {available_days}, Solicitados: {requested_days}')
                return False
                
        return True