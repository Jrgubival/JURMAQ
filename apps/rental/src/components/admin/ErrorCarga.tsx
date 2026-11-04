export default function ErrorCarga() {
  return (
    <div role="alert" className="mt-4 border border-peligro p-4">
      <p className="font-semibold text-peligro">No se pudo cargar. Tus datos no se perdieron.</p>
      <a href="" className="boton boton-suave mt-3">Reintentar</a>
    </div>
  );
}
