// Registros del extracto bancario en Excel
export interface BankTransaction {
  id: string;
  fecha: string;
  referencia: string;
  descripcion: string;
  monto: number;
  tipo: 'DEBITO' | 'CREDITO';
}

// Registros contables traídos de Siigo
export interface SiigoTransaction {
  id: string;
  fecha: string;
  comprobante: string;
  tercero: string;
  observaciones: string;
  monto: number;
  tipo: 'DEBITO' | 'CREDITO';
}

// Estado posible tras el motor de cruce
export type MatchStatus = 'EXACT_MATCH' | 'PARTIAL_MATCH' | 'UNMATCHED';

// Item individual resultante del cruce
export interface ConciliationItem {
  bankTx?: BankTransaction;
  siigoTx?: SiigoTransaction;
  status: MatchStatus;
  confidenceScore: number;
  motivo?: string;
}

// Totales e indicadores para los KPIs
export interface ConciliationSummary {
  totalBank: number;
  totalSiigo: number;
  conciliados: number;
  parciales: number;
  discrepanciasBanco: number;
  discrepanciasSiigo: number;
  montoTotalConciliado: number;
  montoDiferencia: number;
}