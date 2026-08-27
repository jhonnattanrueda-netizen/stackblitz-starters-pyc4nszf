'use client';

import { useState } from 'react';
import { ConciliationItem, ConciliationSummary, BankTransaction, SiigoTransaction } from '../types/conciliacion';
import { CheckCircle2, AlertCircle, Clock, Check, Building2, Search, Calculator } from 'lucide-react';

interface ConciliationResultsProps {
  results: ConciliationItem[];
  summary: ConciliationSummary;
  siigoDataRaw: SiigoTransaction[];
  bankTransactions: BankTransaction[];
}

const CONCEPTOS_COMISIONES = [
  'COMIS TRASLADO EN SUCURSAL',
  'SERVICIO PAGO A OTROS BANCOS',
  'SERVICIO PAGO A PROVEEDORES',
  'SERVICIO PAGO DE NOMINA',
  'SERVICIO POR PAGOS A NEQUI',
];

const CONCEPTOS_GMF = [
  'CXC IMPTO GOBIERNO 4X1000 MON',
  'IMPTO GOBIERNO 4X1000',
];

const OTROS_GASTOS_INDIVIDUALES = [
  'ABONO INTERESES AHORROS',
  'C MANEJO TARJ DEB',
  'COBRO IVA PAGOS AUTOMATICOS',
  'COMIS SWIFT GIRO VTA MDA EXT',
  'CUOTA MANEJO CUPO ROTATIVO',
  'CUOTA PLAN CANAL NEGOCIOS',
  'IVA CUOTA MANEJO CUPO ROTATIVO',
  'IVA CUOTA PLAN CANAL NEGOCIOS',
  'RETENCION EN LA FUENTE',
  'VALOR IVA',
  'DEBITO POR RECHAZOS PAGOS',
  'REV DEBITO POR RECHAZOS PAGOS',
];

const ALL_GASTOS_PATTERNS = [
  ...CONCEPTOS_COMISIONES,
  ...CONCEPTOS_GMF,
  ...OTROS_GASTOS_INDIVIDUALES,
];

