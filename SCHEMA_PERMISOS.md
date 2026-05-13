# Esquema de Permisos por Rol — JURMAQ.CL

Matriz autoritativa de qué puede hacer cada rol. Esta es la fuente de verdad: `src/lib/roles.ts` debe coincidir con esta tabla, y cada API route admin debe gatear con `requirePermission(modulo, accion)`.

---

## Roles

| Rol | Para quién | Filosofía |
|---|---|---|
| **admin** | Jorge (dueño) | Sin restricciones. Único que crea/elimina otros usuarios. |
| **gerente** | Mano derecha / socio | Igual a admin **excepto** gestión de usuarios. |
| **vendedor** | Comerciales / oficina | Cierra ventas: cotiza, atiende solicitudes, prepara contratos. **NO** toca precios ni combustible. |
| **operador** | Despacho / terreno | Mueve la operación física: cambia estados de máquinas, marca contratos vigentes/vencidos, registra carga de combustible. **NO** crea ni borra. |
| **contador** | Finanzas / SII | Combustible end-to-end (F29), ve cotizaciones para conciliar pagos. **NO** opera el negocio. |

---

## Matriz completa

Notación: ✓ = permitido · ✗ = denegado · 👁 = solo lectura

### Operación principal

| Módulo / Acción | admin | gerente | vendedor | operador | contador |
|---|---|---|---|---|---|
| **Dashboard** ver | ✓ | ✓ | ✓ | ✓ | ✓ |
| **Maquinarias** ver | ✓ | ✓ | ✓ | ✓ | ✗ |
| Maquinarias crear | ✓ | ✓ | ✗ | ✗ | ✗ |
| Maquinarias editar (datos + precios) | ✓ | ✓ | ✗ | ✗ | ✗ |
| Maquinarias cambiar **solo estado** | ✓ | ✓ | ✗ | ✓ | ✗ |
| Maquinarias eliminar | ✓ | ✓ | ✗ | ✗ | ✗ |
| **Solicitudes** ver | ✓ | ✓ | ✓ | ✗ | ✗ |
| Solicitudes crear | ✓ | ✓ | ✓ | ✗ | ✗ |
| Solicitudes editar (estado/notas) | ✓ | ✓ | ✓ | ✗ | ✗ |
| Solicitudes eliminar | ✓ | ✓ | ✗ | ✗ | ✗ |
| **Cotizaciones** ver | ✓ | ✓ | ✓ | ✗ | ✓ |
| Cotizaciones crear | ✓ | ✓ | ✓ | ✗ | ✗ |
| Cotizaciones editar | ✓ | ✓ | ✓ | ✗ | ✗ |
| Cotizaciones eliminar | ✓ | ✓ | ✗ | ✗ | ✗ |
| **Proyectos** ver/cud | ✓ | ✓ | ✗ | ✗ | ✗ |
| **Clientes** ver | ✓ | ✓ | ✓ | ✗ | ✗ |
| Clientes crear/editar | ✓ | ✓ | ✓ | ✗ | ✗ |
| Clientes eliminar | ✓ | ✓ | ✗ | ✗ | ✗ |

### Contratos (negocio crítico)

| Módulo / Acción | admin | gerente | vendedor | operador | contador |
|---|---|---|---|---|---|
| Contratos ver | ✓ | ✓ | ✓ | ✓ | ✗ |
| Contratos crear (wizard) | ✓ | ✓ | ✓ | ✗ | ✗ |
| Contratos enviar a firma | ✓ | ✓ | ✓ | ✗ | ✗ |
| Contratos cambiar estado a **vigente / vencido** | ✓ | ✓ | ✓ | ✓ | ✗ |
| Contratos anular | ✓ | ✓ | ✓ | ✗ | ✗ |
| Contratos eliminar (solo borrador) | ✓ | ✓ | ✓ | ✗ | ✗ |
| Contratos editar plantilla | ✓ | ✓ | ✗ | ✗ | ✗ |

### Combustible (Ley 18.502 / F29)

