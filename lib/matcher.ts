import { BankTransaction, SiigoTransaction, ConciliationItem, ConciliationSummary } from '../types/conciliacion';

// Función para calcular similitud de palabras entre la descripción del banco y el tercero/observación de Siigo
const calcularScoreTexto = (descBanco: string, terceroSiigo: string, obsSiigo: string): number => {
  const bUpper = (descBanco || '').toUpperCase();
  const sUpper = ((terceroSiigo || '') + ' ' + (obsSiigo || '')).toUpperCase();

  const tokensBanco = bUpper.split(/[\s\-_,.]+/).filter((t) => t.length > 2);
  if (tokensBanco.length === 0) return 0;

  let coincidencias = 0;
  tokensBanco.forEach((token) => {
    if (sUpper.includes(token)) {
      coincidencias++;
    }
  });

  return coincidencias / tokensBanco.length;
};

export const conciliarMovimientos = (
  bankTransactions: BankTransaction[],
  siigoTransactions: SiigoTransaction[]
): { items: ConciliationItem[]; summary: ConciliationSummary } => {
  const conciliationItems: ConciliationItem[] = [];
  const matchedBankIds = new Set<string>();
  const matchedSiigoIds = new Set<string>();

  // -------------------------------------------------------------
  // FASE 1: Coincidencia 1:1 con Prioridad por Tercero y Tolerancia de Centavos ($2 COP)
  // -------------------------------------------------------------
  bankTransactions.forEach((bankTx) => {
    if (matchedBankIds.has(bankTx.id)) return;

    // Buscar todos los candidatos en Siigo con misma naturaleza (DEBITO/CREDITO) y diff < $2 COP
    const candidatos = siigoTransactions.filter((siigoTx) => {
      if (matchedSiigoIds.has(siigoTx.id)) return false;
      const mismaNaturaleza = bankTx.tipo === siigoTx.tipo;
      const diferenciaMonto = Math.abs(bankTx.monto - siigoTx.monto);
      return mismaNaturaleza && diferenciaMonto <= 2.0; // Tolerancia de $2 pesos
    });

    if (candidatos.length > 0) {
      // Ordenar candidatos dando prioridad a la mejor coincidencia de texto/tercero
      candidatos.sort((a, bCand) => {
        const scoreA = calcularScoreTexto(bankTx.descripcion, a.tercero, a.observaciones);
        const scoreB = calcularScoreTexto(bankTx.descripcion, bCand.tercero, bCand.observaciones);
        return scoreB - scoreA;
      });

      const mejorSiigo = candidatos[0];
      const scoreObtenido = calcularScoreTexto(bankTx.descripcion, mejorSiigo.tercero, mejorSiigo.observaciones);

      matchedBankIds.add(bankTx.id);
      matchedSiigoIds.add(mejorSiigo.id);

      const diffMonto = Math.abs(bankTx.monto - mejorSiigo.monto);

      conciliationItems.push({
        id: `match-${bankTx.id}-${mejorSiigo.id}`,
        bankTransaction: bankTx,
        siigoTransaction: mejorSiigo,
        estado: 'CONCILIADO',
        diferencia: diffMonto,
        motivo:
          scoreObtenido > 0
            ? 'Coincidencia exacta 1:1 por monto y tercero'
            : diffMonto > 0
            ? 'Coincidencia 1:1 con ajuste menor de decimales'
            : 'Coincidencia exacta 1:1 por monto',
      });
    }
  });

  // -------------------------------------------------------------
  // FASE 2: Agrupación N:1 (Varios del Banco -> 1 de Siigo)
  // -------------------------------------------------------------
  const unconciliatedSiigoN1 = siigoTransactions.filter((s) => !matchedSiigoIds.has(s.id));
  const unconciliatedBankN1 = bankTransactions.filter((b) => !matchedBankIds.has(b.id));

  unconciliatedSiigoN1.forEach((siigoTx) => {
    if (matchedSiigoIds.has(siigoTx.id)) return;

    const bankCandidates = unconciliatedBankN1.filter(
      (b) => !matchedBankIds.has(b.id) && b.tipo === siigoTx.tipo
    );

    let foundBankGroup: BankTransaction[] | null = null;

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
          motivo: `Suma agrupada banco (${group.length} pagos banco = 1 asiento Siigo)`,
        });
      });
    }
  });

  // -------------------------------------------------------------
  // FASE 3: Agrupación 1:N (1 del Banco -> Varios de Siigo)
  // -------------------------------------------------------------
  const unconciliatedBank1N = bankTransactions.filter((b) => !matchedBankIds.has(b.id));
  const unconciliatedSiigo1N = siigoTransactions.filter((s) => !matchedSiigoIds.has(s.id));

  unconciliatedBank1N.forEach((bankTx) => {
    if (matchedBankIds.has(bankTx.id)) return;

    const siigoCandidates = unconciliatedSiigo1N.filter(
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
  // FASE 4: Agrupación N:M (Varios del Banco -> Varios de Siigo)
  // -------------------------------------------------------------
  const remainingBank = bankTransactions.filter((b) => !matchedBankIds.has(b.id));
  const remainingSiigo = siigoTransactions.filter((s) => !matchedSiigoIds.has(s.id));

  ['CREDITO', 'DEBITO'].forEach((tipoActual) => {
    const bankGroup = remainingBank.filter((b) => b.tipo === tipoActual && !matchedBankIds.has(b.id));
    const siigoGroup = remainingSiigo.filter((s) => s.tipo === tipoActual && !matchedSiigoIds.has(s.id));

    for (let bCount = 2; bCount <= 4; bCount++) {
      if (bankGroup.length < bCount) continue;

      const getBankCombos = (arr: BankTransaction[], k: number): BankTransaction[][] => {
        if (k === 0) return [[]];
        if (arr.length === 0) return [];
        const head = arr[0];
        const tail = arr.slice(1);
        const withHead = getBankCombos(tail, k - 1).map((c) => [head, ...c]);
        const withoutHead = getBankCombos(tail, k);
        return [...withHead, ...withoutHead];
      };

      const bankCombos = getBankCombos(bankGroup.filter((b) => !matchedBankIds.has(b.id)), bCount);

      for (const bCombo of bankCombos) {
        if (bCombo.some((b) => matchedBankIds.has(b.id))) continue;
        const targetSum = bCombo.reduce((acc, b) => acc + b.monto, 0);

        const availSiigo = siigoGroup.filter((s) => !matchedSiigoIds.has(s.id));
        let matchSiigoCombo: SiigoTransaction[] | null = null;

        const getSiigoCombo = (start: number, current: SiigoTransaction[], sum: number, k: number) => {
          if (matchSiigoCombo) return;
          if (current.length === k) {
            if (Math.abs(sum - targetSum) < 0.01) {
              matchSiigoCombo = [...current];
            }
            return;
          }
          for (let i = start; i < availSiigo.length; i++) {
            const s = availSiigo[i];
            if (sum + s.monto <= targetSum + 0.01) {
              getSiigoCombo(i + 1, [...current, s], sum + s.monto, k);
            }
          }
        };

        for (let sCount = 2; sCount <= 5; sCount++) {
          getSiigoCombo(0, [], 0, sCount);
          if (matchSiigoCombo) break;
        }

        if (matchSiigoCombo) {
          const sCombo: SiigoTransaction[] = matchSiigoCombo;
          bCombo.forEach((b) => matchedBankIds.add(b.id));
          sCombo.forEach((s) => matchedSiigoIds.add(s.id));

          bCombo.forEach((b, bIdx) => {
            sCombo.forEach((s, sIdx) => {
              conciliationItems.push({
                id: `match-nm-${b.id}-${s.id}`,
                bankTransaction: sIdx === 0 ? b : undefined,
                siigoTransaction: bIdx === 0 ? s : undefined,
                estado: 'CONCILIADO',
                diferencia: 0,
                motivo: `Cruce por suma agrupada global N:M ($${targetSum.toLocaleString('es-CO')})`,
              });
            });
          });
          break;
        }
      }
    }
  });

  // -------------------------------------------------------------
  // FASE 5: Movimientos Pendientes
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

  const totalBancoDebito = bankTransactions.filter((b) => b.tipo === 'DEBITO').reduce((acc, b) => acc + b.monto, 0);
  const totalBancoCredito = bankTransactions.filter((b) => b.tipo === 'CREDITO').reduce((acc, b) => acc + b.monto, 0);
  const totalSiigoDebito = siigoTransactions.filter((s) => s.tipo === 'DEBITO').reduce((acc, s) => acc + s.monto, 0);
  const totalSiigoCredito = siigoTransactions.filter((s) => s.tipo === 'CREDITO').reduce((acc, s) => acc + s.monto, 0);

  const summary: ConciliationSummary = {
    totalBanco: totalBancoDebito - totalBancoCredito,
    totalSiigo: totalSiigoDebito - totalSiigoCredito,
    diferenciaTotal: Math.abs((totalBancoDebito - totalBancoCredito) - (totalSiigoDebito - totalSiigoCredito)),
    totalConciliados: conciliationItems.filter((item) => item.estado === 'CONCILIADO').length,
    totalPendientesBanco: conciliationItems.filter((item) => item.estado === 'PENDIENTE_BANCO').length,
    totalPendientesSiigo: conciliationItems.filter((item) => item.estado === 'PENDIENTE_SIIGO').length,
  };

  return { items: conciliationItems, summary };
};