// ── Definición de mallas (lo que viene en public/carreras/*.json) ──

interface ReglaPractica {
  /** Debe estar aprobado todo hasta este semestre (incluido inglés). */
  hastaSemestre: number;
  /** Ramos que se pueden deber y cursar en paralelo. */
  maxDeuda?: number;
  /** Ramos que nunca se pueden deber. */
  sinDeuda?: string[];
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
  tipo?: string;
  /** Área de conocimiento para medir fortalezas en Estadísticas (sin área no se cuenta). */
  area?: string;
  reglaPractica?: ReglaPractica;
  aviso?: string;
}

export interface MallaDef {
  id: string;
  carrera: string;
  universidad: string;
  siglaUniversidad?: string;
  periodoVerano?: string;
  maxCreditosSemestre: number;
  semestresObjetivo: number;
  nivelesIngles?: string[];
  tipos?: Record<string, string>;
  areas?: Record<string, string>;
  ramos: RamoDef[];
}

// ── Malla ya resuelta para la ruta y configuración actuales ──

export interface Ramo extends RamoDef {
  req: string[];
  tipo: string;
  /** Para prácticas con regla: todo lo que exige aprobado hasta su semestre. */
  reqPractica: string[];
}
