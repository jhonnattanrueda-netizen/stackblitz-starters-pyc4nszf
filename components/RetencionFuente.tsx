'use client';

import { useState } from 'react';
import { FileSpreadsheet, Calculator, FileText, Search, AlertCircle, RefreshCw, UserCheck, Calendar, Percent } from 'lucide-react';
import * as XLSX from 'xlsx';
import { extraerBaseLimpiar } from '../lib/excel';

interface MovimientoRetencion {
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
  baseOrigen: 'DETALLE' | 'NOMINA' | 'SIN_BASE';
  debito: number;
  credito: number;
}

interface PeriodoAutorrenta {
  periodo: number;
  nombreMes: string;
  ingresos: number;
  totalPagado: number;
  calculo11: number;
}

const MAPA_MESES: Record<string, string> = {
  '01': 'ENERO',
  '02': 'FEBRERO',
  '03': 'MARZO',
  '04': 'ABRIL',
  '05': 'MAYO',
  '06': 'JUNIO',
  '07': 'JULIO',
  '08': 'AGOSTO',
  '09': 'SEPTIEMBRE',
  '10': 'OCTUBRE',
  '11': 'NOVIEMBRE',
  '12': 'DICIEMBRE',
};

export default function RetencionFuente() {
  const [fileName, setFileName] = useState<string | null>(null);
  const [nominaFileName, setNominaFileName] = useState<string | null>(null);
  const [erFileName, setErFileName] = useState<string | null>(null);

  const [movimientos, setMovimientos] = useState<MovimientoRetencion[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [cuentaFiltro, setCuentaFiltro] = useState<string>('TODAS');
  const [error, setError] = useState<string | null>(null);

  // Estados de Nómina
  const [pestañasNomina, setPestañasNomina] = useState<string[]>([]);
  const [pestañaSeleccionada, setPestañaSeleccionada] = useState<string>('');
  const [workbookNomina, setWorkbookNomina] = useState<XLSX.WorkBook | null>(null);

  // Estados de Autorrenta (1,1%)
  const [valorCuenta4Sistema, setValorCuenta4Sistema] = useState<number>(0);
  const [periodoActivoCalculo, setPeriodoActivoCalculo] = useState<number>(7);
  const [periodosAutorrenta, setPeriodosAutorrenta] = useState<PeriodoAutorrenta[]>([
    { periodo: 1, nombreMes: 'Enero', ingresos: 286729000, totalPagado: 3154000, calculo11: 3154019 },
    { periodo: 2, nombreMes: 'Febrero', ingresos: 357208000, totalPagado: 3929000, calculo11: 3929288 },
    { periodo: 3, nombreMes: 'Marzo', ingresos: 969833000, totalPagado: 10668000, calculo11: 10668163 },
    { periodo: 4, nombreMes: 'Abril', ingresos: 681436000, totalPagado: 7496000, calculo11: 7495796 },
    { periodo: 5, nombreMes: 'Mayo', ingresos: 795777000, totalPagado: 8754000, calculo11: 8753547 },
    { periodo: 6, nombreMes: 'Junio', ingresos: 644714000, totalPagado: 7092000, calculo11: 7091854 },
    { periodo: 7, nombreMes: 'Julio', ingresos: 0, totalPagado: 0, calculo11: 0 },
    { periodo: 8, nombreMes: 'Agosto', ingresos: 0, totalPagado: 0, calculo11: 0 },
    { periodo: 9, nombreMes: 'Septiembre', ingresos: 0, totalPagado: 0, calculo11: 0 },
    { periodo: 10, nombreMes: 'Octubre', ingresos: 0, totalPagado: 0, calculo11: 0 },
    { periodo: 11, nombreMes: 'Noviembre', ingresos: 0, totalPagado: 0, calculo11: 0 },
    { periodo: 12, nombreMes: 'Diciembre', ingresos: 0, totalPagado: 0, calculo11: 0 },
  ]);

  const detectarMesAuxiliar = (items: MovimientoRetencion[]): string => {
    for (const item of items) {
      if (item.fecha && item.fecha.includes('/')) {
        const partes = item.fecha.split('/');
        if (partes.length >= 2) {
          const numMes = partes[1].padStart(2, '0');
          if (MAPA_MESES[numMes]) return MAPA_MESES[numMes];
        }
      }
    }
    return 'JULIO';
  };

  // 1. Cargar Auxiliar Contable Siigo
  const handleFileUpload = async (file: File) => {
    try {
      setError(null);
      setFileName(file.name);

      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const rawData: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: true });

      const parsedItems: MovimientoRetencion[] = [];

      rawData.forEach((row, idx) => {
        if (!row || row.length < 10) return;

        const colA = String(row[0] ?? '').trim();
        const colALower = colA.toLowerCase();

        if (
          !colA ||
          colALower.includes('código contable') ||
          colALower.includes('cuenta contable') ||
          colALower.includes('total general') ||
          colALower.includes('procesado en')
        ) {
          return;
        }

        const cuentaNombre = String(row[1] ?? '').trim();
        const comprobante = String(row[2] ?? '').trim();
        const fecha = String(row[4] ?? '').trim();
        const nit = String(row[5] ?? '').trim().replace(/\./g, '').replace(/-/g, '');
        const tercero = String(row[7] ?? '').trim();
        const descripcion = String(row[8] ?? '').trim();
        const detalleRaw = String(row[9] ?? '').trim();

        const debito = parseFloat(String(row[12] ?? 0)) || 0;
        const credito = parseFloat(String(row[13] ?? 0)) || 0;

        const baseLimpia = extraerBaseLimpiar(detalleRaw);

        if (debito > 0 || credito > 0 || baseLimpia > 0) {
          parsedItems.push({
            id: `ret-${idx}`,
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

      if (workbookNomina) {
        const mesDetectado = detectarMesAuxiliar(parsedItems);
        const targetSheet = workbookNomina.SheetNames.find((s) => s.toUpperCase().trim() === mesDetectado) || workbookNomina.SheetNames[0];
        setPestañaSeleccionada(targetSheet);
        procesarCruceNomina(workbookNomina, parsedItems, targetSheet);
      }
    } catch (err) {
      setError('Error al procesar el archivo auxiliar de Retención en la Fuente.');
    }
  };

  // 2. Cargar Libro de Nómina de Apoyo
  const handleNominaUpload = async (file: File) => {
    try {
      if (movimientos.length === 0) {
        setError('Primero sube el archivo Auxiliar de Retención de Siigo.');
        return;
      }

      setError(null);
      setNominaFileName(file.name);

      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array' });
      setWorkbookNomina(wb);
      setPestañasNomina(wb.SheetNames);

      const mesDetectado = detectarMesAuxiliar(movimientos);
      const targetSheet = wb.SheetNames.find((s) => s.toUpperCase().trim() === mesDetectado) || wb.SheetNames[0];

      setPestañaSeleccionada(targetSheet);
      procesarCruceNomina(wb, movimientos, targetSheet);
    } catch (err) {
      setError('Error al leer el archivo de Nómina.');
    }
  };

  const procesarCruceNomina = (wb: XLSX.WorkBook, itemsBase: MovimientoRetencion[], sheetName: string) => {
    const worksheet = wb.Sheets[sheetName];
    if (!worksheet) return;

    const rawData: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: true });

    const mapaNitBase: Record<string, number> = {};
    const mapaNombreBase: Record<string, number> = {};

    rawData.forEach((row) => {
      if (!row || row.length < 14) return;

      const docNit = String(row[0] ?? '').trim().replace(/\./g, '').replace(/-/g, '');
      const nombreEmpleado = String(row[1] ?? '').trim().toUpperCase();
      const rawBaseColN = row[13];

      let baseNum = 0;
      if (rawBaseColN !== undefined && rawBaseColN !== null && String(rawBaseColN) !== '#ERROR!') {
        baseNum = parseFloat(String(rawBaseColN).replace(/,/g, '')) || 0;
      }

      if (docNit && docNit.length >= 5 && !isNaN(Number(docNit))) {
        mapaNitBase[docNit] = baseNum;
      }

      if (nombreEmpleado && nombreEmpleado.length > 3) {
        mapaNombreBase[nombreEmpleado] = baseNum;
      }
    });

    const movimientosActualizados = itemsBase.map((m) => {
      if (m.baseOrigen === 'DETALLE') return m;

      let baseEncontrada = 0;

      if (m.nit && mapaNitBase[m.nit] !== undefined) {
        baseEncontrada = mapaNitBase[m.nit];
      } else {
        const terceroUpper = m.tercero.toUpperCase();
        for (const [nomKey, baseVal] of Object.entries(mapaNombreBase)) {
          const tokensSiigo = terceroUpper.split(' ').filter((t) => t.length > 2);
          const tokensNomina = nomKey.split(' ').filter((t) => t.length > 2);
          const coincidencias = tokensSiigo.filter((t) => tokensNomina.includes(t));

          if (coincidencias.length >= 2) {
            baseEncontrada = baseVal;
            break;
          }
        }
      }

      if (baseEncontrada > 0) {
        return {
          ...m,
          baseLimpia: baseEncontrada,
          baseOrigen: 'NOMINA' as const,
        };
      }

      return {
        ...m,
        baseLimpia: 0,
        baseOrigen: 'SIN_BASE' as const,
      };
    });

    setMovimientos(movimientosActualizados);
  };

  // 3. Cargar Estado de Resultado Integral ANUAL para Autorrenta 1,1%
  const handleERFileUpload = async (file: File) => {
    try {
      setError(null);
      setErFileName(file.name);

      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const rawData: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: true });

      let valorIngresosCuenta4 = 0;

      for (let i = 0; i < rawData.length; i++) {
        const row = rawData[i];
        if (!row || row.length < 3) continue;

        const codCuenta = String(row[0] ?? '').trim();
        if (codCuenta === '4') {
          const rawVal = row[2]; // Columna C
          if (rawVal !== undefined && rawVal !== null) {
            valorIngresosCuenta4 = parseFloat(String(rawVal).replace(/,/g, '')) || 0;
          }
          break;
        }
      }

      setValorCuenta4Sistema(valorIngresosCuenta4);

      if (valorIngresosCuenta4 > 0) {
        calcularYActualizarAutorrenta(valorIngresosCuenta4, periodoActivoCalculo);
      }
    } catch (err) {
      setError('Error al procesar el Estado de Resultado Integral.');
    }
  };

  const calcularYActualizarAutorrenta = (totalAcumuladoER: number, pNum: number) => {
    const sumaIngresosAnteriores = periodosAutorrenta
      .filter((p) => p.periodo < pNum)
      .reduce((acc, p) => acc + p.ingresos, 0);

    const diferenciaPeriodo = totalAcumuladoER - sumaIngresosAnteriores;

    if (diferenciaPeriodo <= 0) return;

    // Aproximar al mil más cercano
    const ingresoAproximadoMil = Math.round(diferenciaPeriodo / 1000) * 1000;
    const calculoExacto11 = ingresoAproximadoMil * 0.011;
    const totalPagadoRedondeado = Math.round(calculoExacto11 / 1000) * 1000;

    setPeriodosAutorrenta((prev) =>
      prev.map((p) => {
        if (p.periodo === pNum) {
          return {
            ...p,
            ingresos: ingresoAproximadoMil,
            totalPagado: totalPagadoRedondeado,
            calculo11: Math.round(calculoExacto11),
          };
        }
        return p;
      })
    );
  };

  const handleCambioPestaña = (nuevaPestaña: string) => {
    setPestañaSeleccionada(nuevaPestaña);
    if (workbookNomina) {
      procesarCruceNomina(workbookNomina, movimientos, nuevaPestaña);
    }
  };

  const handleCambioPeriodoCalculo = (nuevoPeriodo: number) => {
    setPeriodoActivoCalculo(nuevoPeriodo);
    if (valorCuenta4Sistema > 0) {
      calcularYActualizarAutorrenta(valorCuenta4Sistema, nuevoPeriodo);
    }
  };

  const handleReset = () => {
    setMovimientos([]);
    setFileName(null);
    setNominaFileName(null);
    setErFileName(null);
    setPestañasNomina([]);
    setPestañaSeleccionada('');
    setWorkbookNomina(null);
    setValorCuenta4Sistema(0);
    setError(null);
  };

  const formatCOP = (val: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 2,
    }).format(val);
  };

  const cuentasUnicas = Array.from(new Set(movimientos.map((m) => m.cuentaCode)));

  const movimientosFiltrados = movimientos.filter((m) => {
    const cumpleCuenta = cuentaFiltro === 'TODAS' || m.cuentaCode === cuentaFiltro;
    const term = searchTerm.toLowerCase();
    const cumpleSearch =
      !searchTerm ||
      m.tercero.toLowerCase().includes(term) ||
      m.comprobante.toLowerCase().includes(term) ||
      m.cuentaCode.includes(term) ||
      m.detalleRaw.toLowerCase().includes(term);

    return cumpleCuenta && cumpleSearch;
  });

  const totalBase = movimientosFiltrados.reduce((acc, m) => acc + m.baseLimpia, 0);
  const totalCreditoRetenido = movimientosFiltrados.reduce((acc, m) => acc + m.credito, 0);
  const totalDebitoPagado = movimientosFiltrados.reduce((acc, m) => acc + m.debito, 0);

  const totalIngresosAcumuladoAutorrenta = periodosAutorrenta.reduce((acc, p) => acc + p.ingresos, 0);
  const totalAutorrentaCalculada = periodosAutorrenta.reduce((acc, p) => acc + p.calculo11, 0);
  const totalPagadoFormulario350 = periodosAutorrenta.reduce((acc, p) => acc + p.totalPagado, 0);
  const diferenciaConSistema = valorCuenta4Sistema - totalIngresosAcumuladoAutorrenta;

  return (
    <div className="space-y-6">
      {/* 1. Tarjetas de Carga de Archivos de Retención */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Archivo 1: Auxiliar Siigo */}
        <div className="bg-white p-6 rounded-2xl border-2 border-indigo-100 shadow-sm text-center flex flex-col items-center justify-between">
          <div>
            <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-2 border border-indigo-100">
              <Calculator className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-slate-800 text-xs">1. Auxiliar Retención Siigo</h3>
            <p className="text-[11px] text-slate-500 mt-1 mb-3">
              {fileName ? `✓ ${fileName}` : 'Sube el Excel de cuentas 2365 / 2367.'}
            </p>
          </div>

          <label className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-2 rounded-xl cursor-pointer transition-all shadow-md inline-flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4" />
            {fileName ? 'Cambiar Auxiliar' : 'Cargar Auxiliar'}
            <input type="file" accept=".xlsx, .xls" className="hidden" onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])} />
          </label>
        </div>

        {/* Archivo 2: Nómina de Apoyo */}
        <div className="bg-white p-6 rounded-2xl border-2 border-emerald-100 shadow-sm text-center flex flex-col items-center justify-between">
          <div>
            <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-2 border border-emerald-100">
              <UserCheck className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-slate-800 text-xs">2. Nómina de Apoyo</h3>
            <p className="text-[11px] text-slate-500 mt-1 mb-2">
              {nominaFileName ? `✓ ${nominaFileName}` : 'Carga la Nómina para extraer bases de empleados.'}
            </p>

            {pestañasNomina.length > 0 && (
              <div className="flex items-center justify-center gap-1.5 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg text-[11px]">
                <Calendar className="w-3 h-3 text-emerald-700" />
                <span className="font-bold text-emerald-900">Mes:</span>
                <select
                  value={pestañaSeleccionada}
                  onChange={(e) => handleCambioPestaña(e.target.value)}
                  className="bg-white border border-emerald-300 font-bold text-emerald-800 text-[11px] px-1.5 py-0.5 rounded outline-none"
                >
                  {pestañasNomina.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <label className={`text-white text-xs font-bold px-4 py-2 rounded-xl cursor-pointer transition-all shadow-md inline-flex items-center gap-2 mt-2 ${movimientos.length === 0 ? 'bg-slate-300 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-700'}`}>
            <FileSpreadsheet className="w-4 h-4" />
            {nominaFileName ? 'Cambiar Nómina' : 'Cargar Nómina'}
            <input type="file" accept=".xlsx, .xls" disabled={movimientos.length === 0} className="hidden" onChange={(e) => e.target.files?.[0] && handleNominaUpload(e.target.files[0])} />
          </label>
        </div>

        {/* Archivo 3: Estado de Resultados (Autorrenta 1,1%) */}
        <div className="bg-white p-6 rounded-2xl border-2 border-blue-100 shadow-sm text-center flex flex-col items-center justify-between">
          <div>
            <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-2 border border-blue-100">
              <Percent className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-slate-800 text-xs">3. Estado de Resultados (Autorrenta)</h3>
            <p className="text-[11px] text-slate-500 mt-1 mb-2">
              {erFileName ? `✓ ${erFileName}` : 'Extrae Cuenta 4 Columna C para liquidar Autorrenta 1,1%.'}
            </p>

            {valorCuenta4Sistema > 0 && (
              <div className="flex items-center justify-center gap-1.5 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-lg text-[11px]">
                <span className="font-bold text-blue-900">Periodo:</span>
                <select
                  value={periodoActivoCalculo}
                  onChange={(e) => handleCambioPeriodoCalculo(Number(e.target.value))}
                  className="bg-white border border-blue-300 font-bold text-blue-800 text-[11px] px-1.5 py-0.5 rounded outline-none"
                >
                  {periodosAutorrenta.map((p) => (
                    <option key={p.periodo} value={p.periodo}>
                      P{p.periodo} ({p.nombreMes})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <label className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-2 rounded-xl cursor-pointer transition-all shadow-md inline-flex items-center gap-2 mt-2">
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

      {/* 2. Sección de Autorrenta 1,1% (Formulario 350) */}
      {valorCuenta4Sistema > 0 && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Percent className="w-5 h-5 text-indigo-600" />
              <h3 className="font-bold text-slate-800 text-sm">Liquidación de Autorretención Especial (1,1%)</h3>
            </div>
            <span className="text-xs font-bold text-slate-500">
              Ingresos Cuenta 4 ER: <span className="text-indigo-700 font-mono text-sm">{formatCOP(valorCuenta4Sistema)}</span>
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
              <span className="text-[11px] font-bold text-slate-500 uppercase block">Ingreso Base Mes (Aprox. Mil)</span>
              <div className="text-xl font-black text-slate-900 mt-1">
                {formatCOP(periodosAutorrenta.find((p) => p.periodo === periodoActivoCalculo)?.ingresos || 0)}
              </div>
              <span className="text-[10px] text-slate-400 block mt-0.5">Diferencia acumulada del periodo {periodoActivoCalculo}</span>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
              <span className="text-[11px] font-bold text-emerald-600 uppercase block">Autorrenta 1,1% Calculada</span>
              <div className="text-xl font-black text-emerald-700 mt-1">
                {formatCOP(periodosAutorrenta.find((p) => p.periodo === periodoActivoCalculo)?.calculo11 || 0)}
              </div>
              <span className="text-[10px] text-emerald-600 block mt-0.5">Cálculo exacto (1,1%)</span>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
              <span className="text-[11px] font-bold text-indigo-600 uppercase block">Total Pagado Formulario 350</span>
              <div className="text-xl font-black text-indigo-900 mt-1">
                {formatCOP(periodosAutorrenta.find((p) => p.periodo === periodoActivoCalculo)?.totalPagado || 0)}
              </div>
              <span className="text-[10px] text-indigo-500 block mt-0.5">Redondeado al mil más cercano</span>
            </div>
          </div>
        </div>
      )}

      {/* 3. Resultados de Retenciones a Terceros */}
      {movimientos.length > 0 && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-indigo-100 shadow-sm">
              <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider block">
                Base Gravable Total Terceros
              </span>
              <div className="text-2xl font-black text-indigo-900 mt-1">{formatCOP(totalBase)}</div>
              <span className="text-[11px] text-indigo-500 mt-0.5 block">
                Base Siigo + Nómina ({pestañaSeleccionada || 'Auto'})
              </span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-emerald-100 bg-emerald-50/20 shadow-sm">
              <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider block">
                Impuesto Retenido (Crédito)
              </span>
              <div className="text-2xl font-black text-emerald-700 mt-1">{formatCOP(totalCreditoRetenido)}</div>
              <span className="text-[11px] text-emerald-600 mt-0.5 block">
                Total retenido a terceros
              </span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-blue-100 bg-blue-50/20 shadow-sm">
              <span className="text-xs font-bold text-blue-600 uppercase tracking-wider block">
                Ajustes / Débitos
              </span>
              <div className="text-2xl font-black text-blue-700 mt-1">{formatCOP(totalDebitoPagado)}</div>
              <span className="text-[11px] text-blue-500 mt-0.5 block">
                Comprobantes de pago o cancelación
              </span>
            </div>
          </div>

          <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap justify-between items-center gap-3">
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-slate-600">Cuenta:</span>
              <select
                value={cuentaFiltro}
                onChange={(e) => setCuentaFiltro(e.target.value)}
                className="bg-slate-50 border border-slate-300 text-xs px-3 py-2 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold"
              >
                <option value="TODAS">Todas las Cuentas ({movimientos.length})</option>
                {cuentasUnicas.map((c) => (
                  <option key={c} value={c}>
                    Cuenta {c}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleReset}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-xl transition-all"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Limpiar Todo
              </button>

              <div className="relative w-full sm:w-64">
                <input
                  type="text"
                  placeholder="Buscar por tercero, NIT..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="bg-slate-50 border border-slate-300 text-xs pl-8 pr-3 py-2 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 w-full font-medium"
                />
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="bg-indigo-700 text-white p-4 font-bold text-sm flex justify-between items-center">
              <span className="flex items-center gap-2">
                <FileText className="w-4 h-4" /> Detalle de Cuentas, Bases y Retenciones
              </span>
              <span className="bg-indigo-600 px-2.5 py-1 rounded-lg text-xs">
                {movimientosFiltrados.length} registros
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                    <th className="p-3">Cuenta</th>
                    <th className="p-3">Fecha</th>
                    <th className="p-3">Comprobante</th>
                    <th className="p-3">Tercero / NIT</th>
                    <th className="p-3">Origen Base</th>
                    <th className="p-3 text-right text-indigo-700 bg-indigo-50/50">Base Extraída / Nómina</th>
                    <th className="p-3 text-right text-emerald-700">Retención (Crédito)</th>
                    <th className="p-3 text-right text-blue-700">Débito</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {movimientosFiltrados.map((m) => (
                    <tr key={m.id} className="hover:bg-slate-50 font-medium">
                      <td className="p-3 font-bold text-slate-700">{m.cuentaCode}</td>
                      <td className="p-3 font-mono text-slate-500">{m.fecha}</td>
                      <td className="p-3 font-bold text-indigo-600">{m.comprobante}</td>
                      <td className="p-3">
                        <p className="font-bold text-slate-800 truncate max-w-[200px]">{m.tercero}</p>
                        <p className="text-[10px] text-slate-400">NIT: {m.nit}</p>
                      </td>
                      <td className="p-3">
                        {m.baseOrigen === 'DETALLE' ? (
                          <span className="inline-block bg-slate-100 text-slate-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                            Detalle Siigo
                          </span>
                        ) : m.baseOrigen === 'NOMINA' ? (
                          <span className="inline-block bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                            ✓ Nómina ({pestañaSeleccionada})
                          </span>
                        ) : (
                          <span className="inline-block bg-rose-50 text-rose-600 text-[10px] font-bold px-2 py-0.5 rounded-full">
                            Sin Base
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-right font-mono font-bold text-indigo-700 bg-indigo-50/30">
                        {m.baseLimpia > 0 ? formatCOP(m.baseLimpia) : '-'}
                      </td>
                      <td className="p-3 text-right font-mono font-bold text-emerald-600">
                        {m.credito > 0 ? formatCOP(m.credito) : '-'}
                      </td>
                      <td className="p-3 text-right font-mono font-bold text-blue-600">
                        {m.debito > 0 ? formatCOP(m.debito) : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}