| Acción | admin | gerente | vendedor | operador | contador |
|---|---|---|---|---|---|
| Combustible ver | ✓ | ✓ | ✗ | ✓ | ✓ |
| Registrar factura (estado: registrada) | ✓ | ✓ | ✗ | ✓ | ✓ |
| Validar / marcar recuperada | ✓ | ✓ | ✗ | ✗ | ✓ |
| Anular / eliminar | ✓ | ✓ | ✗ | ✗ | ✓ |
| Exportar Excel para SII | ✓ | ✓ | ✗ | ✗ | ✓ |

### Usuarios (gestión interna)

| Acción | admin | gerente | vendedor | operador | contador |
|---|---|---|---|---|---|
| Ver usuarios | ✓ | ✗ | ✗ | ✗ | ✗ |
| Crear / editar / eliminar usuarios | ✓ | ✗ | ✗ | ✗ | ✗ |

> **Solo admin** puede gestionar usuarios. Esto es intencional: ni siquiera el gerente debería poder darle acceso a un colaborador nuevo. Si el dueño se va de vacaciones, debe dejar al menos otro admin de respaldo (la API impide eliminar al último admin).

### Barraca de fierros (e-commerce)

| Módulo / Acción | admin | gerente | vendedor | operador | contador |
|---|---|---|---|---|---|
| **Productos** ver/cud | ✓ | ✓ | ✗ | ✗ | ✗ |
| **Categorías** ver/cud | ✓ | ✓ | ✗ | ✗ | ✗ |
| **Cotizaciones barraca** ver | ✓ | ✓ | ✓ | ✗ | ✓ |
| Cotizaciones barraca atender (mensaje, contraoferta) | ✓ | ✓ | ✓ | ✗ | ✗ |
| Cotizaciones barraca eliminar | ✓ | ✓ | ✗ | ✗ | ✗ |
| **Promociones** crud | ✓ | ✓ | ✗ | ✗ | ✗ |
| **Precios** masivo | ✓ | ✓ | ✗ | ✗ | ✗ |
| **Imágenes / imágenes masivas** | ✓ | ✓ | ✗ | ✗ | ✗ |
| **Importar Excel** | ✓ | ✓ | ✗ | ✗ | ✗ |
| **Suscriptores** crud | ✓ | ✓ | ✗ | ✗ | ✗ |

---

## Reglas operativas

1. **Sidebar filtrado**: cada rol ve solo los módulos en los que tiene al menos `read`. Los demás se ocultan.

2. **APIs guardadas**: cada endpoint admin (`/api/admin/*`, `/api/maquinarias`, `/api/cotizaciones`, `/api/proyectos`, `/api/clientes`, `/api/solicitudes`) llama `requirePermission(modulo, accion)`. Si no calza, devuelve `403`.

3. **Maquinarias - update solo estado para operador**: el endpoint `PUT /api/maquinarias/[id]` whitelista campos según rol. Operador solo puede modificar `estado`. Cualquier otro campo en el body lo ignora silenciosamente.

4. **Contratos - update estado para operador**: el endpoint `PUT /api/admin/contratos/[id]` whitelista campos. Operador solo puede pasar entre `firmado → vigente → vencido`. No puede editar montos ni datos del arrendatario.

5. **Self-protection**:
   - Un admin no puede quitarse el rol admin a sí mismo (se bloquearía).
   - Un usuario no puede eliminarse a sí mismo.
   - El último admin del sistema no puede ser eliminado.

6. **Email único**: el email de un usuario admin debe ser único entre `users` (admin/empleados) y `barraca_usuarios` (clientes). No puede haber colisión.

7. **Contraseña**: mínimo 8 caracteres + 1 mayúscula + 1 número, hash bcrypt cost 10. Igual que clientes barraca.

---

## Cómo probar que las guardas funcionan

```bash
# 1. Crea un usuario "vendedor" desde /admin/usuarios.
# 2. Cierra sesión, login con sus credenciales.
# 3. Verifica:
#    - Sidebar oculta Combustible, Usuarios, Plantillas, secciones barraca admin.
#    - GET /api/admin/usuarios       → 403
#    - DELETE /api/maquinarias/3     → 403
#    - PUT /api/maquinarias/3 con {precio_dia:1000} → 403 o ignorado
#    - POST /api/cotizaciones {...}  → 200 (vendedor sí puede)
```
