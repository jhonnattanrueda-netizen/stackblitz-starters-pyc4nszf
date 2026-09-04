'use client';

import { useState } from 'react';
import { FileSpreadsheet, Building2, FileText, Search, AlertCircle, RefreshCw, Download, Calculator, Grid, DollarSign } from 'lucide-react';
import * as XLSX from 'xlsx';
import { extraerBaseLimpiar } from '../lib/excel';

interface MovimientoIndustriaComercio {
  id: string;
  cuentaCode: string;
  cuentaNombre: string;
  comprobante: string;
  fecha: string;
  nit: string;
  tercero: string;
  descripcion: string;
  detalleRaw: string;
  baseLimpia: number;
  baseOrigen: 'DETALLE' | 'SIN_BASE';
  debito: number;
  credito: number;
}

export default function IndustriaComercio() {
  const [fileName, setFileName] = useState<string | null>(null);
  const [erFileName, setErFileName] = useState<string | null>(null);

  const [movimientos, setMovimientos] = useState<MovimientoIndustriaComercio[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [cuentaFiltro, setCuentaFiltro] = useState<string>('TODAS');
  const [error, setError] = useState<string | null>(null);

  // Valores de Sistema desde el Estado de Resultados (Columna C)
  const [cuenta4Sistema, setCuenta4Sistema] = useState<number>(0);
  const [cuenta4180_42Sistema, setCuenta4180_42Sistema] = useState<number>(0);
  const [cuenta4175Sistema, setCuenta4175Sistema] = useState<number>(0);

  // Configuración de la Declaración Bimestral / Periodo
  const [periodoDeclaracion, setPeriodoDeclaracion] = useState<number>(4);

  // Entradas Manuales de Saldos Anteriores (Fila "Total Acumulado")
  const [totalAcumBase, setTotalAcumBase] = useState<number>(3735697000);
  const [totalAcumBA, setTotalAcumBA] = useState<number>(4810695000);
  const [totalAcumBB, setTotalAcumBB] = useState<number>(1074998000);
  const [totalAcumBI, setTotalAcumBI] = useState<number>(33882000);

  // Entrada Manual: Valor acumulado anterior de Retenciones SIN APROXIMAR AL MIL
  const [acumAnteriorSinAproximarBI, setAcumAnteriorSinAproximarBI] = useState<number>(33882995);

  // Configuración de Tarifa Distrito e Impuestos Adicionales
  const [tarifaDistrito, setTarifaDistrito] = useState<number>(0.00966);
  const [sobretasaBomberil, setSobretasaBomberil] = useState<number>(0);

  // 1. Cargar Auxiliar Contable de ReteICA (Cuentas 135518)
  const handleFileUpload = async (file: File) => {
    try {
      setError(null);
      setFileName(file.name);

      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const rawData: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: true });

      const parsedItems: MovimientoIndustriaComercio[] = [];

      rawData.forEach((row, idx) => {
        if (!row || row.length < 10) return;

        const colA = String(row[0] ?? '').trim();
        if (!colA.startsWith('135518')) return;

        const cuentaNombre = String(row[1] ?? '').trim();
        const comprobante = String(row[2] ?? '').trim();
        const fecha = String(row[4] ?? '').trim();
        const nit = String(row[5] ?? '').trim();
        const tercero = String(row[7] ?? '').trim();
        const descripcion = String(row[8] ?? '').trim();
        const detalleRaw = String(row[9] ?? '').trim();

        const debito = parseFloat(String(row[12] ?? 0)) || 0;
        const credito = parseFloat(String(row[13] ?? 0)) || 0;

        const baseLimpia = extraerBaseLimpiar(detalleRaw);

        if (debito > 0 || credito > 0 || baseLimpia > 0) {
          parsedItems.push({
            id: `ica-135518-${idx}`,
            cuentaCode: colA,
            cuentaNombre,
            comprobante,
            fecha,
            nit,
            tercero,
            descripcion,
            detalleRaw,
            baseLimpia,
            baseOrigen: baseLimpia > 0 ? 'DETALLE' : 'SIN_BASE',
            debito,
            credito,
          });
        }
      });

      setMovimientos(parsedItems);
    } catch (err) {
      setError('Error al procesar el archivo auxiliar de la cuenta 135518.');
    }
  };

  // 2. Cargar Estado de Resultado Integral
  const handleERFileUpload = async (file: File) => {
    try {
      setError(null);
      setErFileName(file.name);

      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const rawData: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: true });

      let valC4 = 0;
      let valC4180 = 0;
      let valC42 = 0;
      let valC4175 = 0;

      for (let i = 0; i < rawData.length; i++) {
        const row = rawData[i];
        if (!row || row.length < 3) continue;

        const codCuenta = String(row[0] ?? '').trim();
        const rawVal = row[2];
        const valNum = rawVal !== undefined && rawVal !== null ? parseFloat(String(rawVal).replace(/,/g, '')) || 0 : 0;

        if (codCuenta === '4') valC4 = valNum;
        else if (codCuenta === '4180') valC4180 = valNum;
        else if (codCuenta === '42') valC42 = valNum;
        else if (codCuenta === '4175') valC4175 = Math.abs(valNum);
      }

      setCuenta4Sistema(valC4);
      setCuenta4180_42Sistema(valC4180 + valC42);
      setCuenta4175Sistema(valC4175);
    } catch (err) {
      setError('Error al procesar el Estado de Resultado Integral.');
    }
  };

  const handleReset = () => {
    setMovimientos([]);
    setFileName(null);
    setErFileName(null);
    setCuenta4Sistema(0);
    setCuenta4180_42Sistema(0);
    setCuenta4175Sistema(0);
    setError(null);
    setSearchTerm('');
    setCuentaFiltro('TODAS');
  };

  const formatCOP = (val: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 2,
    }).format(val);
  };

  // --------------------------------------------------------------------------
  // EXTRAER VALORES POR TARIFA DESDE EL MOVIMIENTO AUXILIAR
  // --------------------------------------------------------------------------
  const movTarifa966 = movimientos.filter((m) => m.cuentaCode.includes('13551805') || m.descripcion.includes('9.66'));
  const brutoAuxiliar966 = movTarifa966.reduce((acc, m) => acc + m.debito, 0);
  const devolucionesAuxiliar966 = movTarifa966.reduce((acc, m) => acc + m.credito, 0);

  const movTarifa69 = movimientos.filter((m) => m.descripcion.includes('6.9'));
  const brutoAuxiliar69 = movTarifa69.reduce((acc, m) => acc + m.debito, 0);
  const devolucionesAuxiliar69 = movTarifa69.reduce((acc, m) => acc + m.credito, 0);

  // Movimiento Auxiliar Periodo Total = Total Débito - Total Crédito
  const totalRetencionDebito = movimientos.reduce((acc, m) => acc + m.debito, 0);
  const totalDevolucionCredito = movimientos.reduce((acc, m) => acc + m.credito, 0);
  const auxiliarPeriodoBI = totalRetencionDebito - totalDevolucionCredito;

  // 🔴 Sistema BI (Rojo) = Anterior Sin Aproximar + Auxiliar Periodo
  const biRetencionesSistema = acumAnteriorSinAproximarBI + auxiliarPeriodoBI;

  const redondearAlMil = (val: number) => (val > 0 ? Math.round(val / 1000) * 1000 : 0);

  // 🟢 Periodo X (Verde)
  const baseGravablePeriodo = redondearAlMil(cuenta4Sistema - totalAcumBase);
  const baIngOrdPeriodo = redondearAlMil(cuenta4180_42Sistema - totalAcumBA);
  const bbDevolucionesPeriodo = redondearAlMil(cuenta4175Sistema - totalAcumBB);
  const biRetencionesPeriodo = redondearAlMil(biRetencionesSistema - totalAcumBI);

  // Diferencias
  const diffBase = Math.round(cuenta4Sistema - (totalAcumBase + baseGravablePeriodo));
  const diffBA = Math.round(cuenta4180_42Sistema - (totalAcumBA + baIngOrdPeriodo));
  const diffBB = Math.round(cuenta4175Sistema - (totalAcumBB + bbDevolucionesPeriodo));
  const diffBI = Math.round(biRetencionesSistema - (totalAcumBI + biRetencionesPeriodo));

  // --------------------------------------------------------------------------
  // CÁLCULO DEL IMPUESTO DISTRITO ICA (CÁLCULO AUTOMÁTICO SECCIÓN AZUL)
  // --------------------------------------------------------------------------
  const icaGeneradoDistritoExacto = baseGravablePeriodo * tarifaDistrito;
  const icaGeneradoDistritoAprox = redondearAlMil(icaGeneradoDistritoExacto);

  const totalRetencionesPeriodoAprox = redondearAlMil(biRetencionesPeriodo);

  const totalAPagarNetoExacto = icaGeneradoDistritoExacto - totalRetencionesPeriodoAprox;
  const totalAPagarNetoAprox = redondearAlMil(totalAPagarNetoExacto);

  const totalAPagarFinalExacto = totalAPagarNetoExacto + sobretasaBomberil;
  const totalAPagarFinalAprox = redondearAlMil(totalAPagarFinalExacto);

  const cuentasUnicas = Array.from(new Set(movimientos.map((m) => m.cuentaCode)));

  const movimientosFiltrados = movimientos.filter((m) => {
    const cumpleCuenta = cuentaFiltro === 'TODAS' || m.cuentaCode === cuentaFiltro;
    const term = searchTerm.toLowerCase();
    const cumpleSearch =
      !searchTerm ||
      m.tercero.toLowerCase().includes(term) ||
      m.comprobante.toLowerCase().includes(term) ||
      m.cuentaCode.includes(term) ||
      m.nit.includes(term) ||
      m.detalleRaw.toLowerCase().includes(term);

    return cumpleCuenta && cumpleSearch;
  });

  const totalBaseExtraida = movimientosFiltrados.reduce((acc, m) => acc + m.baseLimpia, 0);

  // Exportar a Excel
  const exportarExcel = () => {
    if (movimientosFiltrados.length === 0) return;

    const rows = [
      ['DECLARACIÓN Y LIQUIDACIÓN DE INDUSTRIA Y COMERCIO (ICA)'],
      ['Periodo:', periodoDeclaracion],
      [''],
      ['CONCEPTO', 'BASE GRAVABLE', '(BA) ING ORD Y NO OPE', '(BB) DEVOLUCIONES', '(BI) RETENCIONES'],
      [`Periodo ${periodoDeclaracion}`, baseGravablePeriodo, baIngOrdPeriodo, bbDevolucionesPeriodo, biRetencionesPeriodo],
      ['Total Acumulado', totalAcumBase, totalAcumBA, totalAcumBB, totalAcumBI],
      ['Sistema', cuenta4Sistema, cuenta4180_42Sistema, cuenta4175Sistema, biRetencionesSistema],
      ['Diferencia', diffBase, diffBA, diffBB, diffBI],
      [''],
      ['LIQUIDACIÓN Y TARIFAS DEL IMPUESTO'],
      ['Tarifa 9.66 por mil (Auxiliar):', brutoAuxiliar966],
      ['(-) Devoluciones Tarifa 9.66 (Auxiliar):', devolucionesAuxiliar966],
      ['Tarifa 6.9 por mil (Auxiliar):', brutoAuxiliar69],
      ['(-) Devoluciones Tarifa 6.9 (Auxiliar):', devolucionesAuxiliar69],
      [''],
      ['CÁLCULO IMPUESTO DISTRITO'],
      ['Base Gravable Periodo:', baseGravablePeriodo],
      ['Impuesto ICA Generado (Base * 9.66/1000):', icaGeneradoDistritoAprox],
      ['Total Retenciones (BI) Periodo:', totalRetencionesPeriodoAprox],
      ['Total a Pagar Neto:', totalAPagarNetoAprox],
      ['Sobretasa Bomberil:', sobretasaBomberil],
      ['TOTAL A PAGAR FINAL:', totalAPagarFinalAprox],
      [''],
      ['DETALLE DE MOVIMIENTOS 135518'],
      ['Cuenta', 'Fecha', 'Comprobante', 'NIT', 'Tercero', 'Origen Base', 'Base Extraída', 'Retención (Débito)', 'Devolución (Crédito)'],
    ];

    movimientosFiltrados.forEach((m) => {
      rows.push([
        m.cuentaCode,
        m.fecha,
        m.comprobante,
        m.nit,
        m.tercero,
        m.baseOrigen,
        m.baseLimpia,
        m.debito,
        m.credito,
      ]);
    });

    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'ReteICA');
    XLSX.writeFile(wb, `Liquidacion_ICA_Periodo_${periodoDeclaracion}.xlsx`);
  };

  return (
    <div className="space-y-6">
      {/* Tarjetas de Carga de Archivos */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
        <div className="bg-white p-6 rounded-2xl border-2 border-indigo-100 shadow-sm text-center flex flex-col items-center justify-between">
          <div>
            <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-2 border border-indigo-100">
              <Building2 className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-slate-800 text-xs">1. Auxiliar ReteICA (Cuenta 135518)</h3>
            <p className="text-[11px] text-slate-500 mt-1 mb-3">
              {fileName ? `✓ ${fileName} (${movimientos.length} reg.)` : 'Sube el Excel de auxiliares 135518.'}
            </p>
          </div>

          <label className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-2 rounded-xl cursor-pointer transition-all shadow-md inline-flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4" />
            {fileName ? 'Cambiar Auxiliar' : 'Cargar Auxiliar 135518'}
            <input type="file" accept=".xlsx, .xls" className="hidden" onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])} />
          </label>
        </div>

        <div className="bg-white p-6 rounded-2xl border-2 border-blue-100 shadow-sm text-center flex flex-col items-center justify-between">
          <div>
            <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-2 border border-blue-100">
              <Calculator className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-slate-800 text-xs">2. Estado de Resultados (Cuentas 4, 4180, 42, 4175)</h3>
            <p className="text-[11px] text-slate-500 mt-1 mb-3">
              {erFileName ? `✓ ${erFileName}` : 'Sube el Estado de Resultado Integral.'}
            </p>
          </div>

          <label className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-2 rounded-xl cursor-pointer transition-all shadow-md inline-flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4" />
            {erFileName ? 'Cambiar Estado Resultados' : 'Cargar Estado Resultados'}
            <input type="file" accept=".xlsx, .xls" className="hidden" onChange={(e) => e.target.files?.[0] && handleERFileUpload(e.target.files[0])} />
          </label>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm font-medium">{error}</span>
        </div>
      )}

      {/* 1. CUADRO DE CONCILIACIÓN Y LIQUIDACIÓN BIMESTRAL */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="bg-slate-800 text-white p-4 font-bold text-sm flex justify-between items-center">
          <span className="flex items-center gap-2">
            <Grid className="w-4 h-4 text-indigo-400" /> LIQUIDACIÓN Y CONCILIACIÓN INDUSTRIA Y COMERCIO (ICA)
          </span>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-300">Periodo / Bimestre:</span>
            <select
              value={periodoDeclaracion}
              onChange={(e) => setPeriodoDeclaracion(Number(e.target.value))}
              className="bg-slate-700 text-white border border-slate-600 font-mono font-bold text-xs px-2 py-1 rounded-lg outline-none cursor-pointer"
            >
              {[1, 2, 3, 4, 5, 6].map((p) => (
                <option key={p} value={p}>
                  Periodo {p}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold">
                <th className="p-3 w-32">CONCEPTO</th>
                <th className="p-3 text-right">BASE GRAVABLE</th>
                <th className="p-3 text-right">(BA) ING ORD Y NO OPE</th>
                <th className="p-3 text-right">(BB) DEVOLUCIONES</th>
                <th className="p-3 text-right">(BI) RETENCIONES</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {/* 🟢 Fila Verde: Periodo X */}
              <tr className="bg-indigo-50/60 font-bold text-indigo-950">
                <td className="p-3 font-bold flex items-center gap-1.5">
                  <span className="bg-indigo-600 text-white px-2 py-0.5 rounded text-[10px]">
                    Periodo {periodoDeclaracion}
                  </span>
                </td>
                <td className="p-3 text-right font-mono text-sm text-indigo-900 font-black">
                  {formatCOP(baseGravablePeriodo)}
                </td>
                <td className="p-3 text-right font-mono text-sm text-indigo-900 font-black">
                  {formatCOP(baIngOrdPeriodo)}
                </td>
                <td className="p-3 text-right font-mono text-sm text-indigo-900 font-black">
                  {formatCOP(bbDevolucionesPeriodo)}
                </td>
                <td className="p-3 text-right font-mono text-sm text-emerald-700 font-black bg-emerald-50/60 rounded-lg">
                  {formatCOP(biRetencionesPeriodo)}
                </td>
              </tr>

              {/* 🟡 Fila Amarilla: Total Acumulado Anterior */}
              <tr className="bg-slate-50 font-bold text-slate-700">
                <td className="p-3 font-bold">Total Acumulado</td>
                <td className="p-3 text-right">
                  <input
                    type="number"
                    value={totalAcumBase}
                    onChange={(e) => setTotalAcumBase(Number(e.target.value) || 0)}
                    className="w-32 bg-white border border-slate-300 font-mono font-bold text-right px-2 py-1 rounded outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </td>
                <td className="p-3 text-right">
                  <input
                    type="number"
                    value={totalAcumBA}
                    onChange={(e) => setTotalAcumBA(Number(e.target.value) || 0)}
                    className="w-32 bg-white border border-slate-300 font-mono font-bold text-right px-2 py-1 rounded outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </td>
                <td className="p-3 text-right">
                  <input
                    type="number"
                    value={totalAcumBB}
                    onChange={(e) => setTotalAcumBB(Number(e.target.value) || 0)}
                    className="w-32 bg-white border border-slate-300 font-mono font-bold text-right px-2 py-1 rounded outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </td>
                <td className="p-3 text-right bg-amber-50/50">
                  <input
                    type="number"
                    value={totalAcumBI}
                    onChange={(e) => setTotalAcumBI(Number(e.target.value) || 0)}
                    placeholder="Acumulado al mil"
                    className="w-32 bg-amber-100/70 border border-amber-300 font-mono font-bold text-right px-2 py-1 rounded outline-none focus:ring-2 focus:ring-amber-500 text-amber-950"
                  />
                </td>
              </tr>

              {/* 🔴 Fila Roja: Sistema */}
              <tr className="bg-white font-bold text-slate-800">
                <td className="p-3 font-bold text-slate-600">Sistema</td>
                <td className="p-3 text-right font-mono text-slate-900">{formatCOP(cuenta4Sistema)}</td>
                <td className="p-3 text-right font-mono text-slate-900">{formatCOP(cuenta4180_42Sistema)}</td>
                <td className="p-3 text-right font-mono text-slate-900">{formatCOP(cuenta4175Sistema)}</td>
                
                <td className="p-3 text-right bg-rose-50/50 rounded-lg">
                  <div className="flex items-center justify-end gap-2">
                    <span className="text-[10px] text-rose-500 font-normal">Ant. exacto:</span>
                    <input
                      type="number"
                      step="0.01"
                      value={acumAnteriorSinAproximarBI}
                      onChange={(e) => setAcumAnteriorSinAproximarBI(Number(e.target.value) || 0)}
                      placeholder="33882995"
                      className="w-28 bg-white border border-rose-200 font-mono text-xs font-bold text-right px-1.5 py-0.5 rounded outline-none focus:ring-2 focus:ring-rose-400 text-slate-800"
                    />
                    <span className="font-mono text-rose-700 font-bold text-xs whitespace-nowrap">
                      = {formatCOP(biRetencionesSistema)}
                    </span>
                  </div>
                </td>
              </tr>

              {/* Fila Diferencia */}
              <tr className="bg-slate-100 font-black text-slate-900 border-t-2 border-slate-300">
                <td className="p-3 uppercase">Diferencia</td>
                <td className={`p-3 text-right font-mono ${diffBase !== 0 ? 'text-rose-600' : 'text-slate-500'}`}>
                  {diffBase}
                </td>
                <td className={`p-3 text-right font-mono ${diffBA !== 0 ? 'text-rose-600' : 'text-slate-500'}`}>
                  {diffBA}
                </td>
                <td className={`p-3 text-right font-mono ${diffBB !== 0 ? 'text-rose-600' : 'text-slate-500'}`}>
                  {diffBB}
                </td>
                <td className={`p-3 text-right font-mono ${diffBI !== 0 ? 'text-rose-600' : 'text-slate-500'}`}>
                  {diffBI}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* 2. PANEL DE LIQUIDACIÓN Y TARIFAS DEL IMPUESTO A DECLARAR */}
      <div className="bg-white rounded-2xl border-2 border-amber-300 shadow-sm overflow-hidden">
        <div className="bg-amber-600 text-white p-3.5 font-bold text-xs flex justify-between items-center">
          <span className="flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-amber-200" /> LIQUIDACIÓN Y TARIFAS DEL IMPUESTO A DECLARAR
          </span>
          <span className="bg-amber-700 px-2.5 py-1 rounded-lg font-mono">Borrador Formulario ICA</span>
        </div>

        <div className="p-4 grid grid-cols-1 lg:grid-cols-2 gap-6 text-xs font-medium">
          {/* SECCIÓN IZQUIERDA (AMARILLO): INFORMACIÓN EXTRAÍDA DEL MOVIMIENTO AUXILIAR POR CUENTA */}
          <div className="space-y-3 border-r border-slate-200 pr-0 lg:pr-6">
            <div className="flex justify-between items-center bg-amber-50/70 p-2.5 rounded-xl border border-amber-200">
              <span className="font-bold text-amber-950">Tarifa 9.66 por mil (Auxiliar 13551805):</span>
              <span className="font-mono text-amber-900 font-bold text-sm">{formatCOP(brutoAuxiliar966)}</span>
            </div>

            <div className="flex justify-between items-center pl-3 pr-1">
              <span className="text-slate-600">(-) Devoluciones Tarifa 9.66 (Auxiliar):</span>
              <span className="font-mono font-bold text-rose-600">
                {devolucionesAuxiliar966 > 0 ? `- ${formatCOP(devolucionesAuxiliar966)}` : '$ 0'}
              </span>
            </div>

            <div className="flex justify-between items-center bg-slate-50 p-2.5 rounded-xl border border-slate-200">
              <span className="font-bold text-slate-700">Tarifa 6.9 por mil (Auxiliar):</span>
              <span className="font-mono text-slate-900 font-bold">{formatCOP(brutoAuxiliar69)}</span>
            </div>

            <div className="flex justify-between items-center pl-3 pr-1">
              <span className="text-slate-600">(-) Devoluciones Tarifa 6.9 (Auxiliar):</span>
              <span className="font-mono font-bold text-rose-600">
                {devolucionesAuxiliar69 > 0 ? `- ${formatCOP(devolucionesAuxiliar69)}` : '$ 0'}
              </span>
            </div>
          </div>

          {/* SECCIÓN DERECHA (AZUL/PURPURA): CÁLCULO AUTOMÁTICO DE IMPUESTO ICA DISTRITO */}
          <div className="space-y-2">
            <div className="flex justify-between items-center bg-slate-50 p-2 rounded-lg font-bold text-slate-700">
              <span>TOTAL RETENCIONES (BI) PERIODO:</span>
              <span className="font-mono text-emerald-700 text-sm font-black">
                {formatCOP(totalRetencionesPeriodoAprox)} <span className="text-[10px] text-slate-400 font-normal">Aprox</span>
              </span>
            </div>

            <div className="flex justify-between items-center bg-indigo-50 p-2 rounded-lg font-bold text-indigo-950">
              <span>BASE GRAVABLE PERIODO:</span>
              <span className="font-mono text-indigo-900 font-black">
                {formatCOP(baseGravablePeriodo)}
              </span>
            </div>

            {/* IMPUESTO ICA GENERADO EN AZUL/MAGENTA: Base Gravable Periodo * 0,00966 Aprox. al mil */}
            <div className="flex justify-between items-center bg-purple-100/80 p-2.5 rounded-xl font-bold text-purple-950 border border-purple-300">
              <span className="text-purple-900 font-black">IMPUESTO ICA GENERADO (9,66/1000):</span>
              <span className="font-mono text-purple-900 font-black text-sm">
                {formatCOP(icaGeneradoDistritoAprox)} <span className="text-[10px] text-purple-600 font-normal">Aprox</span>
              </span>
            </div>

            <div className="flex justify-between items-center bg-slate-50 p-2 rounded-lg font-bold text-slate-700">
              <span>TOTAL A PAGAR NETO:</span>
              <span className="font-mono text-slate-900 font-black">
                {formatCOP(totalAPagarNetoAprox)} <span className="text-[10px] text-slate-400 font-normal">Aprox</span>
              </span>
            </div>

            <div className="flex justify-between items-center pl-2">
              <span className="font-bold text-slate-600">Sobretasa Bomberil:</span>
              <input
                type="number"
                value={sobretasaBomberil}
                onChange={(e) => setSobretasaBomberil(Number(e.target.value) || 0)}
                placeholder="0"
                className="w-32 bg-white border border-slate-300 font-mono text-right px-2 py-0.5 rounded outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="flex justify-between items-center bg-emerald-600 text-white p-2.5 rounded-xl font-black text-sm shadow">
              <span>TOTAL A PAGAR FINAL:</span>
              <span className="font-mono text-yellow-300 font-black text-base">
                {formatCOP(totalAPagarFinalAprox)} <span className="text-[10px] text-emerald-200 font-normal">Aprox</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. TABLA DE DETALLE DE MOVIMIENTOS 135518 */}
      {movimientos.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="bg-indigo-800 text-white p-4 font-bold text-sm flex justify-between items-center">
            <span className="flex items-center gap-2">
              <FileText className="w-4 h-4" /> MOVIMIENTOS AUXILIARES 135518
            </span>
            <div className="flex items-center gap-3">
              <button
                onClick={exportarExcel}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow transition-all cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" /> Descargar Excel
              </button>
              <span className="bg-indigo-700 px-2.5 py-1 rounded-lg text-xs font-mono">
                {movimientosFiltrados.length} registros
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                  <th className="p-3">Cuenta</th>
                  <th className="p-3">Fecha</th>
                  <th className="p-3">Comprobante</th>
                  <th className="p-3">NIT</th>
                  <th className="p-3">Tercero</th>
                  <th className="p-3">Origen Base</th>
                  <th className="p-3 text-right text-indigo-700 bg-indigo-50/50">Base Extraída</th>
                  <th className="p-3 text-right text-emerald-700">Retención (Débito)</th>
                  <th className="p-3 text-right text-rose-700">Devolución (Crédito)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {movimientosFiltrados.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-50">
                    <td className="p-3 font-bold text-slate-700">{m.cuentaCode}</td>
                    <td className="p-3 font-mono text-slate-500">{m.fecha}</td>
                    <td className="p-3 font-bold text-indigo-600">{m.comprobante}</td>
                    <td className="p-3 font-mono text-slate-600">{m.nit}</td>
                    <td className="p-3 font-bold text-slate-800 truncate max-w-[200px]">{m.tercero}</td>
                    <td className="p-3">
                      {m.baseOrigen === 'DETALLE' ? (
                        <span className="inline-block bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                          DETALLE
                        </span>
                      ) : (
                        <span className="inline-block bg-slate-100 text-slate-600 text-[10px] font-bold px-2 py-0.5 rounded-full">
                          SIN_BASE
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-right font-mono font-bold text-indigo-700 bg-indigo-50/30">
                      {m.baseLimpia > 0 ? formatCOP(m.baseLimpia) : '-'}
                    </td>
                    <td className="p-3 text-right font-mono font-bold text-emerald-600">
                      {m.debito > 0 ? formatCOP(m.debito) : '-'}
                    </td>
                    <td className="p-3 text-right font-mono font-bold text-rose-600">
                      {m.credito > 0 ? formatCOP(m.credito) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-800 font-black text-white text-xs">
                  <td className="p-3" colSpan={6}>
                    TOTALES AUXILIAR 135518
                  </td>
                  <td className="p-3 text-right font-mono text-indigo-300">{formatCOP(totalBaseExtraida)}</td>
                  <td className="p-3 text-right font-mono text-emerald-400">{formatCOP(totalRetencionDebito)}</td>
                  <td className="p-3 text-right font-mono text-rose-300">{formatCOP(totalDevolucionCredito)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}