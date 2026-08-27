import * as XLSX from 'xlsx';
import { BankTransaction, SiigoTransaction } from '../types/conciliacion';

// 1. Procesamiento del Extracto Bancario
export const parseBankExcel = async (file: File): Promise<BankTransaction[]> => {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const worksheet = workbook.Sheets[workbook.SheetNames[0]];
  const rawData: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
  const transactions: BankTransaction[] = [];

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

// 2. Procesamiento del Auxiliar por Cuenta Contable de Siigo
export const parseSiigoAuxiliarExcel = async (file: File): Promise<SiigoTransaction[]> => {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const worksheet = workbook.Sheets[workbook.SheetNames[0]];
  const rawData: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
  const items: SiigoTransaction[] = [];

  // Encontrar la fila del encabezado ("Código contable")
  let headerIndex = -1;
  for (let i = 0; i < rawData.length; i++) {
    const row = rawData[i];
    if (row && String(row[0] || '').toLowerCase().includes('código contable')) {
      headerIndex = i;
      break;
    }
  }

  const rowsToProcess = headerIndex !== -1 ? rawData.slice(headerIndex + 1) : rawData;

  rowsToProcess.forEach((row, idx) => {
    if (!row || row.length < 14) return;

    const codCuenta = String(row[0] || '').trim();
    if (!codCuenta || codCuenta.toLowerCase().includes('cuenta contable')) return;

    const comprobante = String(row[2] || '').trim();
    const fecha = String(row[4] || '').trim();
    const tercero = String(row[7] || '').trim();
    const descripcion = String(row[8] || '').trim();
    
    // Lectura explícita de Débito (columna 12) y Crédito (columna 13)
    const valDebito = parseFloat(row[12]) || 0;
    const valCredito = parseFloat(row[13]) || 0;

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