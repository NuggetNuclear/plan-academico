// ── Definición de mallas (lo que viene en public/carreras/*.json) ──

export interface ReglaPractica {
  /** Debe estar aprobado todo hasta este semestre (incluido inglés). */
  hastaSemestre: number;
  /** Ramos que se pueden deber y cursar en paralelo. */
  maxDeuda?: number;
  /** Ramos que nunca se pueden deber. */
  sinDeuda?: string[];
}

export interface OpcionEleccion {
  sigla: string;
  nombre: string;
}

export interface RamoDef {
  id: string;
  sigla?: string;
  /** Otros códigos con que los reportes de la UDP informan este mismo ramo (vías de titulación). */
  equivalentes?: string[];
  nombre: string;
  creditos: number;
  semestre: number;
  req?: string[];
  coreq?: string[];
  tipo?: string;
  anual?: boolean;
  semestreMinimo?: number;
  soloMalla?: boolean;
  excluirPlanner?: boolean;
  areaOFG?: string;
  grupoAlt?: string;
  grupoAltCreditosUnico?: number;
  opciones?: OpcionEleccion[];
  reglaPractica?: ReglaPractica;
  aviso?: string;
  rutas?: string[];
  semestrePorRuta?: Record<string, number>;
}

export interface RutaAcademica {
  id: string;
  nombre: string;
  nombreCompleto: string;
  icono?: string;
  semestresObjetivo: number;
  maxCreditosSemestre: number;
  creditosPlan?: number;
  titulo?: string;
  descripcion?: string;
  nota?: string;
  excluir?: string[];
}

export interface ConfigOFG {
  maxCreditosPorArea: number;
  ofgLibreId: string;
  maxCreditosInglesComoLibres: number;
}

export type Reglamento = "udp" | "uc" | null;

export interface MallaDef {
  id: string;
  carrera: string;
  universidad: string;
  siglaUniversidad?: string;
  reglamento?: Reglamento;
  posicionToma?: "ventana" | "banner";
  periodoVerano?: string;
  maxCreditosSemestre: number;
  semestresObjetivo: number;
  nivelesIngles?: string[];
  configuracionOFG?: ConfigOFG;
  rutaDefault?: string;
  rutasAcademicas?: RutaAcademica[];
  tipos?: Record<string, string>;
  ramos: RamoDef[];
  ramosRutas?: RamoDef[];
}

export interface CarreraIndice {
  id: string;
  nombre: string;
  universidad: string;
  archivo: string;
  /** Fragmentos (sin tildes ni mayúsculas) del nombre del plan en los reportes de la UDP. */
  planes?: string[];
}

// ── Malla ya resuelta para la ruta y configuración actuales ──

export interface Ramo extends RamoDef {
  req: string[];
  coreq: string[];
  tipo: string;
  /** Para prácticas con regla: todo lo que exige aprobado hasta su semestre. */
  reqPractica: string[];
}
