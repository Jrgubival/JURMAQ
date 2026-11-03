/**
 * Datos fijos del arriendo. Salen de la cotización de Jorge y de lo que él
 * confirmó: no agregar aquí nada que no esté respaldado.
 */
export const SITIO = {
  url: 'https://rental.jurmaq.cl',
  nombre: 'JURMAQ Arriendo',
  marca: 'JURMAQ',
  razonSocial: 'Constructora Jorge Ubilla Rivera E.I.R.L.',
  rut: '76.624.872-1',
  giro: 'Construcción',
  direccion: 'Lote 3 del Lt A Hj 11, Maquehua, Curicó',
  calle: 'Lote 3 del Lt A Hj 11, Maquehua',
  comuna: 'Curicó',
  region: 'Región del Maule',
  telefono: '+56992994452',
  telefonoVisible: '+56 9 9299 4452',
  whatsappNumero: '56992994452',
  correo: process.env.NEXT_PUBLIC_CORREO_ARRIENDO?.trim() || 'constructora@jurmaq.cl',
  anioInicio: 2000,
  geo: { latitude: -34.9833, longitude: -71.2333 },
} as const;

export const TERMINOS_URL = 'https://jurmaq.cl/terminos';
export const PRIVACIDAD_URL = 'https://jurmaq.cl/privacidad';

export function enlaceWhatsapp(texto: string): string {
  return `https://wa.me/${SITIO.whatsappNumero}?text=${encodeURIComponent(texto)}`;
}

export const IVA = 0.19;
export const VALIDEZ_DIAS = 15;
