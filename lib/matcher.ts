import { BankTransaction } from '@/types/conciliacion';
import { SiigoTransaction, ConciliationItem, ConciliationSummary } from '@/types/conciliacion';

interface MatcherOptions {
  diasTolerancia?: number; // Tolerancia en días para movimientos bancarios tardíos
  toleranciaMonto?: number; // Diferencia máxima permitida en monto (ej: centavos)
}

export const conciliarMovimientos = (
  bankTransactions: BankTransaction[],
  siigoTransactions: SiigoTransaction[],
  options: MatcherOptions = { diasTolerancia: 3, toleranciaMonto: 0 }
): { items: ConciliationItem[]; summary: ConciliationSummary } => {
  const items: ConciliationItem[] = [];
  
  // Sets para rastrear elementos ya emparejados y evitar duplicación
  const matchedBankIds = new Set<string>();
  const matchedSiigoIds = new Set<string>();

  const { diasTolerancia = 3, toleranciaMonto = 0 } = options;

  // Helper para calcular diferencia de días entre dos fechas (YYYY-MM-DD)
  const getDaysDifference = (dateStr1: string, dateStr2: string): number => {
    const d1 = new Date(dateStr1).getTime();
    const d2 = new Date(dateStr2).getTime();
    if (isNaN(d1) || isNaN(d2)) return 999;
    return Math.abs(Math.round((d1 - d2) / (1000 * 3600 * 24)));
  };

  // ------------------------------------------------------------------
  // PASO 1: Coincidencia Exacta (Fecha + Monto + Tipo + Referencia)
  // ------------------------------------------------------------------
  for (const bankTx of bankTransactions) {
    const exactMatch = siigoTransactions.find((sTx) => {
      if (matchedSiigoIds.has(sTx.id)) return false;

      const esMismoMonto = Math.abs(bankTx.monto - sTx.monto) <= toleranciaMonto;
      const esMismoTipo = bankTx.tipo === sTx.tipo;
      const esMismaFecha = bankTx.fecha === sTx.fecha;
      const coincideRef = bankTx.referencia && sTx.comprobante.includes(bankTx.referencia);

      return esMismoMonto && esMismoTipo && (esMismaFecha || coincideRef);
    });

    if (exactMatch) {
      matchedBankIds.add(bankTx.id);
      matchedSiigoIds.add(exactMatch.id);

      items.push({
        bankTx,
        siigoTx: exactMatch,
        status: 'EXACT_MATCH',
        confidenceScore: 100,
        motivo: 'Coincidencia exacta en valor, tipo y documento/fecha.',
      });
    }
  }

  // ------------------------------------------------------------------
  // PASO 2: Coincidencia Parcial / Difusa (Monto Exacto + Rango de Fechas)
  // ------------------------------------------------------------------
  for (const bankTx of bankTransactions) {
    if (matchedBankIds.has(bankTx.id)) continue;

    const partialMatch = siigoTransactions.find((sTx) => {
      if (matchedSiigoIds.has(sTx.id)) return false;

      const esMismoMonto = Math.abs(bankTx.monto - sTx.monto) <= toleranciaMonto;
      const esMismoTipo = bankTx.tipo === sTx.tipo;
      const diffDias = getDaysDifference(bankTx.fecha, sTx.fecha);

      return esMismoMonto && esMismoTipo && diffDias <= diasTolerancia;
    });

    if (partialMatch) {
      matchedBankIds.add(bankTx.id);
      matchedSiigoIds.add(partialMatch.id);

      const diffDias = getDaysDifference(bankTx.fecha, partialMatch.fecha);
      items.push({
        bankTx,
        siigoTx: partialMatch,
        status: 'PARTIAL_MATCH',
        confidenceScore: Math.max(70, 95 - diffDias * 5),
        motivo: `Monto y tipo coinciden. Desfase de ${diffDias} día(s) en la fecha de registro.`,
      });
    }
  }

  // ------------------------------------------------------------------
  // PASO 3: Registro de Discrepancias (Movimientos No Emparejados)
  // ------------------------------------------------------------------

  // Transacciones que están en el Extracto Bancario pero NO en Siigo
  for (const bankTx of bankTransactions) {
    if (!matchedBankIds.has(bankTx.id)) {
      items.push({
        bankTx,
        status: 'UNMATCHED',
        confidenceScore: 0,
        motivo: 'Movimiento presente en el extracto bancario no encontrado en Siigo.',
      });
    }
  }

  // Transacciones que están en Siigo pero NO en el Extracto Bancario
  for (const sTx of siigoTransactions) {
    if (!matchedSiigoIds.has(sTx.id)) {
      items.push({
        siigoTx: sTx,
        status: 'UNMATCHED',
        confidenceScore: 0,
        motivo: 'Registro contable en Siigo sin movimiento correspondiente en el banco.',
      });
    }
  }

  // ------------------------------------------------------------------
  // PASO 4: Cálculo de Métricas Generales
  // ------------------------------------------------------------------
  const summary: ConciliationSummary = {
    totalBank: bankTransactions.length,
    totalSiigo: siigoTransactions.length,
    conciliados: items.filter((i) => i.status === 'EXACT_MATCH').length,
    parciales: items.filter((i) => i.status === 'PARTIAL_MATCH').length,
    discrepanciasBanco: bankTransactions.length - matchedBankIds.size,
    discrepanciasSiigo: siigoTransactions.length - matchedSiigoIds.size,
    montoTotalConciliado: items
      .filter((i) => i.status !== 'UNMATCHED')
      .reduce((acc, i) => acc + (i.bankTx?.monto || 0), 0),
    montoDiferencia:
      bankTransactions.reduce((acc, t) => acc + t.monto, 0) -
      siigoTransactions.reduce((acc, t) => acc + t.monto, 0),
  };

  return { items, summary };
};