'use client';

import { useState } from 'react';
import { 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  ArrowUpRight, 
  ArrowDownRight,
  HelpCircle,
  FileSpreadsheet,
  Building2
} from 'lucide-react';
import { ConciliationItem, ConciliationSummary, MatchStatus } from '@/types/conciliacion';

interface Props {
  results: ConciliationItem[];
  summary: ConciliationSummary;
}

export default function ConciliationResults({ results, summary }: Props) {
  const [activeTab, setActiveTab] = useState<MatchStatus | 'ALL'>('ALL');

  // Filtrado de items según la pestaña activa
  const filteredItems = results.filter((item) => {
    if (activeTab === 'ALL') return true;
    return item.status === activeTab;
  });

  const getStatusBadge = (status: MatchStatus) => {
    switch (status) {
      case 'EXACT_MATCH':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Coincidencia Exacta
          </span>
        );
      case 'PARTIAL_MATCH':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <AlertTriangle className="w-3.5 h-3.5" />
            Parcial / Revisar
          </span>
        );
      case 'UNMATCHED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <XCircle className="w-3.5 h-3.5" />
            No Conciliado
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* ------------------------------------------------------------------ */}
      {/* TARJETAS DE MÉTRICAS / KPIS                                         */}
      {/* ------------------------------------------------------------------ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-xs font-medium text-slate-400 uppercase tracking-wider">
            Conciliados Exactos
          </div>
          <div className="text-3xl font-bold text-emerald-600 mt-2">
            {summary.conciliados}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            de {summary.totalBank} registros bancarios
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-xs font-medium text-slate-400 uppercase tracking-wider">
            Revisión Parcial
          </div>
          <div className="text-3xl font-bold text-amber-600 mt-2">
            {summary.parciales}
          </div>
          <div className="text-xs text-slate-500 mt-1">Diferencias de fecha/días</div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-xs font-medium text-slate-400 uppercase tracking-wider">
            Pendientes en Banco
          </div>
          <div className="text-3xl font-bold text-rose-600 mt-2">
            {summary.discrepanciasBanco}
          </div>
          <div className="text-xs text-slate-500 mt-1">No encontrados en Siigo</div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-xs font-medium text-slate-400 uppercase tracking-wider">
            Pendientes en Siigo
          </div>
          <div className="text-3xl font-bold text-slate-700 mt-2">
            {summary.discrepanciasSiigo}
          </div>
          <div className="text-xs text-slate-500 mt-1">Sin cobro/pago bancario</div>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* BARRA DE NAVEGACIÓN POR PESTAÑAS                                    */}
      {/* ------------------------------------------------------------------ */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="border-b border-slate-200 bg-slate-50/50 px-6 pt-4 flex gap-2 overflow-x-auto">
          <button
            onClick={() => setActiveTab('ALL')}
            className={`pb-3 px-4 text-sm font-semibold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'ALL'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            Todos
            <span className="bg-slate-200 text-slate-700 text-xs px-2 py-0.5 rounded-full">
              {results.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('EXACT_MATCH')}
            className={`pb-3 px-4 text-sm font-semibold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'EXACT_MATCH'
                ? 'border-emerald-600 text-emerald-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            Exactos
            <span className="bg-emerald-100 text-emerald-800 text-xs px-2 py-0.5 rounded-full">
              {summary.conciliados}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('PARTIAL_MATCH')}
            className={`pb-3 px-4 text-sm font-semibold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'PARTIAL_MATCH'
                ? 'border-amber-600 text-amber-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            Parciales
            <span className="bg-amber-100 text-amber-800 text-xs px-2 py-0.5 rounded-full">
              {summary.parciales}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('UNMATCHED')}
            className={`pb-3 px-4 text-sm font-semibold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'UNMATCHED'
                ? 'border-rose-600 text-rose-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            Discrepancias
            <span className="bg-rose-100 text-rose-800 text-xs px-2 py-0.5 rounded-full">
              {summary.discrepanciasBanco + summary.discrepanciasSiigo}
            </span>
          </button>
        </div>

        {/* ------------------------------------------------------------------ */}
        {/* TABLA COMPARATIVA (SIDE-BY-SIDE)                                   */}
        {/* ------------------------------------------------------------------ */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-100/70 text-slate-500 uppercase text-xs font-semibold border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-center">Estado / Confianza</th>
                <th className="px-6 py-3 bg-blue-50/40 text-blue-900 border-r border-slate-200">
                  <span className="flex items-center gap-1.5">
                    <FileSpreadsheet className="w-4 h-4 text-blue-600" /> Movimiento Banco
                  </span>
                </th>
                <th className="px-6 py-3 bg-indigo-50/40 text-indigo-900">
                  <span className="flex items-center gap-1.5">
                    <Building2 className="w-4 h-4 text-indigo-600" /> Registro Siigo
                  </span>
                </th>
                <th className="px-4 py-3 text-right">Monto</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredItems.map((item, idx) => {
                const bank = item.bankTx;
                const siigo = item.siigoTx;
                const monto = bank?.monto || siigo?.monto || 0;
                const tipo = bank?.tipo || siigo?.tipo;

                return (
                  <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                    {/* Columna Estado */}
                    <td className="px-4 py-4 text-center space-y-1 align-top">
                      <div>{getStatusBadge(item.status)}</div>
                      {item.confidenceScore > 0 && (
                        <div className="text-[11px] font-medium text-slate-400">
                          Match: {item.confidenceScore}%
                        </div>
                      )}
                    </td>

                    {/* Columna Movimiento Banco */}
                    <td className="px-6 py-4 bg-blue-50/10 border-r border-slate-100 align-top">
                      {bank ? (
                        <div className="space-y-1">
                          <div className="font-semibold text-slate-800 flex items-center justify-between">
                            <span>{bank.fecha}</span>
                            <span className="text-xs text-slate-400 font-mono">
                              Ref: {bank.referencia || 'N/A'}
                            </span>
                          </div>
                          <p className="text-xs text-slate-600">{bank.descripcion}</p>
                        </div>
                      ) : (
                        <div className="text-xs italic text-slate-400 py-2">
                          Sin registro en extracto
                        </div>
                      )}
                    </td>

                    {/* Columna Registro Siigo */}
                    <td className="px-6 py-4 bg-indigo-50/10 align-top">
                      {siigo ? (
                        <div className="space-y-1">
                          <div className="font-semibold text-slate-800 flex items-center justify-between">
                            <span>{siigo.fecha}</span>
                            <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                              {siigo.comprobante}
                            </span>
                          </div>
                          <p className="text-xs text-slate-700 font-medium">{siigo.tercero}</p>
                          <p className="text-xs text-slate-500">{siigo.observaciones}</p>
                        </div>
                      ) : (
                        <div className="text-xs italic text-slate-400 py-2">
                          Sin registro contable
                        </div>
                      )}
                    </td>

                    {/* Columna Monto */}
                    <td className="px-4 py-4 text-right align-top font-semibold">
                      <div className="flex items-center justify-end gap-1">
                        {tipo === 'CREDITO' ? (
                          <ArrowUpRight className="w-4 h-4 text-emerald-500" />
                        ) : (
                          <ArrowDownRight className="w-4 h-4 text-rose-500" />
                        )}
                        <span className={tipo === 'CREDITO' ? 'text-emerald-700' : 'text-slate-800'}>
                          ${monto.toLocaleString('es-CO')}
                        </span>
                      </div>
                      {item.motivo && (
                        <div
                          className="text-[11px] font-normal text-slate-400 mt-1 flex items-center justify-end gap-1"
                          title={item.motivo}
                        >
                          <HelpCircle className="w-3 h-3 text-slate-400 inline" />
                          <span className="truncate max-w-[150px]">{item.motivo}</span>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filteredItems.length === 0 && (
          <div className="p-12 text-center text-slate-400 text-sm">
            No se encontraron registros en esta categoría.
          </div>
        )}
      </div>
    </div>
  );
}