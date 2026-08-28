'use client';

import { useState } from 'react';
import { FileSpreadsheet, Calculator, FileText, Search, AlertCircle, RefreshCw, UserCheck } from 'lucide-react';
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

export default function RetencionFuente() {
  const [fileName, setFileName] = useState<string | null>(null);
  const [nominaFileName, setNominaFileName] = useState<string | null>(null);
  
  const [movimientos, setMovimientos] = useState<MovimientoRetencion[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [cuentaFiltro, setCuentaFiltro] = useState<string>('TODAS');
  const [error, setError] = useState<string | null>(null);

  // 1. Carga del Auxiliar Contable de Siigo (Cuentas 2365 / 2367)
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
    } catch (err) {
      setError('Error al procesar el archivo auxiliar de Retención en la Fuente.');
    }
  };

  // 2. Carga del Archivo de Nómina de Apoyo (Para cruzar la Columna N con los empleados)
  const handleNominaUpload = async (file: File) => {
    try {
      if (movimientos.length === 0) {
        setError('Primero sube el archivo Auxiliar de Retención de Siigo.');
        return;
      }

      setError(null);
      setNominaFileName(file.name);

      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      
      // Buscar la hoja de nómina relevante o tomar la activa
      const sheetName = workbook.SheetNames.find((s) => 
        ['JULIO', 'AGOSTO', 'JUNIO', 'MAYO', 'ABRIL', 'MARZO', 'FEBRERO', 'ENERO'].includes(s.toUpperCase())
      ) || workbook.SheetNames[0];

      const worksheet = workbook.Sheets[sheetName];
      const rawData: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: true });

      // Mapeos de búsqueda en Nómina
      const mapaNitBase: Record<string, number> = {};
      const mapaNombreBase: Record<string, number> = {};

      rawData.forEach((row) => {
        if (!row || row.length < 14) return;

        // Documento en Columna A (0), Nombre en Columna B (1), Total Devengado en Columna N (13)
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

      // Cruzar con los movimientos de Siigo que no tenían base en el detalle
      const movimientosActualizados = movimientos.map((m) => {
        if (m.baseLimpia > 0) return m; // Ya tenía base extraída del detalle

        let baseEncontrada = 0;

        // Búsqueda 1: Por NIT / Documento exacto
        if (m.nit && mapaNitBase[m.nit] !== undefined) {
          baseEncontrada = mapaNitBase[m.nit];
        } else {
          // Búsqueda 2: Por similitud de Nombre
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

        return m;
      });

      setMovimientos(movimientosActualizados);
    } catch (err) {
      setError('Error al cruzar las bases desde el archivo de Nómina.');
    }
  };

  const handleReset = () => {
    setMovimientos([]);
    setFileName(null);
    setNominaFileName(null);
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

  return (
    <div className="space-y-6">
      {/* Tarjetas de Carga Independiente */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Archivo 1: Auxiliar Siigo */}
        <div className="bg-white p-6 rounded-2xl border-2 border-indigo-100 shadow-sm text-center flex flex-col items-center justify-between">
          <div>
            <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-3 border border-indigo-100">
              <Calculator className="w-7 h-7" />
            </div>
            <h3 className="font-bold text-slate-800 text-sm">1. Auxiliar de Retención Siigo (Excel)</h3>
            <p className="text-xs text-slate-500 mt-1 mb-4">
              {fileName
                ? `✓ ${fileName} (${movimientos.length} registros)`
                : 'Sube el archivo Excel de cuentas 2365 / 2367 descargado de Siigo.'}
            </p>
          </div>

          <label className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-5 py-2.5 rounded-xl cursor-pointer transition-all shadow-md inline-flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4" />
            {fileName ? 'Cambiar Auxiliar Siigo' : 'Cargar Auxiliar Siigo'}
            <input
              type="file"
              accept=".xlsx, .xls"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
            />
          </label>
        </div>

        {/* Archivo 2: Nómina de Apoyo (Para completar bases vacías de Nómina) */}
        <div className="bg-white p-6 rounded-2xl border-2 border-emerald-100 shadow-sm text-center flex flex-col items-center justify-between">
          <div>
            <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-3 border border-emerald-100">
              <UserCheck className="w-7 h-7" />
            </div>
            <h3 className="font-bold text-slate-800 text-sm">2. Archivo de Nómina de Apoyo (Opcional)</h3>
            <p className="text-xs text-slate-500 mt-1 mb-4">
              {nominaFileName
                ? `✓ ${nominaFileName} (Bases cruzadas)`
                : 'Carga la Nómina para obtener la base Columna N de los empleados.'}
            </p>
          </div>

          <label
            className={`text-white text-xs font-bold px-5 py-2.5 rounded-xl cursor-pointer transition-all shadow-md inline-flex items-center gap-2 ${
              movimientos.length === 0
                ? 'bg-slate-300 cursor-not-allowed'
                : 'bg-emerald-600 hover:bg-emerald-700'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            {nominaFileName ? 'Cambiar Archivo Nómina' : 'Cargar Nómina de Apoyo'}
            <input
              type="file"
              accept=".xlsx, .xls"
              disabled={movimientos.length === 0}
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleNominaUpload(e.target.files[0])}
            />
          </label>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm font-medium">{error}</span>
        </div>
      )}

      {/* Tabla y Totales de Retención */}
      {movimientos.length > 0 && (
        <>
          {/* Tarjetas de Resumen Global */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-indigo-100 shadow-sm">
              <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider block">
                Base Gravable Total
              </span>
              <div className="text-2xl font-black text-indigo-900 mt-1">{formatCOP(totalBase)}</div>
              <span className="text-[11px] text-indigo-500 mt-0.5 block">
                Base extraída del Detalle + Cruzada de Nómina
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

          {/* Barra de Filtros */}
          <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap justify-between items-center gap-3">
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-slate-600">Filtrar Cuenta:</span>
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

          {/* Tabla de Resultados */}
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
                            ✓ Cruzado Nómina
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