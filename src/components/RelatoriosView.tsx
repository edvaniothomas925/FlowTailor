import React, { useState, useEffect, useMemo } from 'react';
import { localDb } from '../firebase';
import { Atelie, Pedido, Cliente } from '../types';
import { 
  TrendingUp, 
  DollarSign, 
  CreditCard, 
  Users, 
  CheckCircle, 
  Clock, 
  FileText, 
  Search, 
  Printer, 
  Calendar, 
  MessageSquare, 
  PieChart, 
  ArrowUpRight, 
  User, 
  PlusCircle, 
  Filter, 
  AlertCircle,
  HelpCircle,
  FolderOpen
} from 'lucide-react';
import { toast } from '../lib/toast';
import { formatarMoeda, getAtelieCountry, PAISES_CONFIG } from '../lib/localization';

interface RelatoriosViewProps {
  atelie: Atelie;
}

type PeriodoFiltro = 'tudo' | 'este_mes' | 'ultimos_30' | 'ultimos_90';

export default function RelatoriosView({ atelie }: RelatoriosViewProps) {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [periodo, setPeriodo] = useState<PeriodoFiltro>('tudo');
  const [busca, setBusca] = useState('');
  const [printMode, setPrintMode] = useState(false);

  useEffect(() => {
    const refreshData = () => {
      const listPedidos = localDb.getPedidos(atelie.id);
      const listClientes = localDb.getClientes(atelie.id);
      setPedidos(listPedidos);
      setClientes(listClientes);
    };

    refreshData();
    const unsub = localDb.onDataChange(() => {
      refreshData();
    });
    return () => unsub();
  }, [atelie.id]);

  // Filtering helper inside the chosen period
  const filterByPeriod = (pedido: Pedido) => {
    if (periodo === 'tudo') return true;

    const dataPedido = new Date(pedido.criadoEm);
    const agora = new Date();

    if (periodo === 'este_mes') {
      return dataPedido.getMonth() === agora.getMonth() && dataPedido.getFullYear() === agora.getFullYear();
    }
    
    if (periodo === 'ultimos_30') {
      const trintaDiasAtras = Date.now() - 30 * 24 * 60 * 60 * 1000;
      return dataPedido.getTime() >= trintaDiasAtras;
    }

    if (periodo === 'ultimos_90') {
      const noventaDiasAtras = Date.now() - 90 * 24 * 60 * 60 * 1000;
      return dataPedido.getTime() >= noventaDiasAtras;
    }

    return true;
  };

  // Wrap intensive reporting calculations in a single optimized useMemo
  const stats = useMemo(() => {
    // 1. Filter combined with Search
    const filtered = pedidos.filter(pedido => {
      const atendePeriodo = filterByPeriod(pedido);
      if (!atendePeriodo) return false;

      if (!busca) return true;
      const termo = busca.toLowerCase();
      return (
        pedido.clienteNome.toLowerCase().includes(termo) ||
        (pedido.descricao && pedido.descricao.toLowerCase().includes(termo)) ||
        (pedido.tecido && pedido.tecido.toLowerCase().includes(termo)) ||
        pedido.tipoPeca.toLowerCase().includes(termo)
      );
    });

    // 2. Calculate stats based on filtered orders
    const faturamento = filtered.reduce((acc, p) => acc + (p.status !== 'cancelado' ? p.valor : 0), 0);
    const recebido = filtered.reduce((acc, p) => acc + (p.status !== 'cancelado' ? p.sinalPago : 0), 0);
    const aReceber = faturamento - recebido;

    // 3. Outstanding debts list
    const devedoresMap: Record<string, { totalOwed: number, pedidos: Pedido[] }> = {};
    filtered.forEach(p => {
      if (p.status !== 'cancelado') {
        const owed = p.valor - p.sinalPago;
        if (owed > 0) {
          if (!devedoresMap[p.clienteId]) {
            devedoresMap[p.clienteId] = { totalOwed: 0, pedidos: [] };
          }
          devedoresMap[p.clienteId].totalOwed += owed;
          devedoresMap[p.clienteId].pedidos.push(p);
        }
      }
    });

    const devList = Object.entries(devedoresMap).map(([clienteId, info]) => {
      const cli = clientes.find(c => c.id === clienteId);
      return {
        clienteId,
        nome: cli?.nome || info.pedidos[0]?.clienteNome || 'Cliente Desconhecida',
        telefone: cli?.telefone || info.pedidos[0]?.clienteTelefone || '',
        totalOwed: info.totalOwed,
        pedidos: info.pedidos
      };
    }).sort((a, b) => b.totalOwed - a.totalOwed);

    // 4. Client leaderboard (ordered by total value ordered)
    const clientSpentMap: Record<string, { total: number, count: number }> = {};
    filtered.forEach(p => {
      if (p.status !== 'cancelado') {
        if (!clientSpentMap[p.clienteId]) {
          clientSpentMap[p.clienteId] = { total: 0, count: 0 };
        }
        clientSpentMap[p.clienteId].total += p.valor;
        clientSpentMap[p.clienteId].count += 1;
      }
    });

    const leaders = Object.entries(clientSpentMap).map(([clienteId, info]) => {
      const cli = clientes.find(c => c.id === clienteId);
      return {
        clienteId,
        nome: cli?.nome || 'Cliente Desconhecida',
        telefone: cli?.telefone || '',
        total: info.total,
        count: info.count
      };
    }).sort((a, b) => b.total - a.total).slice(0, 5); // top 5

    // 5. Breakdown by Type of piece (tipoPeca)
    const pecMap: Record<string, number> = {};
    filtered.forEach(p => {
      if (p.status !== 'cancelado') {
        pecMap[p.tipoPeca] = (pecMap[p.tipoPeca] || 0) + 1;
      }
    });

    const pecaLabels: Record<string, string> = {
      'vestido': 'Vestidos',
      'calca': 'Calças',
      'saia': 'Saias',
      'camisa': 'Camisas',
      'blazer': 'Blazers & Casacos',
      'ajuste': 'Ajustes & Bainhas',
      'outro': 'Outros Modelos'
    };

    const pecasS = Object.entries(pecMap).map(([key, count]) => ({
      label: pecaLabels[key] || key,
      count,
      percentage: filtered.length > 0 ? (count / filtered.length) * 100 : 0
    })).sort((a, b) => b.count - a.count);

    // 6. Breakdown by status
    const statusLabels: Record<string, string> = {
      'em_andamento': 'Em Manufatura',
      'aguardando_prova': 'Aguardando Prova',
      'finalizado': 'Pronto',
      'entregue': 'Entregue',
      'cancelado': 'Cancelado'
    };

    const statusS = Object.keys(statusLabels).map(key => {
      const count = filtered.filter(p => p.status === key).length;
      return {
        key,
        label: statusLabels[key],
        count,
        percentage: filtered.length > 0 ? (count / filtered.length) * 100 : 0
      };
    });

    // 7. Calculate payment index rate
    const taxa = faturamento > 0 ? (recebido / faturamento) * 100 : 0;

    return {
      filtered,
      faturamento,
      recebido,
      aReceber,
      devList,
      leaders,
      pecasS,
      statusS,
      taxa
    };
  }, [pedidos, clientes, busca, periodo]);

  // Structure definitions for existing code compatibility
  const filteredPedidos = stats.filtered;
  const faturamentoTotal = stats.faturamento;
  const totalRecebido = stats.recebido;
  const totalAReceber = stats.aReceber;
  const devedores = stats.devList;
  const leaderboard = stats.leaders;
  const pecasStats = stats.pecasS;
  
  const statusLabels: Record<string, string> = {
    'em_andamento': 'Em Manufatura',
    'aguardando_prova': 'Aguardando Prova',
    'finalizado': 'Pronto',
    'entregue': 'Entregue',
    'cancelado': 'Cancelado'
  };

  const statusColors: Record<string, string> = {
    'em_andamento': 'bg-blue-500',
    'aguardando_prova': 'bg-amber-500',
    'finalizado': 'bg-indigo-500',
    'entregue': 'bg-emerald-500',
    'cancelado': 'bg-slate-400'
  };

  const statusBgColors: Record<string, string> = {
    'em_andamento': 'bg-blue-50 text-blue-700 border-blue-105',
    'aguardando_prova': 'bg-amber-50 text-amber-700 border-amber-105',
    'finalizado': 'bg-indigo-50 text-indigo-700 border-indigo-105',
    'entregue': 'bg-emerald-50 text-emerald-700 border-emerald-105',
    'cancelado': 'bg-slate-50 text-slate-500 border-slate-105'
  };

  const statusStats = stats.statusS;
  const taxaPagamento = stats.taxa;

   // trigger browser print
  const handlePrint = () => {
    if (atelie.plano === 'basico') {
      toast.error('A impressão de relatórios consolidados e exportação de dados para auditores é uma funcionalidade avançada do plano Pro Completo.');
      return;
    }
    setPrintMode(true);
    setTimeout(() => {
      window.print();
      setPrintMode(false);
    }, 450);
  };

  // WhatsApp reminder generator for outstanding balances
  const sendWhatsAppReminder = (nome: string, telefone: string, totalOwed: number) => {
    const formatValue = formatarMoeda(totalOwed, atelie);
    const message = `Olá ${nome}! Passando aqui para enviar um lembrete carinhoso sobre o seu saldo pendente de ${formatValue} referente às encomendas de costura no ${atelie.nome}. Se precisar dos detalhes para transferência ou pagamento, avise-nos! Muito obrigada pela preferência. ✨`;
    const encoded = encodeURIComponent(message);
    window.open(`https://wa.me/${telefone}?text=${encoded}`, '_blank');
  };

  return (
    <div id="relatorios-page" className="space-y-6">
      
      {/* Upper header action belt, hidden during full page prints */}
      {!printMode && (
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 select-none">
          <div>
            <h2 className="text-2xl font-bold font-display tracking-tight text-gray-950 flex items-center gap-2">
              <FileText className="w-6 h-6 text-atelier-600" /> Relatórios do Ateliê
            </h2>
            <p className="text-xs text-gray-500">
              Análise financeira profunda do {atelie.nome}. Filtre por datas, audite pendências e exporte os seus dados de forma descomplicada.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handlePrint}
              type="button"
              className="px-4 py-2 bg-slate-900 text-white text-xs font-bold rounded-xl transition hover:bg-slate-800 flex items-center gap-1.5 cursor-pointer shadow-sm"
              title="Gerar impressão limpa"
            >
              <Printer className="w-4 h-4" /> Imprimir Relatório
            </button>
          </div>
        </div>
      )}

      {/* Report Header for printing only */}
      {printMode && (
        <div className="border-b-2 border-slate-900 pb-4 mb-4 text-center">
          <h1 className="text-2xl font-bold uppercase tracking-wider">{atelie.nome} - Relatório de Ateliê</h1>
          <p className="text-sm text-slate-600 mt-1">Gerado em {new Date().toLocaleDateString('pt-AO')} às {new Date().toLocaleTimeString('pt-AO')} | SaaS FlowTailor {PAISES_CONFIG[getAtelieCountry(atelie)].flag}</p>
          <div className="text-[11px] text-slate-500 mt-2">
            Licença: {atelie.plano === 'pro' ? 'PROFISSIONAL PRO' : 'BÁSICO'} • Responsável: {atelie.emailOwner}
          </div>
        </div>
      )}

      {/* Filter Toolbar - hidden on printing */}
      {!printMode && (
        <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row items-center gap-4 select-none">
          <div className="w-full md:w-auto flex items-center gap-1.5 shrink-0">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-xs font-bold text-slate-700">Período:</span>
            <div className="inline-flex bg-slate-100 p-0.5 rounded-lg text-xs font-semibold gap-1">
              <button
                type="button"
                onClick={() => setPeriodo('tudo')}
                className={`px-3 py-1 rounded-md transition cursor-pointer ${periodo === 'tudo' ? 'bg-white text-slate-905 shadow-xs font-bold' : 'text-slate-500 hover:text-slate-800'}`}
              >
                Tudo
              </button>
              <button
                type="button"
                onClick={() => setPeriodo('este_mes')}
                className={`px-3 py-1 rounded-md transition cursor-pointer ${periodo === 'este_mes' ? 'bg-white text-slate-905 shadow-xs font-bold' : 'text-slate-500 hover:text-slate-800'}`}
              >
                Este Mês
              </button>
              <button
                type="button"
                onClick={() => setPeriodo('ultimos_30')}
                className={`px-3 py-1 rounded-md transition cursor-pointer ${periodo === 'ultimos_30' ? 'bg-white text-slate-905 shadow-xs font-bold' : 'text-slate-500 hover:text-slate-800'}`}
              >
                30 Dias
              </button>
              <button
                type="button"
                onClick={() => setPeriodo('ultimos_90')}
                className={`px-3 py-1 rounded-md transition cursor-pointer ${periodo === 'ultimos_90' ? 'bg-white text-slate-905 shadow-xs font-bold' : 'text-slate-500 hover:text-slate-800'}`}
              >
                Três Meses
              </button>
            </div>
          </div>

          {/* Search bar inside Reports View */}
          <div className="relative w-full flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Pesquise por cliente, tecido ou modelo do relatório para auditar..."
              className="w-full pl-10 pr-4 py-2 border border-slate-200 focus:border-atelier-300 focus:outline-none rounded-xl text-xs text-slate-800 placeholder-slate-400/90 transition-colors bg-slate-50"
            />
            {busca && (
              <button
                type="button"
                onClick={() => setBusca('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] bg-slate-200 hover:bg-slate-300 px-1.5 py-0.5 rounded text-slate-650 font-bold transition"
              >
                Limpar
              </button>
            )}
          </div>
        </div>
      )}

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Metric: Faturamento Absoluto */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs flex items-start gap-4">
          <div className="p-3 bg-atelier-50 text-atelier-700 rounded-2xl">
            <TrendingUp className="w-5 h-5 shadow-inner" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Faturamento Estimado</span>
            <span className="text-xl font-bold text-slate-900 font-display block leading-normal mt-1">
              {formatarMoeda(faturamentoTotal, atelie)}
            </span>
            <span className="text-[9.5px] text-slate-500 block">Total bruto registrado</span>
          </div>
        </div>

        {/* Metric: Recebido (Sinal ou Total) */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs flex items-start gap-4">
          <div className="p-3 bg-emerald-50 text-emerald-700 rounded-2xl">
            <DollarSign className="w-5 h-5 shadow-inner" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Faturamento Recebido</span>
            <span className="text-xl font-bold text-emerald-700 font-display block leading-normal mt-1">
              {formatarMoeda(totalRecebido, atelie)}
            </span>
            <span className="text-[9.5px] text-slate-500 block">Valores já depositados/pagos</span>
          </div>
        </div>

        {/* Metric: Pendente / Em Falta */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs flex items-start gap-4">
          <div className="p-3 bg-rose-50 text-rose-700 rounded-2xl">
            <CreditCard className="w-5 h-5 shadow-inner" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Valores Em Falta</span>
            <span className="text-xl font-bold text-rose-700 font-display block leading-normal mt-1">
              {formatarMoeda(totalAReceber, atelie)}
            </span>
            <span className="text-[9.5px] text-slate-500 block">A liquidar na entrega ou prova</span>
          </div>
        </div>

        {/* Metric: Taxa de liquidez */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs flex items-start gap-4">
          <div className="p-3 bg-indigo-50 text-indigo-700 rounded-2xl">
            <CheckCircle className="w-5 h-5 shadow-inner" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Nível de Adiantamento</span>
            <span className="text-xl font-bold text-indigo-700 font-display block leading-normal mt-1 font-mono">
              {taxaPagamento.toFixed(1)}%
            </span>
            <span className="text-[9.5px] text-slate-500 block">Proporção de pagamento de sinal</span>
          </div>
        </div>

      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Chart Zone 1: Types of Clothes (tipoPeca) */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
              <PieChart className="w-4 h-4 text-atelier-720" /> Encomendas por Peca de Roupa
            </h3>
            <p className="text-[11px] text-slate-405 leading-relaxed">Breakdown dos modelos em confeção ou fechados.</p>
          </div>

          {pecasStats.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">Nenhum dado para o período selecionado.</div>
          ) : (
            <div className="space-y-3.5">
              {pecasStats.map((item, index) => (
                <div key={item.label} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-700">
                      {index + 1}. {item.label}
                    </span>
                    <span className="font-mono text-slate-500 font-bold">
                      {item.count} {item.count === 1 ? 'peça' : 'peças'} ({item.percentage.toFixed(1)}%)
                    </span>
                  </div>
                  {/* Outer bar */}
                  <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                    <div 
                      className="bg-atelier-600 h-full rounded-full transition-all duration-300"
                      style={{ width: `${item.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Chart Zone 2: Status Breakdown */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-atelier-720" /> Estado de Conclusão / Fluxo
            </h3>
            <p className="text-[11px] text-slate-405 leading-relaxed">Status atual de cada encomenda cadastrada no sistema.</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {statusStats.map(item => (
              <div 
                key={item.key} 
                className={`p-3 rounded-2xl border ${statusBgColors[item.key] || 'bg-slate-50 border-slate-200'}`}
              >
                <span className="text-[10px] font-bold block uppercase tracking-wider">{item.label}</span>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-xl font-bold font-display">{item.count}</span>
                  <span className="text-[10px] font-mono opacity-80">({item.percentage.toFixed(0)}%)</span>
                </div>
              </div>
            ))}
          </div>

          <div className="pt-2 text-[10px] text-slate-450 leading-relaxed bg-slate-50 p-2.5 rounded-xl border border-slate-150">
            📌 Manter o estado das encomendas atualizado ajuda na precisão deste relatório em tempo real de Luanda.
          </div>
        </div>

      </div>

      {/* Active Debtors Hub (Clientes Devedores) */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-3 gap-2">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4 text-rose-600" /> Cobrança Activa & Devedores ({devedores.length})
            </h3>
            <p className="text-[11px] text-slate-510">
              Controle automático de adiantamentos em falta. Ajuda o ateliê a manter o fluxo de caixa estável.
            </p>
          </div>
          
          <span className="px-2.5 py-1 bg-rose-50 text-rose-700 text-[10px] font-bold rounded-full text-center shrink-0 border border-rose-100 select-none">
            Saldo devedor total: {formatarMoeda(totalAReceber, atelie)}
          </span>
        </div>

        {devedores.length === 0 ? (
          <div className="py-8 text-center space-y-1.5">
            <span className="text-lg">🎉</span>
            <p className="text-xs text-slate-500 font-bold">Nenhuma pendência financeira encontrada!</p>
            <p className="text-[11.5px] text-slate-400">Excelente gestão técnica do ateliê.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[11px] border-collapse min-w-[500px]">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 uppercase tracking-wider font-bold">
                  <th className="py-2.5 font-semibold">Cliente</th>
                  <th className="py-2.5 font-semibold">Contacto</th>
                  <th className="py-2.5 font-semibold">Peças Pendentes</th>
                  <th className="py-2.5 font-semibold text-right">Valor em Falta</th>
                  {!printMode && <th className="py-2.5 text-center font-semibold">Ação Lembrete</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {devedores.map((dev) => (
                  <tr key={dev.clienteId} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 font-semibold text-slate-800">{dev.nome}</td>
                    <td className="py-3 font-mono text-slate-500">{dev.telefone || 'Sem telefone'}</td>
                    <td className="py-3 text-slate-600 max-w-[200px] truncate" title={dev.pedidos.map(p => p.descricao).join(', ')}>
                      {dev.pedidos.map(p => p.descricao || p.tipoPeca).join(', ')}
                    </td>
                    <td className="py-3 text-right font-bold text-rose-700 font-mono">
                      {formatarMoeda(dev.totalOwed, atelie)}
                    </td>
                    {!printMode && (
                      <td className="py-3 text-center">
                        {dev.telefone ? (
                          <button
                            onClick={() => sendWhatsAppReminder(dev.nome, dev.telefone, dev.totalOwed)}
                            type="button"
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-lg text-[10px] font-bold cursor-pointer transition border border-emerald-110"
                            title="Enviar lembrete amigável no WhatsApp"
                          >
                            <MessageSquare className="w-3.5 h-3.5" /> Cobrar (WhatsApp)
                          </button>
                        ) : (
                          <span className="text-[10px] text-slate-400 italic">Contacto Ausente</span>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Leaderboard & Overview dual section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* Top Clients spending leaderboard */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
          <div>
            <h3 className="text-sm font-bold text-slate-905 flex items-center gap-1.5">
              <Users className="w-4 h-4 text-atelier-720" /> Lista de Clientes VIP
            </h3>
            <p className="text-[11px] text-slate-410">Quem mais solicitou serviços e confeções no período selecionado.</p>
          </div>

          {leaderboard.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">Sem histórico disponível.</div>
          ) : (
            <div className="space-y-2">
              {leaderboard.map((leader, idx) => (
                <div key={leader.clienteId} className="flex items-center justify-between p-2.5 hover:bg-slate-50/50 rounded-xl transition border border-transparent hover:border-slate-100">
                  <div className="flex items-center gap-2.5">
                    <span className="w-6 h-6 rounded-lg bg-atelier-50 text-atelier-800 font-bold text-xs flex items-center justify-center font-mono">
                      {idx + 1}
                    </span>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">{leader.nome}</h4>
                      <p className="text-[10px] text-slate-400 font-mono">{leader.count} {leader.count === 1 ? 'pedidos' : 'encomendas'}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-sans font-black text-slate-800">
                      {formatarMoeda(leader.total, atelie)}
                    </span>
                    <span className="block text-[8.5px] font-semibold text-emerald-600 font-mono tracking-wider">Investidos</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Global Statistics Overview */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
          <div>
            <h3 className="text-sm font-bold text-slate-905 flex items-center gap-1.5">
              <FolderOpen className="w-4 h-4 text-atelier-720" /> Visão de Volume Geral
            </h3>
            <p className="text-[11px] text-slate-415">Indicadores chave de rendimento e controle interno do atelier.</p>
          </div>

          <div className="space-y-3.5 text-xs text-slate-600">
            <div className="flex items-center justify-between py-1.5 border-b border-slate-50">
              <span>Média de Faturamento por Peça:</span>
              <strong className="text-slate-800 font-mono">
                {filteredPedidos.length > 0 ? formatarMoeda(Math.round(faturamentoTotal / filteredPedidos.length), atelie) : '0'}
              </strong>
            </div>

            <div className="flex items-center justify-between py-1.5 border-b border-slate-50">
              <span>Sinal Pago Médio:</span>
              <strong className="text-slate-800 font-mono">
                {filteredPedidos.length > 0 ? formatarMoeda(Math.round(totalRecebido / filteredPedidos.length), atelie) : '0'}
              </strong>
            </div>

            <div className="flex items-center justify-between py-1.5 border-b border-slate-50">
              <span>Total de Clientes Registrados:</span>
              <strong className="text-slate-800 font-mono">{clientes.length}</strong>
            </div>

            <div className="flex items-center justify-between py-1.5 border-b border-slate-50">
              <span>Eficiência Operacional:</span>
              <strong className="text-emerald-700 font-mono">
                {filteredPedidos.length > 0 
                  ? ((filteredPedidos.filter(p => p.status === 'finalizado' || p.status === 'entregue').length / filteredPedidos.length) * 100).toFixed(0) + '%'
                  : '0%'
                }
              </strong>
            </div>

            <p className="text-[10px] text-slate-400 bg-slate-50 p-2 border border-slate-100 rounded-xl leading-relaxed">
              *Nota: A eficiência operacional mede a proporção das suas peças concluídas ou já entregues em conformidade com o prazo.
            </p>
          </div>
        </div>

      </div>

    </div>
  );
}
