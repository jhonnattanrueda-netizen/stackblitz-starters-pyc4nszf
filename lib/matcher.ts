import { 
  BankTransaction, 
  SiigoTransaction, 
  ConciliationItem, 
  ConciliationSummary 
} from '../types/conciliacion';

interface MatcherOptions {
  diasTolerancia?: number;
  toleranciaMonto?: number;
}

export const conciliarMovimientos = (
  bankTransactions: BankTransaction[],
  siigoTransactions: SiigoTransaction[],
  options: MatcherOptions = { diasTolerancia: 3, toleranciaMonto: 0 }
): { items: ConciliationItem[]; summary: ConciliationSummary } => {
  const items: ConciliationItem[] = [];
  const matchedBankIds = new Set<string>();
  const matchedSiigoIds = new Set<string>();

  const { diasTolerancia = 3, toleranciaMonto = 0 } = options;

  const getDaysDifference = (dateStr1: string, dateStr2: string): number => {
    const d1 = new Date(dateStr1).getTime();
    const d2 = new Date(dateStr2).getTime();
    if (isNaN(d1) || isNaN(d2)) return 999;
    return Math.abs(Math.round((d1 - d2) / (1000 * 3600 * 24)));
  };

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