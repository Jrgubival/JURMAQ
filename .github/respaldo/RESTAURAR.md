# Restaurar un respaldo de Supabase

Los respaldos están en el bucket privado `jurmaq-respaldos` de Cloudflare R2, en
`diario/jurmaq-AAAA-MM-DD.dump.age`, cifrados con age. Se guardan 30 días.
Para abrirlos hace falta la llave privada de age, que guarda Jorge.

1. Bajar el archivo:
   `npx wrangler r2 object get jurmaq-respaldos/diario/jurmaq-AAAA-MM-DD.dump.age --remote --file respaldo.dump.age`
2. Descifrar: `age -d -i age-key.txt -o respaldo.dump respaldo.dump.age`
3. En un Postgres 17 vacío:
   `psql "$DESTINO" -f .github/respaldo/preparar-restauracion.sql`
   `pg_restore -d "$DESTINO" --no-owner --exit-on-error respaldo.dump`
4. Borrar `respaldo.dump` al terminar: tiene datos personales de clientes.

Incluye los esquemas public, auth y storage. Los archivos de Supabase Storage
(comprobantes y cotizaciones en PDF) no van en el dump: sólo sus registros.
