// Transacción proveniente de Siigo API
export interface SiigoTransaction {
  id: string;
  fecha: string; // Formato YYYY-MM-DD
  comprobante: string; // Ej: "RC-1-205"
  tercero: string; // Nombre o NIT del cliente/proveedor
  observaciones: string;
  monto: number;
  tipo: 'DEBITO' | 'CREDITO';
}

// Estados posibles de la conciliación
export type MatchStatus = 'EXACT_MATCH' | 'PARTIAL_MATCH' | 'UNMATCHED';

// Resultado individual de la comparación
export interface ConciliationItem {
  bankTx?: BankTransaction;
  siigoTx?: SiigoTransaction;
  status: MatchStatus;
  confidenceScore: number; // 0 - 100%
  motivo?: string;
}

// Resumen macro del proceso
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