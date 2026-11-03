-- Total de filas de las tablas del esquema public. Para comparar el origen con
-- la restauración sin imprimir nada de las tablas.
select coalesce(sum((xpath(
  '/row/c/text()',
  query_to_xml(format('select count(*) c from %I.%I', schemaname, tablename), false, true, '')
))[1]::text::bigint), 0)
from pg_tables
where schemaname = 'public';
