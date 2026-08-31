import React, { useState, useEffect, useMemo } from 'react';
import { localDb } from '../lib/neonStore';
import { Atelie, Pedido } from '../types';
import { Scissors, Calendar, Users, DollarSign, Wand2, Smartphone, AlertTriangle, Check, Copy } from 'lucide-react';
import { generateWhatsAppText } from '../lib/notificationEngine';
import { formatarMoeda } from '../lib/localization';

interface DashboardViewProps {
  atelie: Atelie;
}

export default function DashboardView({ atelie }: DashboardViewProps) {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [totalClientes, setTotalClientes] = useState(0);
  
  // States for notification template integration
  const [mensagensGeradas, setMensagensGeradas] = useState<Record<string, string>>({});
  const [statusCopiado, setStatusCopiado] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const refreshData = () => {
      const listPedidos = localDb.getPedidos(atelie.id);
      setPedidos(listPedidos);
      const listClientes = localDb.getClientes(atelie.id);
      setTotalClientes(listClientes.length);
    };

    refreshData();
    const unsub = localDb.onDataChange(() => {
      refreshData();
    });
    return () => unsub();
  }, [atelie.id]);

  // Calculations for KPI cards wrapped in useMemo for optimal CPU efficiency
  const dashboardStats = useMemo(() => {
    const active = pedidos.filter(p => ['em_andamento', 'aguardando_prova', 'finalizado'].includes(p.status));
    const inProg = active.length;

    // Filter deadlines within the next 2 days (172800000 ms) and overdue, excluding completed or final states
    const nowMs = Date.now();
    const alertList = active.filter(p => {
      const deliveryMs = new Date(p.prazoEntrega).getTime();
      const diff = deliveryMs - nowMs;
      // Deliveries inside 2 days or overdue are shown
      return diff <= 2 * 24 * 60 * 60 * 1000;
    });

    const alerts = alertList.length;

    const outstanding = active.reduce((acc, p) => {
      const remaining = p.valor - p.sinalPago;
      return acc + (remaining > 0 ? remaining : 0);
    }, 0);

    return {
      active,
      inProg,
      alertList,
      alerts,
      outstanding
    };
  }, [pedidos]);

  const activePedidos = dashboardStats.active;
  const totalInProg = dashboardStats.inProg;
  const alertPedidos = dashboardStats.alertList;
  const totalAlerts = dashboardStats.alerts;
  const totalOutstanding = dashboardStats.outstanding;

  // Time-to-expire check for Ateliê subscription (5 days threshold)
  const expireDate = new Date(atelie.dataVencimento);
  const daysToExpire = Math.ceil((expireDate.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
  const showExpireWarning = daysToExpire <= 5 && daysToExpire >= 0;

  // Generate customized WhatsApp notification message instantly on client side using custom templates
  const handleGerarMensagem = (pedido: Pedido) => {
    const msg = generateWhatsAppText(pedido.clienteNome, pedido.descricao, pedido.prazoEntrega, atelie.id);
    setMensagensGeradas((prev) => ({
      ...prev,
      [pedido.id]: msg,
    }));
  };

  const handleCopiar = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setStatusCopiado((prev) => ({ ...prev, [id]: true }));
    setTimeout(() => {
      setStatusCopiado((prev) => ({ ...prev, [id]: false }));
    }, 2000);
  };

  const handleUpdateMsg = (id: string, text: string) => {
    setMensagensGeradas((prev) => ({
      ...prev,
      [id]: text,
    }));
  };

  return (
    <div className="space-y-6">
      
      {/* Expiry Banner warning */}
      {showExpireWarning && (
        <div className="p-4 bg-amber-50 border border-amber-200 text-amber-900 rounded-2xl flex items-center justify-between shadow-sm animate-pulse">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
            <div>
              <p className="text-sm font-semibold">A sua licença FlowTailor expira em breve!</p>
              <p className="text-xs text-amber-800">Sua conta será suspensa em {daysToExpire} dias ({new Date(atelie.dataVencimento).toLocaleDateString('pt-AO')}). Efetue a renovação para manter o acesso.</p>
            </div>
          </div>
          <a href="/configuracoes" className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-semibold select-none transition-all">
            Renovar Plano
          </a>
        </div>
      )}

      {/* Profile Welcome */}
      <div>
        <h2 className="text-2xl font-bold font-display tracking-tight text-gray-950">Bem-vinda de volta ao painel, costureira!</h2>
        <p className="text-xs text-gray-500">Métricas gerais e alertas urgentes para o seu ateliê hoje.</p>
      </div>

      {/* KPI stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Metric Card: Active Orders */}
        <div className="bg-white p-5 rounded-3xl border border-atelier-200/80 shadow-md shadow-slate-900/5 hover:border-atelier-300 transition-all flex items-start gap-4">
          <div className="p-3 bg-atelier-50 rounded-2xl text-atelier-600">
            <Scissors className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs font-medium text-slate-500 block">Pedidos Ativos</span>
            <span className="text-2xl font-bold text-slate-950 font-display">{totalInProg}</span>
            <span className="text-[10px] text-slate-400 block mt-0.5">Em manufatura</span>
          </div>
        </div>

        {/* Metric Card: Upcoming deadlines */}
        <div className={`p-5 rounded-3xl border shadow-md flex items-start gap-4 transition-all ${
          totalAlerts > 0
            ? 'bg-rose-50/50 border-rose-200/80 shadow-rose-900/5'
            : 'bg-white border-atelier-200/80 shadow-slate-900/5'
        }`}>
          <div className={`p-3 rounded-2xl ${totalAlerts > 0 ? 'bg-rose-100 text-rose-700' : 'bg-atelier-50 text-atelier-600'}`}>
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs font-medium text-slate-500 block">Prazo Crítico (2 dias)</span>
            <span className={`text-2xl font-bold font-display ${totalAlerts > 0 ? 'text-rose-700' : 'text-slate-950'}`}>
              {totalAlerts}
            </span>
            <span className="text-[10px] text-slate-400 block mt-0.5">Mensagens a enviar</span>
          </div>
        </div>

        {/* Metric Card: Registered Clients */}
        <div className="bg-white p-5 rounded-3xl border border-atelier-200/80 shadow-md shadow-slate-900/5 hover:border-atelier-300 transition-all flex items-start gap-4">
          <div className="p-3 bg-atelier-50 rounded-2xl text-atelier-600">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs font-medium text-slate-500 block">Clientes Cadastradas</span>
            <span className="text-2xl font-bold text-slate-950 font-display">{totalClientes}</span>
            <span className="text-[10px] text-slate-400 block mt-0.5">Sua carteira de ateliê</span>
          </div>
        </div>

        {/* Metric Card: Active balance */}
        <div className="bg-white p-5 rounded-3xl border border-atelier-200/80 shadow-md shadow-slate-900/5 hover:border-atelier-300 transition-all flex items-start gap-4">
          <div className="p-3 bg-emerald-50 rounded-2xl text-emerald-600">
            <DollarSign className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs font-medium text-slate-500 block">Valores a Receber</span>
            <span className="text-2xl font-bold text-emerald-700 font-display leading-tight">
              {formatarMoeda(totalOutstanding || 0, atelie)}
            </span>
            <span className="text-[10px] text-slate-400 block mt-0.5">Sinal pendente do alfaiate</span>
          </div>
        </div>

      </div>

      {/* Main Alerts Zone Section */}
      <div className="bg-white rounded-3xl border border-atelier-200/80 shadow-md shadow-slate-900/5 p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-lg font-bold text-gray-950 font-display flex items-center gap-2">
              ⚠️ Alertas de Prazo de Entrega (Próximos 2 dias)
            </h3>
            <p className="text-xs text-gray-500">
              Gere lembretes amigáveis de forma instantânea para lembrar e confirmar a prova de roupa com as suas clientes no WhatsApp.
            </p>
          </div>
          <span className="px-2.5 py-1 bg-atelier-100 text-atelier-800 text-xs font-bold rounded-full font-mono">
            {totalAlerts} alertas detetados
          </span>
        </div>

        {totalAlerts === 0 ? (
          <div className="py-8 text-center space-y-2">
            <p className="text-sm text-gray-500 font-medium">Belo trabalho! Não tem nenhuma encomenda urgente a expirar nos próximos 2 dias.</p>
            <p className="text-xs text-gray-450 font-light">Todas as datas de entrega em andamento estão confortáveis.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 space-y-4">
            {alertPedidos.map((pedido) => {
              const textMessage = mensagensGeradas[pedido.id] || '';
              const formatDeadline = new Date(pedido.prazoEntrega).toLocaleDateString('pt-AO');
              const daysRemaining = Math.ceil((new Date(pedido.prazoEntrega).getTime() - Date.now()) / (24 * 60 * 60 * 1000));
              
              // Built-in WhatsApp API call URL
              const waUrlLink = `https://wa.me/${pedido.clienteTelefone}?text=${encodeURIComponent(textMessage)}`;

              return (
                <div key={pedido.id} className="pt-4 first:pt-0 flex flex-col md:flex-row md:items-start justify-between gap-4">
                  
                  {/* Item Description */}
                  <div className="space-y-1.5 md:max-w-md">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm text-gray-900">{pedido.clienteNome}</span>
                      <span className="text-xs px-2.5 py-0.5 bg-atelier-50 text-atelier-800 border border-atelier-100 rounded-full font-medium">
                        {pedido.tipoPeca.toUpperCase()}
                      </span>
                      <span className={`text-[10px] px-2 py-0.5 rounded font-mono ${
                        daysRemaining < 0
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}>
                        {daysRemaining < 0 ? 'EM ATRASO' : `${daysRemaining} dias`}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 font-medium">Peça: <span className="text-gray-950 font-semibold">{pedido.descricao}</span></p>
                    <p className="text-xs text-slate-500">
                      Vence em: <strong className="text-slate-700">{formatDeadline}</strong> · Valor: {formatarMoeda(pedido.valor, atelie)} (Faltam pagar: <strong className="text-emerald-700 font-semibold">{formatarMoeda(pedido.valor - pedido.sinalPago, atelie)}</strong>)
                    </p>
                    <div className="pt-1.5">
                      <button
                        onClick={() => handleGerarMensagem(pedido)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-atelier-100 hover:bg-atelier-200 text-atelier-950 transition-all select-none border border-atelier-200/50"
                      >
                        <Wand2 className="w-3.5 h-3.5 text-atelier-700" />
                        Gerar Lembrete WhatsApp
                      </button>
                    </div>
                  </div>

                  {/* Template preview & Action panel */}
                  <div className="flex-1 max-w-lg w-full flex flex-col gap-2">
                    {textMessage ? (
                      <div className="bg-atelier-50/50 border border-atelier-100 p-3.5 rounded-2xl relative shadow-inner space-y-2 animate-in fade-in duration-200">
                        <textarea
                          rows={3}
                          className="w-full text-xs text-slate-800 bg-transparent border-none focus:outline-none focus:ring-0 leading-relaxed font-sans resize-none"
                          value={textMessage}
                          onChange={(e) => handleUpdateMsg(pedido.id, e.target.value)}
                        />
                        <div className="flex items-center justify-between border-t border-atelier-200/50 pt-2 text-[10px] text-slate-500">
                          <span>💡 Pode editar esta mensagem livremente antes de enviar.</span>
                          
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleCopiar(pedido.id, textMessage)}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded hover:bg-atelier-200 transition-colors text-[10px] font-medium"
                              title="Copiar texto para colar manual"
                            >
                              {statusCopiado[pedido.id] ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                              {statusCopiado[pedido.id] ? 'Copiado' : 'Copiar'}
                            </button>

                            <a
                              href={waUrlLink}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-[10.5px] transition-all select-none"
                              title="Enviar pelo WhatsApp Web/Mobile"
                            >
                              <Smartphone className="w-3 h-3" /> Enviar no WhatsApp
                            </a>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="h-full border border-dashed border-gray-200 rounded-2xl p-4 flex flex-col items-center justify-center text-center text-xs text-slate-400">
                        <p>Nenhuma mensagem do prazo gerada para este pedido.</p>
                        <p className="text-[10px] text-slate-300">Escolha "Gerar Mensagem de Envio" de forma instantânea.</p>
                      </div>
                    )}
                  </div>

                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}
