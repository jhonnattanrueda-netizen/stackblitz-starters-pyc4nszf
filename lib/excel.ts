import * as XLSX from 'xlsx';
import { BankTransaction } from '../types/conciliacion';

export const parseBankExcel = (file: File): Promise<BankTransaction[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Convertimos a matriz 2D con tipado explícito
        const rawMatrix = XLSX.utils.sheet_to_json<Array<string | number>>(worksheet, { header: 1, defval: '' });

        if (!rawMatrix || rawMatrix.length === 0) {
          resolve([]);
          return;
        }

        let headerRowIndex = -1;
        let colFechaIdx = -1;
        let colDescIdx = -1;
        let colRefIdx = -1;
        let colMontoIdx = -1;
        let colDebitoIdx = -1;
        let colCreditoIdx = -1;

        // Escaneo de filas para ubicar encabezados
        for (let i = 0; i < Math.min(rawMatrix.length, 25); i++) {
          const rowStr = rawMatrix[i].map((c) => String(c).toUpperCase().trim());
          
          const fIdx = rowStr.findIndex((c) => c.includes('FECHA') || c.includes('DATE'));
          const mIdx = rowStr.findIndex((c) => c.includes('MONTO') || c.includes('VALOR') || c.includes('IMPORTE'));
          const dIdx = rowStr.findIndex((c) => c.includes('DEBITO') || c.includes('DÉBITO') || c.includes('EGRESO') || c.includes('RETIRO'));
          const cIdx = rowStr.findIndex((c) => c.includes('CREDITO') || c.includes('CRÉDITO') || c.includes('INGRESO') || c.includes('DEPOSITO'));

          if (fIdx !== -1 && (mIdx !== -1 || dIdx !== -1 || cIdx !== -1)) {
            headerRowIndex = i;
            colFechaIdx = fIdx;
            colMontoIdx = mIdx;
            colDebitoIdx = dIdx;
            colCreditoIdx = cIdx;
            colDescIdx = rowStr.findIndex((c) => c.includes('DESCRIP') || c.includes('CONCEPTO') || c.includes('DETALLE') || c.includes('LEYENDA'));
            colRefIdx = rowStr.findIndex((c) => c.includes('REF') || c.includes('DOC') || c.includes('NRO') || c.includes('COMPROBANTE'));
            break;
          }
        }

        const transactions: BankTransaction[] = [];
        const startRow = headerRowIndex !== -1 ? headerRowIndex + 1 : 0;

        for (let i = startRow; i < rawMatrix.length; i++) {
          const row = rawMatrix[i];
          if (!row || row.length === 0) continue;

          let fecha = colFechaIdx !== -1 ? String(row[colFechaIdx] || '').trim() : '';
          let descripcion = colDescIdx !== -1 ? String(row[colDescIdx] || '').trim() : '';
          let referencia = colRefIdx !== -1 ? String(row[colRefIdx] || '').trim() : '';

          if (headerRowIndex === -1) {
            row.forEach((cell) => {
              const strVal = String(cell).trim();
              if (strVal.match(/\d{2,4}[-/\.]\d{1,2}[-/\.]\d{2,4}/) && !fecha) {
                fecha = strVal;
              } else if (strVal.length > 5 && isNaN(Number(strVal)) && !descripcion) {
                descripcion = strVal;
              }
            });
          }

          let monto = 0;
          let tipo: 'DEBITO' | 'CREDITO' = 'CREDITO';

          if (colMontoIdx !== -1 && row[colMontoIdx] !== undefined) {
            const rawVal = String(row[colMontoIdx]).replace(/[^0-9.-]/g, '');
            const numVal = parseFloat(rawVal);
            if (!isNaN(numVal) && numVal !== 0) {
              monto = Math.abs(numVal);
              tipo = numVal < 0 ? 'DEBITO' : 'CREDITO';
            }
          } else if (colDebitoIdx !== -1 || colCreditoIdx !== -1) {
            const rawDeb = colDebitoIdx !== -1 ? String(row[colDebitoIdx] || '').replace(/[^0-9.-]/g, '') : '';
            const rawCred = colCreditoIdx !== -1 ? String(row[colCreditoIdx] || '').replace(/[^0-9.-]/g, '') : '';
            
            const numDeb = parseFloat(rawDeb) || 0;
            const numCred = parseFloat(rawCred) || 0;

            if (numDeb > 0) {
              monto = Math.abs(numDeb);
              tipo = 'DEBITO';
            } else if (numCred > 0) {
              monto = Math.abs(numCred);
              tipo = 'CREDITO';
            }
          } else {
            row.forEach((cell) => {
              const raw = String(cell).replace(/[^0-9.-]/g, '');
              const num = parseFloat(raw);
              if (!isNaN(num) && Math.abs(num) > 100 && monto === 0) {
                monto = Math.abs(num);
                tipo = num < 0 ? 'DEBITO' : 'CREDITO';
              }
            });
          }

          if (monto > 0 || descripcion !== '') {
            transactions.push({
              id: `bank-${i}-${Date.now()}`,
              fecha: fecha || '2026-08-01',
              referencia: referencia || 'N/A',
              descripcion: descripcion || 'Movimiento Bancario',
              monto,
              tipo,
            });
          }
        }

        resolve(transactions);
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = (error) => reject(error);
    reader.readAsArrayBuffer(file);
  });
};