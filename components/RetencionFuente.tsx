'use client';

import { useState } from 'react';
import { FileSpreadsheet, Calculator, FileText, Search, AlertCircle, RefreshCw, UserCheck, Calendar, Percent, Grid } from 'lucide-react';
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
  tipoPersona: 'NATURAL' | 'JURIDICA';
  debito: number;
  credito: number;
}

interface RowCuadroDIAN {
  concepto: string;
  natBase: number;
  natRet: number;
  jurBase: number;
  jurRet: number;
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

// Determinar si es Persona Jurídica o Natural
const evaluarTipoPersona = (nit: string, cuentaCode: string): 'NATURAL' | 'JURIDICA' => {
  if (cuentaCode.startsWith('236505') || cuentaCode.startsWith('236506')) return 'NATURAL'; // Rentas de Trabajo
  const nitClean = nit.replace(/\./g, '').replace(/-/g, '').trim();
  if (nitClean.length >= 9 && (nitClean.startsWith('8') || nitClean.startsWith('9'))) {
    return 'JURIDICA';
  }
  return 'NATURAL';
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

  // Autorrenta 1,1%
  const [valorCuenta4Sistema, setValorCuenta4Sistema] = useState<number>(0);
  const [periodoActivoCalculo, setPeriodoActivoCalculo] = useState<number>(7);
  const [ingresoPeriodoAutorrenta, setIngresoPeriodoAutorrenta] = useState<number>(537632000);
  const [autorrentaFormulario, setAutorrentaFormulario] = useState<number>(5914000);

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
        const nit = String(row[5] ?? '').trim();
        const tercero = String(row[7] ?? '').trim();
        const descripcion = String(row[8] ?? '').trim();
        const detalleRaw = String(row[9] ?? '').trim();

        const debito = parseFloat(String(row[12] ?? 0)) || 0;
        const credito = parseFloat(String(row[13] ?? 0)) || 0;

        const baseLimpia = extraerBaseLimpiar(detalleRaw);
        const tipoPersona = evaluarTipoPersona(nit, colA);

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
            tipoPersona,
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

      if (m.nit && mapaNitBase[m.nit.replace(/\./g, '').replace(/-/g, '')] !== undefined) {
        baseEncontrada = mapaNitBase[m.nit.replace(/\./g, '').replace(/-/g, '')];
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

  // 3. Cargar Estado de Resultado Integral ANUAL para Autorrenta
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
          const rawVal = row[2];
          if (rawVal !== undefined && rawVal !== null) {
            valorIngresosCuenta4 = parseFloat(String(rawVal).replace(/,/g, '')) || 0;
          }
          break;
        }
      }

      setValorCuenta4Sistema(valorIngresosCuenta4);

