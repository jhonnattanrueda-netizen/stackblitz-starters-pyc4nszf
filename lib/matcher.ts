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
  // FASE 2: Agrupación N:1 (Varios Movimientos de Banco -> 1 Registro de Siigo)
  // Caso de tu imagen: $26.000.000 + $500.000 + $6.790.000 = $33.290.000 en Siigo
  // -------------------------------------------------------------
  const unconciliatedSiigoForN1 = siigoTransactions.filter((s) => !matchedSiigoIds.has(s.id));
  const unconciliatedBankForN1 = bankTransactions.filter((b) => !matchedBankIds.has(b.id));

  unconciliatedSiigoForN1.forEach((siigoTx) => {
    if (matchedSiigoIds.has(siigoTx.id)) return;

    const bankCandidates = unconciliatedBankForN1.filter(
      (b) => !matchedBankIds.has(b.id) && b.tipo === siigoTx.tipo
    );

    let foundBankGroup: BankTransaction[] | null = null;

    // Probar combinaciones de 2, 3, 4 y 5 elementos del banco
    const buscarCombinacionBanco = (startIdx: number, currentCombo: BankTransaction[], currentSum: number, targetCount: number) => {
      if (foundBankGroup) return;
      if (currentCombo.length === targetCount) {
        if (Math.abs(currentSum - siigoTx.monto) < 0.01) {
          foundBankGroup = [...currentCombo];
        }
        return;
      }

      for (let i = startIdx; i < bankCandidates.length; i++) {
        const b = bankCandidates[i];
        if (currentSum + b.monto <= siigoTx.monto + 0.01) {
          buscarCombinacionBanco(i + 1, [...currentCombo, b], currentSum + b.monto, targetCount);
        }
      }
    };

    for (let count = 2; count <= 5; count++) {
      buscarCombinacionBanco(0, [], 0, count);
      if (foundBankGroup) break;
    }

    if (foundBankGroup) {
      const group: BankTransaction[] = foundBankGroup;
      matchedSiigoIds.add(siigoTx.id);
      group.forEach((b) => matchedBankIds.add(b.id));

      group.forEach((bankTx, idx) => {
        conciliationItems.push({
          id: `match-n1-${bankTx.id}-${siigoTx.id}`,
          bankTransaction: bankTx,
          siigoTransaction: idx === 0 ? siigoTx : undefined,
          estado: 'CONCILIADO',
          diferencia: 0,
          motivo: `Suma agrupada banco (${group.length} pagos del extracto = 1 registro Siigo)`,
        });
      });
    }
  });

  // -------------------------------------------------------------
  // FASE 3: Agrupación 1:N (1 Movimiento de Banco -> Varios Registros de Siigo)
  // -------------------------------------------------------------
  const unconciliatedBankFor1N = bankTransactions.filter((b) => !matchedBankIds.has(b.id));
  const unconciliatedSiigoFor1N = siigoTransactions.filter((s) => !matchedSiigoIds.has(s.id));

  unconciliatedBankFor1N.forEach((bankTx) => {
    if (matchedBankIds.has(bankTx.id)) return;

    const siigoCandidates = unconciliatedSiigoFor1N.filter(
      (s) => !matchedSiigoIds.has(s.id) && s.tipo === bankTx.tipo
    );

    let foundSiigoGroup: SiigoTransaction[] | null = null;

    const buscarCombinacionSiigo = (startIdx: number, currentCombo: SiigoTransaction[], currentSum: number, targetCount: number) => {
      if (foundSiigoGroup) return;
      if (currentCombo.length === targetCount) {
        if (Math.abs(currentSum - bankTx.monto) < 0.01) {
          foundSiigoGroup = [...currentCombo];
        }
        return;
      }

      for (let i = startIdx; i < siigoCandidates.length; i++) {
        const s = siigoCandidates[i];
        if (currentSum + s.monto <= bankTx.monto + 0.01) {
          buscarCombinacionSiigo(i + 1, [...currentCombo, s], currentSum + s.monto, targetCount);
        }
      }
    };

    for (let count = 2; count <= 5; count++) {
      buscarCombinacionSiigo(0, [], 0, count);
      if (foundSiigoGroup) break;
    }

    if (foundSiigoGroup) {
      const group: SiigoTransaction[] = foundSiigoGroup;
      matchedBankIds.add(bankTx.id);
      group.forEach((s) => matchedSiigoIds.add(s.id));

      group.forEach((siigoTx, idx) => {
        conciliationItems.push({
          id: `match-1n-${bankTx.id}-${siigoTx.id}`,
          bankTransaction: idx === 0 ? bankTx : undefined,
          siigoTransaction: siigoTx,
          estado: 'CONCILIADO',
          diferencia: 0,
          motivo: `Suma agrupada Siigo (1 pago banco = ${group.length} asientos Siigo)`,
        });
      });
    }
  });

  // -------------------------------------------------------------
  // FASE 4: Registrar Pendientes de Banco (Sin cruce)
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
  // FASE 5: Registrar Pendientes de Siigo (Sin cruce)
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
  // CALCULO DEL RESUMEN FINANCIERO
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