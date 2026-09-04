'use client';

import { useState } from 'react';
import { FileSpreadsheet, Building2, FileText, Search, AlertCircle, RefreshCw, Download } from 'lucide-react';
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
  const [movimientos, setMovimientos] = useState<MovimientoIndustriaComercio[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [cuentaFiltro, setCuentaFiltro] = useState<string>('TODAS');
  const [error, setError] = useState<string | null>(null);

  // Cargar Auxiliar Contable filtrando exclusivamente cuentas 135518
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
        
        // Filtrar únicamente cuentas que comiencen por 135518
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

  const handleReset = () => {
    setMovimientos([]);
    setFileName(null);
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

  const totalBase = movimientosFiltrados.reduce((acc, m) => acc + m.baseLimpia, 0);
  const totalRetencionDebito = movimientosFiltrados.reduce((acc, m) => acc + m.debito, 0);
  const totalDevolucionCredito = movimientosFiltrados.reduce((acc, m) => acc + m.credito, 0);

  // Exportar a Excel con la estructura actualizada
  const exportarExcel = () => {
    if (movimientosFiltrados.length === 0) return;

    const rows = [
      ['REPORTE DE INDUSTRIA Y COMERCIO (RETEICA - CUENTAS 135518)'],
      [''],
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

    rows.push(['']);
    rows.push(['TOTALES', '', '', '', '', '', totalBase, totalRetencionDebito, totalDevolucionCredito]);

    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'ReteICA 135518');
    XLSX.writeFile(wb, `Informe_ReteICA_135518_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div className="space-y-6">
      {/* Tarjeta de Carga */}
      <div className="bg-white p-6 rounded-2xl border-2 border-indigo-100 shadow-sm text-center max-w-xl mx-auto flex flex-col items-center justify-between">
        <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mb-3 border border-indigo-100">
          <Building2 className="w-7 h-7" />
        </div>
        <h3 className="font-bold text-slate-800 text-sm">Auxiliar de Industria y Comercio (Cuenta 135518)</h3>
        <p className="text-xs text-slate-500 mt-1 mb-4">
          {fileName
            ? `✓ ${fileName} (${movimientos.length} registros)`
            : 'Sube el archivo Excel de Auxiliar Contable de cuentas 135518.'}
        </p>

        <div className="flex items-center gap-3">
          <label className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-5 py-2.5 rounded-xl cursor-pointer transition-all shadow-md inline-flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4" />
            {fileName ? 'Cambiar Archivo' : 'Cargar Auxiliar 135518'}
            <input
              type="file"
              accept=".xlsx, .xls"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
            />
          </label>

          {fileName && (
            <button
              onClick={handleReset}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-bold bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-xl transition-all"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Limpiar
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm font-medium">{error}</span>
        </div>
      )}

      {/* Tarjetas de Resumen de Saldos */}
      {movimientos.length > 0 && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-indigo-100 shadow-sm">
              <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider block">
                Total Base Extraída
              </span>
              <div className="text-2xl font-black text-indigo-900 mt-1">{formatCOP(totalBase)}</div>
              <span className="text-[11px] text-indigo-500 mt-0.5 block">Suma de bases en Detalle</span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-emerald-100 bg-emerald-50/20 shadow-sm">
              <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider block">
                Total Retención (Débito)
              </span>
              <div className="text-2xl font-black text-emerald-700 mt-1">{formatCOP(totalRetencionDebito)}</div>
              <span className="text-[11px] text-emerald-600 mt-0.5 block">Movimientos Débito</span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-rose-100 bg-rose-50/20 shadow-sm">
              <span className="text-xs font-bold text-rose-600 uppercase tracking-wider block">
                Total Devolución (Crédito)
              </span>
              <div className="text-2xl font-black text-rose-700 mt-1">{formatCOP(totalDevolucionCredito)}</div>
              <span className="text-[11px] text-rose-500 mt-0.5 block">Movimientos Crédito</span>
            </div>
          </div>

          <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap justify-between items-center gap-3">
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-slate-600">Subcuenta:</span>
              <select
                value={cuentaFiltro}
                onChange={(e) => setCuentaFiltro(e.target.value)}
                className="bg-slate-50 border border-slate-300 text-xs px-3 py-2 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold"
              >
                <option value="TODAS">Todas las subcuentas ({movimientos.length})</option>
                {cuentasUnicas.map((c) => (
                  <option key={c} value={c}>
                    Subcuenta {c}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={exportarExcel}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow transition-all cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" /> Descargar Excel
              </button>

              <div className="relative w-full sm:w-64">
                <input
                  type="text"
                  placeholder="Buscar por tercero, NIT, comprobante..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="bg-slate-50 border border-slate-300 text-xs pl-8 pr-3 py-2 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 w-full font-medium"
                />
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              </div>
            </div>
          </div>

          {/* Tabla con la Estructura Exacta Requerida */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="bg-indigo-800 text-white p-4 font-bold text-sm flex justify-between items-center">
              <span className="flex items-center gap-2">
                <FileText className="w-4 h-4" /> REPORTE DE INDUSTRIA Y COMERCIO (CUENTAS 135518)
              </span>
              <span className="bg-indigo-700 px-2.5 py-1 rounded-lg text-xs">
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
                      TOTALES
                    </td>
                    <td className="p-3 text-right font-mono text-indigo-300">{formatCOP(totalBase)}</td>
                    <td className="p-3 text-right font-mono text-emerald-400">{formatCOP(totalRetencionDebito)}</td>
                    <td className="p-3 text-right font-mono text-rose-300">{formatCOP(totalDevolucionCredito)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}