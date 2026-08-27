'use client';

import { useState } from 'react';
import { ConciliationItem, ConciliationSummary, BankTransaction, SiigoTransaction } from '../types/conciliacion';
import { CheckCircle2, AlertCircle, HelpCircle, ArrowUpRight, ArrowDownLeft, FileText, Check, Clock } from 'lucide-react';

interface ConciliationResultsProps {
  results: ConciliationItem[];
  summary: ConciliationSummary;
  siigoDataRaw: SiigoTransaction[];
  bankTransactions: BankTransaction[];
}

export default function ConciliationResults({
  results,
  summary,
  siigoDataRaw,
  bankTransactions,
}: ConciliationResultsProps) {
  // Estado para alternar entre ver: 'TODOS', 'CONCILIADOS', 'PENDIENTES_BANCO', 'PENDIENTES_SIIGO'
  const [filtroVista, setFiltroVista] = useState<'TODOS' | 'CONCILIADOS' | 'PENDIENTES_BANCO' | 'PENDIENTES_SIIGO'>('TODOS');
  const [searchTerm, setSearchTerm] = useState('');

  // Separación de listas
  const concilidados = results.filter((r) => r.estado === 'CONCILIADO');
  const pendientesBanco = bankTransactions.filter((b) => !results.some((r) => r.estado === 'CONCILIADO' && r.bankTransaction?.id === b.id));
  const pendientesSiigo = siigoDataRaw.filter((s) => !results.some((r) => r.estado === 'CONCILIADO' && r.siigoTransaction?.id === s.id));

  const formatCOP = (val: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 2,
    }).format(val);
  };

  return (
    <div className="space-y-6">
      {/* 1. Tarjetas Resumen de Saldos */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Movimientos Conciliados</span>
          <div className="text-2xl font-black text-emerald-600 mt-1 flex items-center gap-2">
            <CheckCircle2 className="w-6 h-6" /> {concilidados.length}
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">Cruces 1:1 verificados exactos</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-rose-100 bg-rose-50/30 shadow-sm">
          <span className="text-xs font-bold text-rose-600 uppercase tracking-wider">Pendientes Extracto Banco</span>
          <div className="text-2xl font-black text-rose-700 mt-1 flex items-center gap-2">
            <AlertCircle className="w-6 h-6" /> {pendientesBanco.length}
          </div>
          <span className="text-[11px] text-rose-500 mt-1 block">Por contabilizar en Siigo</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-amber-100 bg-amber-50/30 shadow-sm">
          <span className="text-xs font-bold text-amber-600 uppercase tracking-wider">Pendientes Auxiliar Siigo</span>
          <div className="text-2xl font-black text-amber-700 mt-1 flex items-center gap-2">
            <Clock className="w-6 h-6" /> {pendientesSiigo.length}
          </div>
          <span className="text-[11px] text-amber-600 mt-1 block">Por reflejarse en extracto</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-indigo-100 bg-indigo-50/30 shadow-sm">
          <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider">Diferencia Neta de Saldos</span>
          <div className="text-xl font-black text-indigo-900 mt-1">
            {formatCOP(summary.diferenciaTotal)}
          </div>
          <span className="text-[11px] text-indigo-500 mt-1 block">Variación final acumulada</span>
        </div>
      </div>

      {/* 2. Barra de Filtros de Visualización */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap justify-between items-center gap-3">
        <div className="flex bg-slate-100 p-1 rounded-xl gap-1 text-xs font-bold">
          <button
            onClick={() => setFiltroVista('TODOS')}
            className={`px-4 py-2 rounded-lg transition-all ${
              filtroVista === 'TODOS' ? 'bg-white text-slate-800 shadow' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            📋 Todos ({bankTransactions.length + siigoDataRaw.length})
          </button>
          <button
            onClick={() => setFiltroVista('CONCILIADOS')}
            className={`px-4 py-2 rounded-lg transition-all ${
              filtroVista === 'CONCILIADOS' ? 'bg-emerald-600 text-white shadow' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            ✓ Conciliados ({concilidados.length})
          </button>
          <button
            onClick={() => setFiltroVista('PENDIENTES_BANCO')}
            className={`px-4 py-2 rounded-lg transition-all ${
              filtroVista === 'PENDIENTES_BANCO' ? 'bg-rose-600 text-white shadow' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            ⚠️ Pendientes Banco ({pendientesBanco.length})
          </button>
          <button
            onClick={() => setFiltroVista('PENDIENTES_SIIGO')}
            className={`px-4 py-2 rounded-lg transition-all ${
              filtroVista === 'PENDIENTES_SIIGO' ? 'bg-amber-500 text-white shadow' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            ⌛ Pendientes Siigo ({pendientesSiigo.length})
          </button>
        </div>

        {/* Buscador reactivo */}
        <input
          type="text"
          placeholder="🔍 Buscar por monto, concepto o comprobante..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="bg-slate-50 border border-slate-300 text-xs px-3.5 py-2 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 w-full sm:w-72 font-medium"
        />
      </div>

      {/* 3. Tablas Desglosadas según el Filtro Seleccionado */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Tabla Extracto Bancario */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="bg-indigo-600 text-white p-4 font-bold text-sm flex justify-between items-center">
            <span>Extracto / Preliminar Bancario</span>
            <span className="bg-indigo-500/40 text-xs px-2.5 py-1 rounded-lg">
              {filtroVista === 'PENDIENTES_BANCO' ? pendientesBanco.length : bankTransactions.length} registros
            </span>
          </div>

          <div className="max-h-[500px] overflow-y-auto divide-y divide-slate-100">
            {(filtroVista === 'PENDIENTES_SIIGO' ? [] : (filtroVista === 'PENDIENTES_BANCO' ? pendientesBanco : bankTransactions))
              .filter((b) => {
                if (!searchTerm) return true;
                const term = searchTerm.toLowerCase();
                return b.descripcion.toLowerCase().includes(term) || String(b.monto).includes(term) || b.fecha.includes(term);
              })
              .map((b) => {
                const esConciliado = concilidados.some((c) => c.bankTransaction?.id === b.id);
                return (
                  <div key={b.id} className={`p-3.5 text-xs flex justify-between items-center hover:bg-slate-50 ${esConciliado ? 'bg-emerald-50/20' : ''}`}>
                    <div className="space-y-0.5 max-w-[65%]">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono text-slate-400">{b.fecha}</span>
                        {esConciliado ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                            <Check className="w-3 h-3" /> Conciliado
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-full">
                            Pendiente Banco
                          </span>
                        )}
                      </div>
                      <p className="font-bold text-slate-800 truncate">{b.descripcion}</p>
                      <p className="text-[10px] text-slate-400">Ref: {b.referencia}</p>
                    </div>

                    <div className="text-right">
                      <span className={`font-mono font-bold text-sm block ${b.tipo === 'DEBITO' ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {b.tipo === 'DEBITO' ? '+' : '-'}{formatCOP(b.monto)}
                      </span>
                      <span className="text-[10px] font-bold text-slate-400">{b.tipo}</span>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>

        {/* Tabla Auxiliar Contable Siigo */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="bg-emerald-700 text-white p-4 font-bold text-sm flex justify-between items-center">
            <span>Movimiento Auxiliar Siigo</span>
            <span className="bg-emerald-600/40 text-xs px-2.5 py-1 rounded-lg">
              {filtroVista === 'PENDIENTES_SIIGO' ? pendientesSiigo.length : siigoDataRaw.length} movimientos
            </span>
          </div>

          <div className="max-h-[500px] overflow-y-auto divide-y divide-slate-100">
            {(filtroVista === 'PENDIENTES_BANCO' ? [] : (filtroVista === 'PENDIENTES_SIIGO' ? pendientesSiigo : siigoDataRaw))
              .filter((s) => {
                if (!searchTerm) return true;
                const term = searchTerm.toLowerCase();
                return s.comprobante.toLowerCase().includes(term) || s.tercero.toLowerCase().includes(term) || String(s.monto).includes(term) || s.fecha.includes(term);
              })
              .map((s) => {
                const esConciliado = concilidados.some((c) => c.siigoTransaction?.id === s.id);
                return (
                  <div key={s.id} className={`p-3.5 text-xs flex justify-between items-center hover:bg-slate-50 ${esConciliado ? 'bg-emerald-50/20' : ''}`}>
                    <div className="space-y-0.5 max-w-[65%]">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono text-slate-400">{s.fecha}</span>
                        {esConciliado ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                            <Check className="w-3 h-3" /> Conciliado
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                            Pendiente Siigo
                          </span>
                        )}
                      </div>
                      <p className="font-bold text-slate-800 truncate">{s.comprobante} - {s.tercero}</p>
                      <p className="text-[10px] text-slate-400 truncate">{s.observaciones}</p>
                    </div>

                    <div className="text-right">
                      <span className={`font-mono font-bold text-sm block ${s.tipo === 'DEBITO' ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {s.tipo === 'DEBITO' ? '+' : '-'}{formatCOP(s.monto)}
                      </span>
                      <span className="text-[10px] font-bold text-slate-400">{s.tipo}</span>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      </div>
    </div>
  );
}