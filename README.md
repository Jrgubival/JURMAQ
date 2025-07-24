# Sistema JURMAQ - Constructora Jorge Ubilla Rivera E.I.R.L.

## Información del Sistema

**Empresa**: CONSTRUCTORA JORGE UBILLA RIVERA E.I.R.L.  
**RUT**: 76.624.872-1  
**Versión**: 1.0.0  
**Fecha**: Julio 2024  

## Descripción

Sistema integral de gestión para constructora que incluye:

- 🔐 **Autenticación de usuarios** (admin, secretaria, operador)
- 📊 **Dashboard** con estadísticas en tiempo real
- 🛒 **Órdenes de Compra** (normales y combustible)
- 💰 **Presupuestos** independientes con firma digital
- 🚗 **Gestión de Vehículos** con control de combustible
- 👥 **Personal** (empleados, asistencia, nómina, vacaciones)
- 📋 **Sistema de Logs** completo
- 📄 **Generación de PDFs** con logo empresarial

## Características Especiales

### Órdenes de Combustible
- Proveedor específico: **COMERCIAL MAQUEHUA SPA** (RUT: 77.346.747-1)
- Asignación por vehículo específico
- Control mensual de consumo

### Gestión de Personal
- **Asistencia**: Carga masiva mensual
- **Sueldos**: Cálculo automático (sueldo_bruto/30 * días_trabajados)
- **Vacaciones**: Control automático de días disponibles
- **Logs**: Auditoría completa

### Generación de PDFs
- Logo empresarial automático
- Firma digital en presupuestos
- Sin errores garantizados

## Estructura del Proyecto

```
JURMAQ/
├── main.py                 # Aplicación principal
├── modules/
│   ├── __init__.py
│   ├── login.py           # Sistema de autenticación
│   ├── dashboard.py       # Panel principal
│   ├── ordenes_compra.py  # Órdenes de compra
│   ├── presupuestos.py    # Presupuestos independientes
│   ├── vehiculos.py       # Gestión de vehículos
│   ├── personal.py        # Gestión de personal
│   ├── logs.py           # Sistema de auditoría
│   ├── utils.py          # Utilidades y constantes
│   └── pdf_generator.py  # Generación de PDFs
├── data/                  # Base de datos JSON
├── assets/
│   ├── logo.png          # Logo de la empresa
│   └── firma.png         # Firma digital
├── output/               # PDFs generados
├── requirements.txt      # Dependencias
├── create_sample_data.py # Script de datos de ejemplo
└── test_system.py       # Suite de pruebas
```

## Instalación

1. **Instalar dependencias**:
   ```bash
   pip install -r requirements.txt
   ```

2. **Crear datos de ejemplo**:
   ```bash
   python create_sample_data.py
   ```

3. **Ejecutar aplicación**:
   ```bash
   python main.py
   ```

## Usuarios por Defecto

| Usuario    | Contraseña | Rol        | Permisos                    |
|------------|------------|------------|-----------------------------|
| admin      | admin123   | admin      | Acceso completo             |
| secretaria | secre123   | secretaria | Órdenes, presupuestos, personal |
| operador   | opera123   | operador   | Solo lectura vehículos      |

## Funcionalidades por Módulo

### 📊 Dashboard
- Estadísticas en tiempo real
- Actividad reciente
- Acciones rápidas
- Resúmenes mensuales

### 🛒 Órdenes de Compra
- **Normales**: Proveedores diversos con items detallados
- **Combustible**: Solo COMERCIAL MAQUEHUA SPA con asignación vehicular
- Estados: Pendiente, Aprobada, Entregada, Cancelada
- Generación de PDFs profesionales

### 💰 Presupuestos
- Sistema independiente de cotizaciones
- Información completa del cliente
- Items detallados con cálculos automáticos
- Vigencia configurable (30 días por defecto)
- Estados: Borrador, Enviado, Aprobado, Rechazado
- PDFs con firma digital automática

### 🚗 Vehículos
- Registro completo de flota
- Información técnica y documentos
- **Control de Combustible**:
  - Registro por vehículo
  - Estadísticas mensuales
  - Consumo promedio
  - Seguimiento de kilometraje
- Alertas de documentos vencidos

### 👥 Personal
- **Empleados**: Datos completos con información laboral
- **Asistencia**: 
  - Registro individual o carga masiva
  - Control de horas extras
  - Cálculo automático de días faltantes