export default function ConciliationResults({
  results,
  summary,
  siigoDataRaw,
  bankTransactions,
}: ConciliationResultsProps) {
  const [filtroVista, setFiltroVista] = useState<
    'TODOS' | 'CONCILIADOS' | 'PENDIENTES_OPERATIVOS' | 'PENDIENTES_GASTOS' | 'PENDIENTES_SIIGO'
  >('TODOS');
  
  const [searchTerm, setSearchTerm] = useState('');

  const esGastoBancario = (descripcion: string) => {
    const descUpper = descripcion.toUpperCase().trim();
    return ALL_GASTOS_PATTERNS.some((concepto) => descUpper.includes(concepto));
  };

  const concilidados = results.filter((r) => r.estado === 'CONCILIADO');

  const pendientesBancoTotal = bankTransactions.filter(
    (b) => !results.some((r) => r.estado === 'CONCILIADO' && r.bankTransaction?.id === b.id)
  );

  const pendientesOperativosBanco = pendientesBancoTotal.filter((b) => !esGastoBancario(b.descripcion));
  const pendientesGastosBanco = pendientesBancoTotal.filter((b) => esGastoBancario(b.descripcion));

  const pendientesSiigo = siigoDataRaw.filter(
    (s) => !results.some((r) => r.estado === 'CONCILIADO' && r.siigoTransaction?.id === s.id)
  );

  const totalMontoGastos = pendientesGastosBanco.reduce((acc, b) => acc + b.monto, 0);

  // --------------------------------------------------------------------------
  // CÁLCULO DE RESUMEN DE TOTALES PARA LA SECCIÓN INFERIOR
  // --------------------------------------------------------------------------
  const gastosParaTotales = bankTransactions.filter((b) => esGastoBancario(b.descripcion));

  // 1. Agrupado: Comisiones Bancarias
  const txComisiones = gastosParaTotales.filter((b) =>
    CONCEPTOS_COMISIONES.some((c) => b.descripcion.toUpperCase().includes(c))
  );
  const totalComisiones = txComisiones.reduce((acc, b) => acc + b.monto, 0);

  // 2. Agrupado: GMF 4x1000
  const txGMF = gastosParaTotales.filter((b) =>
    CONCEPTOS_GMF.some((c) => b.descripcion.toUpperCase().includes(c))
  );
  const totalGMF = txGMF.reduce((acc, b) => acc + b.monto, 0);

  // 3. Desglose Individual del resto de conceptos
  const resumenOtrosGastos: { concepto: string; total: number; cantidad: number }[] = [];

  OTROS_GASTOS_INDIVIDUALES.forEach((concepto) => {
    const coincidencia = gastosParaTotales.filter((b) =>
      b.descripcion.toUpperCase().includes(concepto)
    );
    if (coincidencia.length > 0) {
      const suma = coincidencia.reduce((acc, b) => acc + b.monto, 0);
      resumenOtrosGastos.push({
        concepto,
        total: suma,
        cantidad: coincidencia.length,
      });
    }
  });

  const formatCOP = (val: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 2,
    }).format(val);
  };

  return (
    <div className="space-y-6">
      {/* 1. Tarjetas de Resumen de Saldos */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Conciliados</span>
          <div className="text-xl font-black text-emerald-600 mt-1 flex items-center gap-1.5">
            <CheckCircle2 className="w-5 h-5" /> {concilidados.length}
          </div>
          <span className="text-[10px] text-slate-400 mt-0.5 block">Cruces verificados</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-rose-100 bg-rose-50/20 shadow-sm">
          <span className="text-[11px] font-bold text-rose-600 uppercase tracking-wider block">Pendientes Banco</span>
          <div className="text-xl font-black text-rose-700 mt-1 flex items-center gap-1.5">
            <AlertCircle className="w-5 h-5" /> {pendientesOperativosBanco.length}
          </div>
          <span className="text-[10px] text-rose-500 mt-0.5 block">Operaciones por registrar</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-blue-100 bg-blue-50/20 shadow-sm">
          <span className="text-[11px] font-bold text-blue-600 uppercase tracking-wider block">Gastos Bancarios</span>
          <div className="text-xl font-black text-blue-700 mt-1 flex items-center gap-1.5">
            <Building2 className="w-5 h-5" /> {pendientesGastosBanco.length}
          </div>
          <span className="text-[10px] text-blue-500 mt-0.5 block">Total: {formatCOP(totalMontoGastos)}</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-amber-100 bg-amber-50/20 shadow-sm">
          <span className="text-[11px] font-bold text-amber-600 uppercase tracking-wider block">Pendientes Siigo</span>
          <div className="text-xl font-black text-amber-700 mt-1 flex items-center gap-1.5">
            <Clock className="w-5 h-5" /> {pendientesSiigo.length}
          </div>
          <span className="text-[10px] text-amber-600 mt-0.5 block">Por reflejar en extracto</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-indigo-100 bg-indigo-50/20 shadow-sm">
          <span className="text-[11px] font-bold text-indigo-600 uppercase tracking-wider block">Diferencia Neta</span>
          <div className="text-lg font-black text-indigo-900 mt-1">
            {formatCOP(summary.diferenciaTotal)}
          </div>
          <span className="text-[10px] text-indigo-500 mt-0.5 block">Variación acumulada</span>
        </div>
      </div>

      {/* 2. Barra de Filtros */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap justify-between items-center gap-3">
        <div className="flex bg-slate-100 p-1 rounded-xl gap-1 text-xs font-bold overflow-x-auto">
          <button
            onClick={() => setFiltroVista('TODOS')}
            className={`px-3.5 py-2 rounded-lg transition-all whitespace-nowrap ${
              filtroVista === 'TODOS' ? 'bg-white text-slate-800 shadow' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            📋 Todos ({bankTransactions.length + siigoDataRaw.length})
          </button>
          
          <button
            onClick={() => setFiltroVista('CONCILIADOS')}
            className={`px-3.5 py-2 rounded-lg transition-all whitespace-nowrap ${
              filtroVista === 'CONCILIADOS' ? 'bg-emerald-600 text-white shadow' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            ✓ Conciliados ({concilidados.length})
          </button>

          <button
            onClick={() => setFiltroVista('PENDIENTES_OPERATIVOS')}
            className={`px-3.5 py-2 rounded-lg transition-all whitespace-nowrap flex items-center gap-1.5 ${
              filtroVista === 'PENDIENTES_OPERATIVOS' ? 'bg-rose-600 text-white shadow' : 'text-rose-700 hover:bg-rose-50'
            }`}
          >
            ⚠️ Pendientes Banco ({pendientesOperativosBanco.length})
          </button>

          <button
            onClick={() => setFiltroVista('PENDIENTES_GASTOS')}
            className={`px-3.5 py-2 rounded-lg transition-all whitespace-nowrap flex items-center gap-1.5 ${
              filtroVista === 'PENDIENTES_GASTOS' ? 'bg-blue-600 text-white shadow' : 'text-blue-700 hover:bg-blue-50'
            }`}
          >
            🏦 Pendientes Gastos Bancarios ({pendientesGastosBanco.length})
          </button>

          <button
            onClick={() => setFiltroVista('PENDIENTES_SIIGO')}
            className={`px-3.5 py-2 rounded-lg transition-all whitespace-nowrap ${
              filtroVista === 'PENDIENTES_SIIGO' ? 'bg-amber-500 text-white shadow' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            ⌛ Pendientes Siigo ({pendientesSiigo.length})
          </button>
        </div>

        <div className="relative w-full sm:w-64">
          <input
            type="text"
            placeholder="Buscar..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-slate-50 border border-slate-300 text-xs pl-8 pr-3 py-2 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 w-full font-medium"
          />
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
        </div>
      </div>

      {/* 3. Tablas Desglosadas principales */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Tabla Extracto / Preliminar Bancario */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="bg-indigo-600 text-white p-4 font-bold text-sm flex justify-between items-center">
            <span>Extracto / Preliminar Bancario</span>
            <span className="bg-indigo-500/40 text-xs px-2.5 py-1 rounded-lg">
              {filtroVista === 'PENDIENTES_GASTOS'
                ? pendientesGastosBanco.length
                : filtroVista === 'PENDIENTES_OPERATIVOS'
                ? pendientesOperativosBanco.length
                : bankTransactions.length}{' '}
              registros
            </span>
          </div>

          <div className="max-h-[450px] overflow-y-auto divide-y divide-slate-100">
            {(filtroVista === 'PENDIENTES_SIIGO'
              ? []
              : filtroVista === 'PENDIENTES_GASTOS'
              ? pendientesGastosBanco
              : filtroVista === 'PENDIENTES_OPERATIVOS'
              ? pendientesOperativosBanco
              : bankTransactions)
              .filter((b) => {
                if (!searchTerm) return true;
                const term = searchTerm.toLowerCase();
                return b.descripcion.toLowerCase().includes(term) || String(b.monto).includes(term) || b.fecha.includes(term);
              })
              .map((b) => {
                const esConciliado = concilidados.some((c) => c.bankTransaction?.id === b.id);
                const esGasto = esGastoBancario(b.descripcion);

                return (
                  <div
                    key={b.id}
                    className={`p-3.5 text-xs flex justify-between items-center hover:bg-slate-50 ${
                      esConciliado ? 'bg-emerald-50/20' : ''
                    }`}
                  >
                    <div className="space-y-0.5 max-w-[65%]">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono text-slate-400">{b.fecha}</span>
                        {esConciliado ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                            <Check className="w-3 h-3" /> Conciliado
                          </span>
                        ) : esGasto ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full">
                            Gasto Bancario
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
                      <span
                        className={`font-mono font-bold text-sm block ${
                          b.tipo === 'DEBITO' ? 'text-emerald-600' : 'text-rose-600'
                        }`}
                      >
                        {b.tipo === 'DEBITO' ? '+' : '-'}{formatCOP(b.monto)}
                      </span>
                      <span className="text-[10px] font-bold text-slate-400">{b.tipo}</span>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>

        {/* Tabla Movimiento Auxiliar Siigo */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="bg-emerald-700 text-white p-4 font-bold text-sm flex justify-between items-center">
            <span>Movimiento Auxiliar Siigo</span>
            <span className="bg-emerald-600/40 text-xs px-2.5 py-1 rounded-lg">
              {filtroVista === 'PENDIENTES_GASTOS'
                ? 0
                : filtroVista === 'PENDIENTES_SIIGO'
                ? pendientesSiigo.length
                : siigoDataRaw.length}{' '}
              movimientos
            </span>
          </div>

          <div className="max-h-[450px] overflow-y-auto divide-y divide-slate-100">
            {filtroVista === 'PENDIENTES_GASTOS' ? (
              <div className="p-12 text-center text-slate-400">
                <Building2 className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                <p className="text-xs font-bold text-slate-600">Pestaña exclusiva de Gastos del Extracto</p>
                <p className="text-[11px] text-slate-400 mt-1 max-w-xs mx-auto">
                  Abajo verás el desglose de totales por cada concepto de comisiones y GMF.
                </p>
              </div>
            ) : (
              (filtroVista === 'PENDIENTES_OPERATIVOS' ? [] : filtroVista === 'PENDIENTES_SIIGO' ? pendientesSiigo : siigoDataRaw)
                .filter((s) => {
                  if (!searchTerm) return true;
                  const term = searchTerm.toLowerCase();
                  return (
                    s.comprobante.toLowerCase().includes(term) ||
                    s.tercero.toLowerCase().includes(term) ||
                    String(s.monto).includes(term) ||
                    s.fecha.includes(term)
                  );
                })
                .map((s) => {
                  const esConciliado = concilidados.some((c) => c.siigoTransaction?.id === s.id);
                  return (
                    <div
                      key={s.id}
                      className={`p-3.5 text-xs flex justify-between items-center hover:bg-slate-50 ${
                        esConciliado ? 'bg-emerald-50/20' : ''
                      }`}
                    >
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
                        <p className="font-bold text-slate-800 truncate">
                          {s.comprobante} - {s.tercero}
                        </p>
                        <p className="text-[10px] text-slate-400 truncate">{s.observaciones}</p>
                      </div>

                      <div className="text-right">
                        <span
                          className={`font-mono font-bold text-sm block ${
                            s.tipo === 'DEBITO' ? 'text-emerald-600' : 'text-rose-600'
                          }`}
                        >
                          {s.tipo === 'DEBITO' ? '+' : '-'}{formatCOP(s.monto)}
                        </span>
                        <span className="text-[10px] font-bold text-slate-400">{s.tipo}</span>
                      </div>
                    </div>
                  );
                })
            )}
          </div>
        </div>
      </div>

      {/* 4. NUEVO PANEL INFERIOR: TOTALES CONSOLIDADOS DE GASTOS BANCARIOS */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Calculator className="w-5 h-5 text-indigo-600" />
            <h3 className="font-bold text-slate-800 text-sm">Resumen y Totales de Gastos Bancarios por Concepto</h3>
          </div>
          <span className="text-xs font-bold text-slate-500">
            Total Gastos Periodo: <span className="text-indigo-700 font-mono text-sm">{formatCOP(gastosParaTotales.reduce((acc, b) => acc + b.monto, 0))}</span>
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Card 1: Comisiones Bancarias Agrupadas */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex justify-between items-center">
            <div>
              <p className="text-xs font-bold text-slate-800">Comisiones Bancarias (Agrupado)</p>
              <p className="text-[10px] text-slate-400 mt-0.5">
                {txComisiones.length} reg. (Traslados, Proveedores, Nómina, Nequi, Otros Bancos)
              </p>
            </div>
            <div className="text-right">
              <span className="font-mono font-bold text-sm text-slate-900 block">{formatCOP(totalComisiones)}</span>
            </div>
          </div>

          {/* Card 2: GMF 4x1000 Agrupado */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex justify-between items-center">
            <div>
              <p className="text-xs font-bold text-slate-800">GMF 4*1000 (Agrupado)</p>
              <p className="text-[10px] text-slate-400 mt-0.5">
                {txGMF.length} reg. (CXC IMPTO GOBIERNO 4X1000 + IMPTO GOBIERNO)
              </p>
            </div>
            <div className="text-right">
              <span className="font-mono font-bold text-sm text-slate-900 block">{formatCOP(totalGMF)}</span>
            </div>
          </div>

          {/* Cards Restantes: Conceptos Individuales */}
          {resumenOtrosGastos.map((item, idx) => (
            <div key={idx} className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex justify-between items-center">
              <div>
                <p className="text-xs font-bold text-slate-800 truncate max-w-[180px]">{item.concepto}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">{item.cantidad} registro(s)</p>
              </div>
              <div className="text-right">
                <span className="font-mono font-bold text-sm text-slate-900 block">{formatCOP(item.total)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}