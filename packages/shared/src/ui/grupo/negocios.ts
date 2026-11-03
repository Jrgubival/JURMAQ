import { LEGAL_INFO } from '../../seo';

/** Los negocios del grupo. "Grupo JURMAQ" es una marca: no tiene razón social ni RUT propios. */
export type Marca = 'hub' | 'arriendo' | 'barraca' | 'constructora';
export type Negocio = Exclude<Marca, 'hub'>;

export const CONTACTO_GRUPO = 'contacto@jurmaq.cl';
export const URL_HUB = 'https://jurmaq.cl';

const constructora = LEGAL_INFO.brands.constructora;
/** Arriendo y constructora comparten sociedad, dirección y teléfono. */
const DIRECCION_MAQUEHUA = 'Lote 3 del lote A, Hijuela 11, Maquehua, Curicó';
const barraca = LEGAL_INFO.brands.barraca;

/** Razón social, RUT y contacto de cada negocio. Nunca mezclar la barraca con los otros dos. */
export const NEGOCIOS: Record<
  Negocio,
  {
    nombre: string;
    url: string;
    razonSocial: string;
    rut: string;
    direccion: string;
    telefono: string;
    telefonoDisplay: string;
  }
> = {
  arriendo: {
    nombre: 'Arriendo de maquinaria',
    url: 'https://rental.jurmaq.cl',
    razonSocial: LEGAL_INFO.nombreLegal,
    rut: LEGAL_INFO.rut,
    direccion: DIRECCION_MAQUEHUA,
    telefono: constructora.telefono,
    telefonoDisplay: constructora.telefonoDisplay,
  },
  barraca: {
    nombre: 'Barraca de fierros',
    url: 'https://barraca.jurmaq.cl',
    razonSocial: barraca.razonSocial,
    rut: barraca.rut,
    direccion: barraca.direccion,
    telefono: barraca.telefono,
    telefonoDisplay: barraca.telefonoDisplay,
  },
  constructora: {
    nombre: 'Constructora',
    url: 'https://constructora.jurmaq.cl',
    razonSocial: LEGAL_INFO.nombreLegal,
    rut: LEGAL_INFO.rut,
    direccion: DIRECCION_MAQUEHUA,
    telefono: constructora.telefono,
    telefonoDisplay: constructora.telefonoDisplay,
  },
};
