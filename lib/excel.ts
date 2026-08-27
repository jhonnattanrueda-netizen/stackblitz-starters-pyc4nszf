import * as XLSX from 'xlsx';
import { BankTransaction, SiigoTransaction } from '../types/conciliacion';

// Parser para Extracto o Preliminar Bancario
export const parseBankExcel = async (file: File): Promise<BankTransaction[]> => {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const worksheet = workbook.Sheets[workbook.SheetNames[0]];
  const rawData: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
  const transactions: BankTransaction[] = [];

  if (rawData.length === 0) return [];

  const isPreliminar = rawData.some((row) => {
    return (
      row &&
      row.length >= 9 &&
      typeof row[3] === 'number' &&
      typeof row[4] === 'number' &&
      typeof row[5] === 'number' &&
      typeof row[6] === 'number'
    );
  });

  if (isPreliminar) {
    rawData.forEach((row, index) => {
      if (!row || row.length < 9) return;

      const dia = parseInt(row[3], 10);
      const mes = parseInt(row[4], 10);
      const ano = parseInt(row[5], 10);
      const valorRaw = row[6];
      const descripcion = String(row[8] || '').trim();
      const refExtra = String(row[9] || 'N/A').trim();

      if (!isNaN(dia) && !isNaN(mes) && !isNaN(ano) && descripcion && valorRaw !== undefined) {
        const fechaFormatted = `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
        const montoNum = Math.abs(Number(valorRaw) || 0);
        const esNegativo = Number(valorRaw) < 0;

        if (montoNum > 0) {
          transactions.push({
            id: `bank-prelim-${index}-${Date.now()}`,
            fecha: fechaFormatted,
            referencia: refExtra !== 'undefined' ? refExtra : 'N/A',
            descripcion: descripcion,
            monto: montoNum,
            tipo: esNegativo ? 'CREDITO' : 'DEBITO',
          });
        }
      }
    });

    return transactions;
  }

  let headerRowIndex = -1;
  for (let i = 0; i < rawData.length; i++) {
    const row = rawData[i];
    if (row && row.some((cell) => String(cell).toUpperCase().includes('FECHA') || String(cell).toUpperCase().includes('DESCRIPCI'))) {
      headerRowIndex = i;
      break;
    }
  }

  const dataRows = headerRowIndex !== -1 ? rawData.slice(headerRowIndex + 1) : rawData;

  dataRows.forEach((row, index) => {
    if (!row || row.length < 2) return;

    const fechaRaw = String(row[0] || '').trim();
    const descripcion = String(row[1] || '').trim();
    let valorRaw = row[4] !== undefined ? row[4] : row[3];

    if (!descripcion || descripcion.toUpperCase().includes('DESCRIPCION') || fechaRaw.toUpperCase().includes('FECHA')) {
      return;
    }

    let montoNum = 0;
    let esNegativo = false;

    if (typeof valorRaw === 'number') {
      montoNum = Math.abs(valorRaw);
      esNegativo = valorRaw < 0;
    } else if (typeof valorRaw === 'string') {
      const cleanStr = valorRaw.replace(/\$/g, '').replace(/\s/g, '').trim();
      esNegativo = cleanStr.includes('-') || cleanStr.startsWith('-');
      const numStr = cleanStr.replace(/-/g, '').replace(/\./g, '').replace(',', '.');
      montoNum = parseFloat(numStr) || 0;
    }

    if (montoNum > 0) {
      transactions.push({
        id: `bank-${index}-${Date.now()}`,
        fecha: fechaRaw,
        referencia: String(row[3] || 'N/A').trim(),
        descripcion: descripcion,
        monto: montoNum,
        tipo: esNegativo ? 'CREDITO' : 'DEBITO',
      });
    }
  });

  return transactions;
};

// Parser Dinámico Ultra-Robusto para Movimientos Auxiliares de Siigo
export const parseSiigoAuxiliarExcel = async (file: File): Promise<SiigoTransaction[]> => {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const worksheet = workbook.Sheets[workbook.SheetNames[0]];
  const rawData: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
  const items: SiigoTransaction[] = [];

  let headerIndex = -1;
  let idxDebito = -1;
  let idxCredito = -1;
  let idxComprobante = 2;
  let idxFecha = 4;
  let idxTercero = 7;

  // 1. Identificar la fila de nombres de columna
  for (let i = 0; i < rawData.length; i++) {
    const row = rawData[i];
    if (row && row.some((c) => String(c || '').toLowerCase().includes('código contable') || String(c || '').toLowerCase().includes('comprobante'))) {
      headerIndex = i;
      row.forEach((cellVal, colIdx) => {
        const strVal = String(cellVal || '').toLowerCase();
        if (strVal.includes('débito') || strVal.includes('debito')) idxDebito = colIdx;
        if (strVal.includes('crédito') || strVal.includes('credito')) idxCredito = colIdx;
        if (strVal.includes('comprobante')) idxComprobante = colIdx;
        if (strVal.includes('fecha')) idxFecha = colIdx;
        if (strVal.includes('tercero') || strVal.includes('nombre')) idxTercero = colIdx;
      });
      break;
    }
  }

  const rowsToProcess = headerIndex !== -1 ? rawData.slice(headerIndex + 1) : rawData;

  rowsToProcess.forEach((row, idx) => {
    if (!row || row.length < 5) return;

    const codCuenta = String(row[0] ?? '').trim();
    const codLower = codCuenta.toLowerCase();

    if (
      !codCuenta ||
      codLower.includes('código contable') ||
      codLower.includes('cuenta contable') ||
      codLower.includes('total general') ||
      codLower.includes('procesado en')
    ) {
      return;
    }

    const comprobante = String(row[idxComprobante] ?? row[2] ?? '').trim();
    const fecha = String(row[idxFecha] ?? row[4] ?? '').trim();
    const tercero = String(row[idxTercero] ?? row[7] ?? '').trim();
    const descripcion = String(row[8] ?? '').trim();

    let valDebito = 0;
    let valCredito = 0;

    // Si los índices dinámicos de las columnas Débito/Crédito fueron encontrados en la cabecera:
    if (idxDebito !== -1 && row[idxDebito] !== undefined) {
      valDebito = parseFloat(String(row[idxDebito]).replace(/\./g, '').replace(',', '.')) || Number(row[idxDebito]) || 0;
    }
    if (idxCredito !== -1 && row[idxCredito] !== undefined) {
      valCredito = parseFloat(String(row[idxCredito]).replace(/\./g, '').replace(',', '.')) || Number(row[idxCredito]) || 0;
    }

    // Fallback: Si no se extrajeron por encabezado, escanear valores numéricos en la fila
    if (valDebito === 0 && valCredito === 0) {
      const numbersInRow: { col: number; val: number }[] = [];
      row.forEach((cellVal, cIdx) => {
        if (cIdx >= 5 && typeof cellVal === 'number' && cellVal > 0) {
          numbersInRow.push({ col: cIdx, val: cellVal });
        }
      });

      // Tomar el valor numérico correspondiente al movimiento
      if (numbersInRow.length > 0) {
        const lastNum = numbersInRow[0];
        // Determinar por ubicación o estructura de columnas
        if (lastNum.col === 11 || lastNum.col === 12) {
          valDebito = lastNum.val;
        } else if (lastNum.col === 13) {
          valCredito = lastNum.val;
        }
      }
    }

    if (valDebito > 0) {
      items.push({
        id: `siigo-aux-${idx}-d`,
        fecha,
        comprobante,
        tercero,
        observaciones: descripcion,
        monto: valDebito,
        tipo: 'DEBITO',
        cuentaCode: codCuenta,
      });
    } else if (valCredito > 0) {
      items.push({
        id: `siigo-aux-${idx}-c`,
        fecha,
        comprobante,
        tercero,
        observaciones: descripcion,
        monto: valCredito,
        tipo: 'CREDITO',
        cuentaCode: codCuenta,
      });
    }
  });

  return items;
};