- **Remuneraciones**:
  - Cálculo automático: (sueldo_base/30) * días_trabajados
  - Bonos por horas extras
  - Descuentos previsionales
  - Generación de liquidaciones PDF
- **Vacaciones**:
  - Solicitudes con aprobación
  - Descuento automático de días disponibles
  - Control de saldos por empleado

### 📋 Logs
- Registro completo de actividad
- Filtros por usuario, módulo y fecha
- Auditoría de todas las operaciones
- Actividad por usuario

## Cálculos Específicos

### Sueldos
```python
# Ejemplo: Sueldo bruto $600.000, trabajó 22 días
sueldo_bruto = 600000
dias_trabajados = 22
dias_mes = 30
sueldo_final = (sueldo_bruto / dias_mes) * dias_trabajados
# Resultado: $440.000
```

### Vacaciones
```python
# Descuento automático de días
dias_disponibles = 15
dias_solicitados = 7
nuevo_saldo = dias_disponibles - dias_solicitados  # 8 días
```

## Especificaciones Técnicas

### Base de Datos
- Formato: JSON (archivos locales)
- Estructura: Un archivo por tabla
- Respaldo automático con timestamps

### PDFs
- Librería: ReportLab
- Formato: A4
- Encoding: UTF-8 (soporte caracteres especiales)
- Logo automático en encabezado
- Firma digital en presupuestos

### Seguridad
- Contraseñas hasheadas (SHA-256)
- Sesiones con timeout (8 horas)
- Logs de acceso completos
- Validación de permisos por rol

## Validaciones del Sistema

✅ **Base de Datos**: Carga y guarda datos correctamente  
✅ **Autenticación**: Login/logout con roles funcionando  
✅ **Cálculos**: Nómina y formateo de moneda correctos  
✅ **Logs**: Sistema de auditoría operativo  
✅ **PDFs**: Generación sin errores con logo  
✅ **Integridad**: Relaciones entre datos válidas  
✅ **Lógica de Negocio**: Combustible, vacaciones y nómina funcionando  

## Soporte y Mantenimiento

### Respaldos
```bash
# Respaldar datos
cp -r data/ backup_$(date +%Y%m%d)/
```

### Logs del Sistema
- Ubicación: `data/logs/`
- Formato: `jurmaq_YYYYMMDD.log`
- Rotación: Diaria automática

### Actualización de Assets
- Reemplazar `assets/logo.png` para cambiar logo
- Reemplazar `assets/firma.png` para cambiar firma
- Tamaños recomendados: Logo 200x100px, Firma 150x75px

## Funcionalidades Avanzadas

### Carga Masiva de Asistencia
Formato CSV:
```
RUT,Días_Trabajados,Horas_Extras
12.345.678-9,22,5
98.765.432-1,20,0
```

### Reportes Automáticos
- Estadísticas mensuales de combustible
- Resúmenes de nómina por período
- Control de vacaciones por empleado
- Actividad del sistema por usuario

### Filtros y Búsquedas
- Órdenes por tipo, estado y fecha
- Presupuestos por cliente y estado
- Vehículos por tipo y estado
- Personal por cargo y estado
- Logs por usuario y módulo

## Cumplimiento de Requisitos

✅ **Empresa Específica**: CONSTRUCTORA JORGE UBILLA RIVERA E.I.R.L.  
✅ **Combustible**: Solo COMERCIAL MAQUEHUA SPA (77.346.747-1)  
✅ **Asignación Vehicular**: Monto específico por vehículo  
✅ **PDFs Funcionales**: Sin errores, con logo empresarial  
✅ **Presupuestos Independientes**: Sistema separado con firma  
✅ **Personal Completo**: Asistencia, sueldos, vacaciones  
✅ **Carga Masiva**: Asistencia mensual automatizada  
✅ **Cálculo Sueldos**: (sueldo_bruto/30) * días_trabajados  
✅ **Control Vacaciones**: Descuento automático de días  
✅ **Logs Completos**: Auditoría total del sistema  
✅ **Estadísticas Reales**: Solo datos útiles y funcionales  
✅ **Pestañas Separadas**: Interfaz organizada por módulos  

---

**Sistema desarrollado específicamente para CONSTRUCTORA JORGE UBILLA RIVERA E.I.R.L.**  
**Listo para uso en producción - Versión 1.0.0**