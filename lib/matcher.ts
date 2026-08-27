import { BankTransaction, SiigoTransaction, ConciliationItem, ConciliationSummary } from '../types/conciliacion';

export const conciliarMovimientos = (
  bankTransactions: BankTransaction[],
  siigoTransactions: SiigoTransaction[]
): { items: ConciliationItem[]; summary: ConciliationSummary } => {
  const conciliationItems: ConciliationItem[] = [];
  const matchedBankIds = new Set<string>();
  const matchedSiigoIds = new Set<string>();

  // -------------------------------------------------------------
  // FASE 1: Coincidencia 1:1 Exacta por Monto y Naturaleza
  // -------------------------------------------------------------
  bankTransactions.forEach((bankTx) => {
    const candidateIndex = siigoTransactions.findIndex((siigoTx) => {
      if (matchedSiigoIds.has(siigoTx.id)) return false;
      
      const mismaNaturaleza = bankTx.tipo === siigoTx.tipo;
      const mismoMonto = Math.abs(bankTx.monto - siigoTx.monto) < 0.01;
      
      return mismaNaturaleza && mismoMonto;
    });

    if (candidateIndex !== -1) {
      const siigoTx = siigoTransactions[candidateIndex];
      matchedBankIds.add(bankTx.id);
      matchedSiigoIds.add(siigoTx.id);

      conciliationItems.push({
        id: `match-${bankTx.id}-${siigoTx.id}`,
        bankTransaction: bankTx,
        siigoTransaction: siigoTx,
        estado: 'CONCILIADO',
        diferencia: 0,
        motivo: 'Coincidencia exacta 1:1',
      });
    }
  });

  // -------------------------------------------------------------
  // FASE 2: Coincidencia por Suma Agrupada (N:1 - Varios Siigo -> 1 Banco)
  // -------------------------------------------------------------
  const unconciliatedBank = bankTransactions.filter((b) => !matchedBankIds.has(b.id));
  const unconciliatedSiigo = siigoTransactions.filter((s) => !matchedSiigoIds.has(s.id));

  unconciliatedBank.forEach((bankTx) => {
    // Buscar combinaciones de Siigo de la misma naturaleza que sumen exactamente el monto del banco
    const candidates = unconciliatedSiigo.filter(
      (s) => !matchedSiigoIds.has(s.id) && s.tipo === bankTx.tipo
    );

    // Intento de suma de pares (2 a 1)
    let foundGroup: SiigoTransaction[] | null = null;
    for (let i = 0; i < candidates.length; i++) {
      for (let j = i + 1; j < candidates.length; j++) {
        const suma = candidates[i].monto + candidates[j].monto;
        if (Math.abs(suma - bankTx.monto) < 0.01) {
          foundGroup = [candidates[i], candidates[j]];
          break;
        }
      }
      if (foundGroup) break;
    }

    if (foundGroup) {
      matchedBankIds.add(bankTx.id);
      foundGroup.forEach((s) => matchedSiigoIds.add(s.id));

      foundGroup.forEach((siigoTx, idx) => {
        conciliationItems.push({
          id: `match-group-${bankTx.id}-${siigoTx.id}`,
          bankTransaction: idx === 0 ? bankTx : undefined, // Asigna la cabecera al primero
          siigoTransaction: siigoTx,
          estado: 'CONCILIADO',
          diferencia: 0,
          motivo: `Agrupación por suma parcial (${foundGroup.length} asientos en Siigo)`,
        });
      });
    }
  });

  // -------------------------------------------------------------
  // FASE 3: Registrar Pendientes de Banco (Sin cruce en Siigo)
  // -------------------------------------------------------------
  bankTransactions.forEach((bankTx) => {
    if (!matchedBankIds.has(bankTx.id)) {
      conciliationItems.push({
        id: `pending-bank-${bankTx.id}`,
        bankTransaction: bankTx,
        estado: 'PENDIENTE_BANCO',
        diferencia: bankTx.monto,
        motivo: 'Pendiente de registrar en la contabilidad de Siigo',
      });
    }
  });

  // -------------------------------------------------------------
  // FASE 4: Registrar Pendientes de Siigo (Sin cruce en Banco)
  // -------------------------------------------------------------
  siigoTransactions.forEach((siigoTx) => {
    if (!matchedSiigoIds.has(siigoTx.id)) {
      conciliationItems.push({
        id: `pending-siigo-${siigoTx.id}`,
        siigoTransaction: siigoTx,
        estado: 'PENDIENTE_SIIGO',
        diferencia: siigoTx.monto,
        motivo: 'Pendiente de extracto bancario',
      });
    }
  });

  // -------------------------------------------------------------
  // CALCULO DEL RESUMEN FINANCIERO DE SALDOS
  // -------------------------------------------------------------
  const totalBancoDebito = bankTransactions
    .filter((b) => b.tipo === 'DEBITO')
    .reduce((acc, b) => acc + b.monto, 0);

  const totalBancoCredito = bankTransactions
    .filter((b) => b.tipo === 'CREDITO')
    .reduce((acc, b) => acc + b.monto, 0);

  const totalSiigoDebito = siigoTransactions
    .filter((s) => s.tipo === 'DEBITO')
    .reduce((acc, s) => acc + s.monto, 0);

  const totalSiigoCredito = siigoTransactions
    .filter((s) => s.tipo === 'CREDITO')
    .reduce((acc, s) => acc + s.monto, 0);

  const conciliados = conciliationItems.filter((item) => item.estado === 'CONCILIADO').length;
  const pendientesBanco = conciliationItems.filter((item) => item.estado === 'PENDIENTE_BANCO').length;
  const pendientesSiigo = conciliationItems.filter((item) => item.estado === 'PENDIENTE_SIIGO').length;

  const summary: ConciliationSummary = {
    totalBanco: totalBancoDebito - totalBancoCredito,
    totalSiigo: totalSiigoDebito - totalSiigoCredito,
    diferenciaTotal: Math.abs((totalBancoDebito - totalBancoCredito) - (totalSiigoDebito - totalSiigoCredito)),
    totalConciliados: conciliados,
    totalPendientesBanco: pendientesBanco,
    totalPendientesSiigo: pendientesSiigo,
  };

  return { items: conciliationItems, summary };
};