      if (valorIngresosCuenta4 > 0) {
        const sumaAnteriores = 3735697000; // Enero a Junio
        const diff = valorIngresosCuenta4 - sumaAnteriores;
        if (diff > 0) {
          const ingAprox = Math.round(diff / 1000) * 1000;
          const calc11 = ingAprox * 0.011;
          const pagAprox = Math.round(calc11 / 1000) * 1000;
          setIngresoPeriodoAutorrenta(ingAprox);
          setAutorrentaFormulario(pagAprox);
        }
      }
    } catch (err) {
      setError('Error al procesar el Estado de Resultado Integral.');
    }
  };

  const handleCambioPestaña = (nuevaPestaña: string) => {
    setPestañaSeleccionada(nuevaPestaña);
    if (workbookNomina) {
      procesarCruceNomina(workbookNomina, movimientos, nuevaPestaña);
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

  // --------------------------------------------------------------------------
  // CONSTRUCCIÓN DEL CUADRO COMPARATIVO FORMULARIO 350 (DIAN)
  // --------------------------------------------------------------------------
  const generarCuadroDIAN = (): RowCuadroDIAN[] => {
    const conceptos: Record<string, RowCuadroDIAN> = {
      TRABAJO: { concepto: 'TRABAJO (236505 y 236506)', natBase: 0, natRet: 0, jurBase: 0, jurRet: 0 },
      HONORARIOS: { concepto: 'HONORARIOS (236515)', natBase: 0, natRet: 0, jurBase: 0, jurRet: 0 },
      SERVICIOS: { concepto: 'SERVICIOS (236525)', natBase: 0, natRet: 0, jurBase: 0, jurRet: 0 },
      ARR_MUEBLES: { concepto: 'ARRENDAMIENTO MUEBLES (23653001)', natBase: 0, natRet: 0, jurBase: 0, jurRet: 0 },
      ARR_INMUEBLES: { concepto: 'ARRENDAMIENTO INMUEBLES (23653003)', natBase: 0, natRet: 0, jurBase: 0, jurRet: 0 },
      COMPRAS: { concepto: 'COMPRAS (236540)', natBase: 0, natRet: 0, jurBase: 0, jurRet: 0 },
      RENDIMIENTOS: { concepto: 'RENDIMIENTOS FINANCIEROS (236545)', natBase: 0, natRet: 0, jurBase: 0, jurRet: 0 },
    };

    movimientos.forEach((m) => {
      if (m.tercero.toUpperCase().includes('DIAN')) return;

      const esNat = m.tipoPersona === 'NATURAL';
      const cCode = m.cuentaCode;

      let key = '';
      // Agrupa 236505 (Salarios) y 236506 (Servicios Personales)
      if (cCode.startsWith('236505') || cCode.startsWith('236506')) key = 'TRABAJO';
      else if (cCode.startsWith('236515')) key = 'HONORARIOS';
      else if (cCode.startsWith('236525')) key = 'SERVICIOS';
      else if (cCode.startsWith('23653001')) key = 'ARR_MUEBLES';
      else if (cCode.startsWith('23653003')) key = 'ARR_INMUEBLES';
      else if (cCode.startsWith('236540')) key = 'COMPRAS';
      else if (cCode.startsWith('236545')) key = 'RENDIMIENTOS';

      if (key && conceptos[key]) {
        if (esNat) {
          conceptos[key].natBase += m.baseLimpia;
          conceptos[key].natRet += m.credito;
        } else {
          conceptos[key].jurBase += m.baseLimpia;
          conceptos[key].jurRet += m.credito;
        }
      }
    });

    return Object.values(conceptos);
  };

  const cuadroDIAN = generarCuadroDIAN();

  // Discriminación Individual de ReteIVA
  const reteIVA15 = movimientos.filter(
    (m) => m.cuentaCode === '23670101' && !m.tercero.toUpperCase().includes('DIAN')
  );
  const reteIVA100 = movimientos.filter(
    (m) => m.cuentaCode === '23670103' && !m.tercero.toUpperCase().includes('DIAN')
  );

  const baseReteIVA15 = reteIVA15.reduce((acc, m) => acc + m.baseLimpia, 0);
  const retReteIVA15 = reteIVA15.reduce((acc, m) => acc + m.credito, 0);

  const baseReteIVA100 = reteIVA100.reduce((acc, m) => acc + m.baseLimpia, 0);
  const retReteIVA100 = reteIVA100.reduce((acc, m) => acc + m.credito, 0);

  const totalRetencionesTerceros = cuadroDIAN.reduce((acc, r) => acc + r.natRet + r.jurRet, 0);
  const totalReteIVATotal = retReteIVA15 + retReteIVA100;
  const totalGeneralBruto = totalRetencionesTerceros + autorrentaFormulario + totalReteIVATotal;
  const totalGeneralAproxDIAN = Math.round(totalGeneralBruto / 1000) * 1000;

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

  return (
    <div className="space-y-6">
      {/* 1. Tarjetas de Carga */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
                  className="bg-white border border-emerald-300 font-bold text-emerald-800 text-[11px] px-1.5 py-0.5 rounded outline-none cursor-pointer"
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

        <div className="bg-white p-6 rounded-2xl border-2 border-blue-100 shadow-sm text-center flex flex-col items-center justify-between">
          <div>
            <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-2 border border-blue-100">
              <Percent className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-slate-800 text-xs">3. Estado de Resultados (Autorrenta)</h3>
            <p className="text-[11px] text-slate-500 mt-1 mb-2">
              {erFileName ? `✓ ${erFileName}` : 'Extrae Cuenta 4 para liquidar Autorrenta 1,1%.'}
            </p>
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

      {/* 2. CUADRO DISCRIMINADO: PERSONA NATURAL VS PERSONA JURÍDICA */}
      {movimientos.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden space-y-0">
          <div className="bg-slate-800 text-white p-4 font-bold text-sm flex justify-between items-center">
            <span className="flex items-center gap-2">
              <Grid className="w-4 h-4 text-indigo-400" /> DISCRIMINACIÓN RETENCIÓN EN LA FUENTE (PERSONA NATURAL VS JURÍDICA)
            </span>
            <span className="bg-slate-700 px-3 py-1 rounded-lg text-xs font-mono">Formulario 350 DIAN</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold">
                  <th className="p-3 border-r border-slate-200" colSpan={3}>
                    PERSONA NATURAL
                  </th>
                  <th className="p-3 text-center border-r border-slate-200" colSpan={3}>
                    PERSONA JURÍDICA
                  </th>
                </tr>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                  <th className="p-2.5">CONCEPTO</th>
                  <th className="p-2.5 text-right">BASE</th>
                  <th className="p-2.5 text-right border-r border-slate-200">RETENCIÓN</th>
                  <th className="p-2.5">CONCEPTO</th>
                  <th className="p-2.5 text-right">BASE</th>
                  <th className="p-2.5 text-right">RETENCIÓN</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {cuadroDIAN.map((r, idx) => (
                  <tr key={idx} className="hover:bg-slate-50">
                    <td className="p-2.5 font-bold text-slate-700">{r.concepto}</td>
                    <td className="p-2.5 text-right font-mono">{r.natBase > 0 ? formatCOP(r.natBase) : '-'}</td>
                    <td className="p-2.5 text-right font-mono font-bold text-emerald-700 border-r border-slate-200">
                      {r.natRet > 0 ? formatCOP(r.natRet) : '-'}
                    </td>
                    <td className="p-2.5 font-bold text-slate-700">{r.concepto}</td>
                    <td className="p-2.5 text-right font-mono">{r.jurBase > 0 ? formatCOP(r.jurBase) : '-'}</td>
                    <td className="p-2.5 text-right font-mono font-bold text-emerald-700">
                      {r.jurRet > 0 ? formatCOP(r.jurRet) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-100 font-black text-slate-800 border-t-2 border-slate-300">
                  <td className="p-2.5" colSpan={2}>
                    SUBTOTAL RETENCIONES A TERCEROS
                  </td>
                  <td className="p-2.5 text-right font-mono text-emerald-800 border-r border-slate-200" colSpan={4}>
                    {formatCOP(totalRetencionesTerceros)}
                  </td>
                </tr>
                <tr className="bg-blue-50/60 font-bold text-blue-900">
                  <td className="p-2.5" colSpan={2}>
                    AUTORRETENCIÓN ESPECIAL (1,1%)
                  </td>
                  <td className="p-2.5 text-right font-mono text-blue-900" colSpan={2}>
                    Base: {formatCOP(ingresoPeriodoAutorrenta)}
                  </td>
                  <td className="p-2.5 text-right font-mono font-black text-blue-900" colSpan={2}>
                    {formatCOP(autorrentaFormulario)}
                  </td>
                </tr>

                {/* FILA SEPARADA 1: ReteIVA 15% (Cuenta 23670101) */}
                <tr className="bg-emerald-50/40 font-bold text-emerald-900">
                  <td className="p-2.5" colSpan={2}>
                    RETEIVA 15% (Cuenta 23670101)
                  </td>
                  <td className="p-2.5 text-right font-mono text-emerald-900" colSpan={2}>
                    Base: {formatCOP(baseReteIVA15)}
                  </td>
                  <td className="p-2.5 text-right font-mono font-black text-emerald-900" colSpan={2}>
                    {formatCOP(retReteIVA15)}
                  </td>
                </tr>

                {/* FILA SEPARADA 2: ReteIVA 100% (Cuenta 23670103) */}
                <tr className="bg-emerald-50/70 font-bold text-emerald-900 border-b-2 border-slate-300">
                  <td className="p-2.5" colSpan={2}>
                    RETEIVA 100% (Cuenta 23670103)
                  </td>
                  <td className="p-2.5 text-right font-mono text-emerald-900" colSpan={2}>
                    Base: {formatCOP(baseReteIVA100)}
                  </td>
                  <td className="p-2.5 text-right font-mono font-black text-emerald-900" colSpan={2}>
                    {formatCOP(retReteIVA100)}
                  </td>
                </tr>

                <tr className="bg-slate-800 font-black text-white text-sm">
                  <td className="p-3" colSpan={2}>
                    TOTAL RENTAS Y RETENCIONES BRUTO
                  </td>
                  <td className="p-3 text-right font-mono text-emerald-400" colSpan={4}>
                    {formatCOP(totalGeneralBruto)}
                  </td>
                </tr>
                <tr className="bg-indigo-900 font-black text-white text-sm">
                  <td className="p-3" colSpan={2}>
                    TOTAL APROXIMADO A PAGAR (FORMULARIO 350 DIAN)
                  </td>
                  <td className="p-3 text-right font-mono text-yellow-300 text-base" colSpan={4}>
                    {formatCOP(totalGeneralAproxDIAN)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* 3. Detalle de Movimientos Individuales */}
      {movimientos.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="bg-indigo-700 text-white p-4 font-bold text-sm flex justify-between items-center">
            <span className="flex items-center gap-2">
              <FileText className="w-4 h-4" /> Movimientos Auxiliares y Clasificación por Persona
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
                  <th className="p-3">Tipo Persona</th>
                  <th className="p-3 text-right text-indigo-700 bg-indigo-50/50">Base Extraída / Nómina</th>
                  <th className="p-3 text-right text-emerald-700">Retención (Crédito)</th>
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
                      {m.tipoPersona === 'JURIDICA' ? (
                        <span className="inline-block bg-blue-100 text-blue-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                          Persona Jurídica
                        </span>
                      ) : (
                        <span className="inline-block bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                          Persona Natural
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-right font-mono font-bold text-indigo-700 bg-indigo-50/30">
                      {m.baseLimpia > 0 ? formatCOP(m.baseLimpia) : '-'}
                    </td>
                    <td className="p-3 text-right font-mono font-bold text-emerald-600">
                      {m.credito > 0 ? formatCOP(m.credito) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}