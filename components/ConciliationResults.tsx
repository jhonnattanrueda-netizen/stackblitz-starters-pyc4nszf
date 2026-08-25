'use client';

import { ConciliationItem, ConciliationSummary } from '../types/conciliacion';
import { CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';

interface Props {
  results: ConciliationItem[];
  summary: ConciliationSummary;
}

export default function ConciliationResults({ results, summary }: Props) {
  return (
    <div className="space-y-6">
      {/* Tarjetas Informativas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <span className="text-xs font-bold tracking-wider text-slate-400 uppercase">Conciliados Exactos</span>
          <p className="text-3xl font-extrabold text-emerald-600 mt-2">{summary.exactos || 0}</p>
          <span className="text-xs text-slate-500 mt-1 block">Coincidencia 100% en monto</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <span className="text-xs font-bold tracking-wider text-slate-400 uppercase">Revisión Parcial</span>
          <p className="text-3xl font-extrabold text-amber-500 mt-2">{summary.parciales || 0}</p>
          <span className="text-xs text-slate-500 mt-1 block">Diferencias menores</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <span className="text-xs font-bold tracking-wider text-slate-400 uppercase">Pendientes en Banco</span>
          <p className="text-3xl font-extrabold text-rose-500 mt-2">{summary.discrepancias || 0}</p>
          <span className="text-xs text-slate-500 mt-1 block">No registrados en Siigo</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <span className="text-xs font-bold tracking-wider text-slate-400 uppercase">Pendientes en Siigo</span>
          <p className="text-3xl font-extrabold text-indigo-600 mt-2">{summary.pendientesSiigo || 0}</p>
          <span className="text-xs text-slate-500 mt-1 block">Sin cobro/pago bancario</span>
        </div>
      </div>

      {/* Tabla de Movimientos */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold text-xs tracking-wider uppercase">
                <th className="py-4 px-6">Estado / Confianza</th>
                <th className="py-4 px-6">Movimiento Banco</th>
                <th className="py-4 px-6">Registro Siigo</th>
                <th className="py-4 px-6 text-right">Monto</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {results.map((item, idx) => (
                <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-4 px-6">
                    {item.estado === 'EXACTO' && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Exacto
                      </span>
                    )}
                    {item.estado === 'PARCIAL' && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                        <AlertTriangle className="w-3.5 h-3.5" /> Parcial
                      </span>
                    )}
                    {item.estado === 'DISCREPANCIA' && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
                        <XCircle className="w-3.5 h-3.5" /> No Conciliado
                      </span>
                    )}
                  </td>
                  <td className="py-4 px-6">
                    <p className="font-semibold text-slate-800">{item.banco.descripcion || 'Sin detalle'}</p>
                    <span className="text-xs text-slate-400 block mt-0.5">Fecha: {item.banco.fecha || 'N/A'}</span>
                  </td>
                  <td className="py-4 px-6">
                    {item.siigo ? (
                      <>
                        <p className="font-semibold text-slate-800">{item.siigo.comprobante}</p>
                        <span className="text-xs text-slate-400 block mt-0.5">{item.siigo.tercero}</span>
                      </>
                    ) : (
                      <span className="text-slate-400 italic text-xs">Sin registro contable</span>
                    )}
                  </td>
                  <td className="py-4 px-6 text-right font-bold text-slate-900">
                    ${(item.banco.monto || 0).toLocaleString('es-CO')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}