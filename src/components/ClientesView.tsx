import React, { useState, useEffect, useMemo } from 'react';
import { localDb } from '../firebase';
import { Atelie, Cliente, Medidas, Pedido } from '../types';
import { Users, Search, PlusCircle, AlertTriangle, ChevronRight, User, Ruler, FileText, ChevronDown, ChevronUp, ArrowLeft, Calendar, BadgeAlert } from 'lucide-react';
import { toast } from '../lib/toast';
import { formatarMoeda, getAtelieCountry, PAISES_CONFIG } from '../lib/localization';

interface ClientesViewProps {
  atelie: Atelie;
  onNavigateToCreateOrder?: (clientId: string) => void;
}

export default function ClientesView({ atelie, onNavigateToCreateOrder }: ClientesViewProps) {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [busca, setBusca] = useState('');
  const [clienteSelecionado, setClienteSelecionado] = useState<Cliente | null>(null);
  const [currentTab, setCurrentTab] = useState<'dados' | 'medidas' | 'pedidos'>('dados');
  
  // Create state models
  const [mostrarNovoForm, setMostrarNovoForm] = useState(false);
  const [novoNome, setNovoNome] = useState('');
  
  const ddi = useMemo(() => {
    return PAISES_CONFIG[getAtelieCountry(atelie)]?.codigoDDI || '244';
  }, [atelie]);

  const [novoTelefone, setNovoTelefone] = useState(ddi);
  const [novoEmail, setNovoEmail] = useState('');
  const [novaObs, setNovaObs] = useState('');

  useEffect(() => {
    setNovoTelefone(ddi);
  }, [ddi]);

  // Measures form states
  const [medidaBusto, setMedidaBusto] = useState('');
  const [medidaCintura, setMedidaCintura] = useState('');
  const [medidaQuadril, setMedidaQuadril] = useState('');
  const [medidaOmbro, setMedidaOmbro] = useState('');
  const [medidaTronco, setMedidaTronco] = useState('');
  const [medidaSaia, setMedidaSaia] = useState('');
  const [medidaCalca, setMedidaCalca] = useState('');
  const [medidaManga, setMedidaManga] = useState('');
  const [medidaObs, setMedidaObs] = useState('');
  
  // Historical accordions toggle
  const [accordionAberto, setAccordionAberto] = useState<Record<string, boolean>>({});

  useEffect(() => {
    loadClientes();
    const unsub = localDb.onDataChange(() => {
      loadClientes();
    });
    return () => unsub();
  }, [atelie.id]);

  const loadClientes = () => {
    setClientes(localDb.getClientes(atelie.id));
  };

  const isMedidaDesatualizada = (clienteId: string) => {
    const list = localDb.getMedidas(atelie.id, clienteId);
    if (list.length === 0) return true; // Sem medidas tbm avisa pra tirar
    const maisRecente = list[0];
    const diffTime = Date.now() - new Date(maisRecente.registradoEm).getTime();
    const NinetyDaysMs = 90 * 24 * 60 * 60 * 1000;
    return diffTime > NinetyDaysMs;
  };

  const getMaisRecenteDataMedida = (clienteId: string) => {
    const list = localDb.getMedidas(atelie.id, clienteId);
    if (list.length === 0) return null;
    return new Date(list[0].registradoEm).toLocaleDateString('pt-AO');
  };

  const handleSalvarCliente = (e: React.FormEvent) => {
    e.preventDefault();
    if (!novoNome || !novoTelefone) return;

    if (atelie.plano === 'basico' && clientes.length >= 30) {
      toast.error('Limite de 30 clientes atingido no plano Básico! Por favor, atualize para o plano Pro para usufruir de cadastros ilimitados.');
      return;
    }

    const formattedTelefone = novoTelefone.replace(/\D/g, ''); // Limpa caracteres não-numéricos
    const cleanDDI = ddi.replace(/\D/g, '');
    const cleanPhone = formattedTelefone.startsWith(cleanDDI) ? formattedTelefone : cleanDDI + formattedTelefone;

    const novoCliente: Cliente = {
      id: 'cli_' + Math.random().toString(36).substr(2, 9),
      nome: novoNome,
      telefone: cleanPhone,
      email: novoEmail || undefined,
      observacoes: novaObs || undefined,
      criadoEm: new Date().toISOString()
    };

    localDb.saveCliente(atelie.id, novoCliente);
    
    setNovoNome('');
    setNovoTelefone(ddi);
    setNovoEmail('');
    setNovaObs('');
    setMostrarNovoForm(false);
    loadClientes();
    toast.success('Cliente cadastrado com sucesso!');
  };

  const handleSalvarNovasMedidas = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clienteSelecionado) return;

    const novaMedidaRecord: Medidas = {
      id: 'med_' + Math.random().toString(36).substr(2, 9),
      clienteId: clienteSelecionado.id,
      busto: medidaBusto ? Number(medidaBusto) : undefined,
      cintura: medidaCintura ? Number(medidaCintura) : undefined,
      quadril: medidaQuadril ? Number(medidaQuadril) : undefined,
      ombro: medidaOmbro ? Number(medidaOmbro) : undefined,
      comprimentoTronco: medidaTronco ? Number(medidaTronco) : undefined,
      comprimentoSaia: medidaSaia ? Number(medidaSaia) : undefined,
      comprimentoCalca: medidaCalca ? Number(medidaCalca) : undefined,
      manga: medidaManga ? Number(medidaManga) : undefined,
      observacoes: medidaObs || undefined,
      registradoEm: new Date().toISOString()
    };

    localDb.saveMedidas(atelie.id, novaMedidaRecord);
    
    // Reset inputs
    setMedidaBusto('');
    setMedidaCintura('');
    setMedidaQuadril('');
    setMedidaOmbro('');
    setMedidaTronco('');
    setMedidaSaia('');
    setMedidaCalca('');
    setMedidaManga('');
    setMedidaObs('');
    
    // Reload state
    setClienteSelecionado({ ...clienteSelecionado }); // Trigger re-render of detail view
  };

  const handleSalvarEdicaoDados = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clienteSelecionado) return;
    localDb.saveCliente(atelie.id, clienteSelecionado);
    loadClientes();
    toast.success('Informações atualizadas com sucesso!');
  };

  const togglingAccordion = (medId: string) => {
    setAccordionAberto(prev => ({ ...prev, [medId]: !prev[medId] }));
  };

  const filteredClientes = useMemo(() => {
    return clientes.filter(c =>
      c.nome.toLowerCase().includes(busca.toLowerCase()) ||
      c.telefone.includes(busca)
    );
  }, [clientes, busca]);

  return (
    <div className="space-y-6">

      {/* Detail view overlay sheet if a customer is selected */}
      {clienteSelecionado ? (
        <div className="space-y-6">
          <button
            onClick={() => {
              setClienteSelecionado(null);
              loadClientes();
            }}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold text-atelier-800 bg-atelier-100 hover:bg-atelier-200 transition-all select-none"
          >
            <ArrowLeft className="w-4 h-4" /> Voltar para a Listagem
          </button>

          <div className="bg-white rounded-3xl border border-atelier-200/80 shadow-md shadow-slate-900/5 overflow-hidden">
            {/* Header section client detailing */}
            <div className="p-6 bg-atelier-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white/15 rounded-2xl flex items-center justify-center text-atelier-200 text-lg font-bold">
                  {clienteSelecionado.nome.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="text-xl font-bold font-display">{clienteSelecionado.nome}</h3>
                  <p className="text-xs text-atelier-200 font-mono">Contacto: +{clienteSelecionado.telefone}</p>
                </div>
              </div>
              <div className="flex items-center gap-2.5">
                {isMedidaDesatualizada(clienteSelecionado.id) && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-amber-500/90 text-[10px] font-bold text-gray-950">
                    <AlertTriangle className="w-3.5 h-3.5" /> Ficha de Medidas Desactualizada (+90 dias)
                  </span>
                )}
              </div>
            </div>

            {/* Custom Interactive Tab Bar Sheets */}
            <div className="border-b border-gray-100 px-3 sm:px-6 flex flex-wrap select-none">
              <button
                onClick={() => setCurrentTab('dados')}
                className={`flex items-center gap-1.5 sm:gap-2 py-3.5 px-2 sm:px-4 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                  currentTab === 'dados'
                    ? 'border-atelier-600 text-atelier-600 font-extrabold'
                    : 'border-transparent text-slate-500 hover:text-slate-955'
                }`}
              >
                <User className="w-4 h-4" /> Dados Pessoais
              </button>
              <button
                onClick={() => setCurrentTab('medidas')}
                className={`flex items-center gap-1.5 sm:gap-2 py-3.5 px-2 sm:px-4 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                  currentTab === 'medidas'
                    ? 'border-atelier-600 text-atelier-600 font-extrabold'
                    : 'border-transparent text-slate-500 hover:text-slate-955'
                }`}
              >
                <Ruler className="w-4 h-4" /> Ficha de Medidas
              </button>
              <button
                onClick={() => setCurrentTab('pedidos')}
                className={`flex items-center gap-1.5 sm:gap-2 py-3.5 px-2 sm:px-4 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                  currentTab === 'pedidos'
                    ? 'border-atelier-600 text-atelier-600 font-extrabold'
                    : 'border-transparent text-slate-500 hover:text-slate-955'
                }`}
              >
                <FileText className="w-4 h-4" /> Histórico de Encomendas
              </button>
            </div>

            {/* Tab contents router switcher */}
            <div className="p-6">
              
              {/* TAB 1: EDIT INDIVIDUAL DADOS */}
              {currentTab === 'dados' && (
                <form onSubmit={handleSalvarEdicaoDados} className="max-w-xl space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">Nome Completo</label>
                      <input
                        type="text"
                        required
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl bg-slate-50 focus:ring-1 focus:ring-atelier-500 focus:outline-none"
                        value={clienteSelecionado.nome}
                        onChange={(e) => setClienteSelecionado({ ...clienteSelecionado, nome: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">Telefone (Angola)</label>
                      <input
                        type="text"
                        required
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl bg-slate-50 focus:ring-1 focus:ring-atelier-500 focus:outline-none font-mono"
                        value={clienteSelecionado.telefone}
                        onChange={(e) => setClienteSelecionado({ ...clienteSelecionado, telefone: e.target.value.replace(/\D/g, '') })}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">Correio Electrónico (E-mail)</label>
                    <input
                      type="email"
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl bg-slate-50 focus:ring-1 focus:ring-atelier-500 focus:outline-none"
                      value={clienteSelecionado.email || ''}
                      onChange={(e) => setClienteSelecionado({ ...clienteSelecionado, email: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">Observações do Cliente</label>
                    <textarea
                      rows={3}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl bg-slate-50 focus:ring-1 focus:ring-atelier-500 focus:outline-none"
                      value={clienteSelecionado.observacoes || ''}
                      onChange={(e) => setClienteSelecionado({ ...clienteSelecionado, observacoes: e.target.value })}
                      placeholder="Ex: Alérgica a tecidos sintéticos, prefere modelo tubinho clássico..."
                    />
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      className="px-5 py-2.5 rounded-xl bg-atelier-700 hover:bg-atelier-800 text-white text-xs font-bold transition-all shadow-sm shadow-atelier-850/15"
                    >
                      Actualizar Dados do Cliente
                    </button>
                  </div>
                </form>
              )}

              {/* TAB 2: MEASURES AND TIMELINES */}
              {currentTab === 'medidas' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  
                  {/* Register New Measures */}
                  <div className="space-y-4">
                    <h4 className="text-sm font-bold text-slate-900 border-b pb-1.5">📐 Registar Novas Medidas</h4>
                    
                    <form onSubmit={handleSalvarNovasMedidas} className="grid grid-cols-2 gap-3.5">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-500">Busto (cm)</label>
                        <input
                          type="number"
                          className="w-full px-3 py-1.5 text-xs border border-gray-200 rounded-lg bg-slate-50 text-slate-800"
                          value={medidaBusto}
                          onChange={(e) => setMedidaBusto(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-500">Cintura (cm)</label>
                        <input
                          type="number"
                          className="w-full px-3 py-1.5 text-xs border border-gray-200 rounded-lg bg-slate-50 text-slate-800"
                          value={medidaCintura}
                          onChange={(e) => setMedidaCintura(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-500">Quadril (cm)</label>
                        <input
                          type="number"
                          className="w-full px-3 py-1.5 text-xs border border-gray-200 rounded-lg bg-slate-50 text-slate-800"
                          value={medidaQuadril}
                          onChange={(e) => setMedidaQuadril(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-500">Ombro a Ombro (cm)</label>
                        <input
                          type="number"
                          className="w-full px-3 py-1.5 text-xs border border-gray-200 rounded-lg bg-slate-50 text-slate-800"
                          value={medidaOmbro}
                          onChange={(e) => setMedidaOmbro(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-500">Comprimento Tronco (cm)</label>
                        <input
                          type="number"
                          className="w-full px-3 py-1.5 text-xs border border-gray-200 rounded-lg bg-slate-50 text-slate-800"
                          value={medidaTronco}
                          onChange={(e) => setMedidaTronco(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-500">Manga (cm)</label>
                        <input
                          type="number"
                          className="w-full px-3 py-1.5 text-xs border border-gray-200 rounded-lg bg-slate-50 text-slate-800"
                          value={medidaManga}
                          onChange={(e) => setMedidaManga(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-500">Comprimento Saia (cm)</label>
                        <input
                          type="number"
                          className="w-full px-3 py-1.5 text-xs border border-gray-200 rounded-lg bg-slate-50 text-slate-800"
                          value={medidaSaia}
                          onChange={(e) => setMedidaSaia(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-500">Comprimento Calça (cm)</label>
                        <input
                          type="number"
                          className="w-full px-3 py-1.5 text-xs border border-gray-200 rounded-lg bg-slate-50 text-slate-800"
                          value={medidaCalca}
                          onChange={(e) => setMedidaCalca(e.target.value)}
                        />
                      </div>
                      
                      <div className="col-span-2">
                        <label className="block text-[11px] font-semibold text-slate-500">Notas sobre as medidas</label>
                        <textarea
                          rows={2}
                          className="w-full px-3 py-1.5 text-xs border border-gray-200 rounded-lg bg-slate-50 text-slate-800"
                          placeholder="Ex: ombro esquerdo ligeiramente mais baixo..."
                          value={medidaObs}
                          onChange={(e) => setMedidaObs(e.target.value)}
                        />
                      </div>

                      <div className="col-span-2 pt-2">
                        <button
                          type="submit"
                          className="w-full py-2 bg-atelier-800 hover:bg-atelier-950 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
                        >
                          Salvar Novas Medidas
                        </button>
                      </div>
                    </form>
                  </div>

                  {/* Most Recent & Accordion panels history */}
                  <div className="space-y-4">
                    <h4 className="text-sm font-bold text-slate-900 border-b pb-1.5 flex items-center justify-between">
                      <span>📉 Histórico de Medições</span>
                      <span className="text-[11px] font-normal text-slate-400">Clique para expandir registros</span>
                    </h4>

                    {/* Check if warning banner needed */}
                    {isMedidaDesatualizada(clienteSelecionado.id) && (
                      <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-[11px] text-amber-900 flex items-start gap-2.5">
                        <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                        <div>
                          <strong>⚠️ Medidas desactualizadas (+90 dias)</strong>
                          <p>Verifique estas medidas com a cliente antes de cortar os moldes de tecido para evitar danos na peça.</p>
                        </div>
                      </div>
                    )}

                    {localDb.getMedidas(atelie.id, clienteSelecionado.id).length === 0 ? (
                      <div className="p-6 border border-dashed rounded-2xl text-center text-xs text-slate-400">
                        Nenhuma medida registrada para este cliente. Utilize o formulário para fazer a primeira.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {localDb.getMedidas(atelie.id, clienteSelecionado.id).map((med, index) => {
                          const open = accordionAberto[med.id] || index === 0; // Pronta aberta a primeira
                          const dateStr = new Date(med.registradoEm).toLocaleString('pt-AO');
                          
                          return (
                            <div key={med.id} className="border border-atelier-100 rounded-2xl overflow-hidden bg-[#faf8f5]">
                              <button
                                type="button"
                                onClick={() => togglingAccordion(med.id)}
                                className="w-full px-4 py-3 bg-white hover:bg-slate-50 transition-colors flex items-center justify-between border-b border-atelier-50"
                              >
                                <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                                  <Calendar className="w-3.5 h-3.5 text-atelier-500" /> {dateStr}
                                  {index === 0 && <span className="text-[9px] px-1.5 py-0.5 bg-emerald-100 text-emerald-800 font-mono rounded font-bold ml-1">RECENTE</span>}
                                </span>
                                {open ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                              </button>

                              {open && (
                                <div className="p-4 grid grid-cols-2 sm:grid-cols-3 gap-y-3 gap-x-1.5 text-xs text-slate-700 bg-white/40">
                                  <div><span className="text-[10px] text-slate-400 block font-medium">Busto:</span> <strong className="text-slate-900">{med.busto ? `${med.busto} cm` : '—'}</strong></div>
                                  <div><span className="text-[10px] text-slate-400 block font-medium">Cintura:</span> <strong className="text-slate-900">{med.cintura ? `${med.cintura} cm` : '—'}</strong></div>
                                  <div><span className="text-[10px] text-slate-400 block font-medium">Quadril:</span> <strong className="text-slate-900">{med.quadril ? `${med.quadril} cm` : '—'}</strong></div>
                                  <div><span className="text-[10px] text-slate-400 block font-medium">Ombro:</span> <strong className="text-slate-900">{med.ombro ? `${med.ombro} cm` : '—'}</strong></div>
                                  <div><span className="text-[10px] text-slate-400 block font-medium">Cod. Tronco:</span> <strong className="text-slate-900">{med.comprimentoTronco ? `${med.comprimentoTronco} cm` : '—'}</strong></div>
                                  <div><span className="text-[10px] text-slate-400 block font-medium">Manga:</span> <strong className="text-slate-900">{med.manga ? `${med.manga} cm` : '—'}</strong></div>
                                  <div><span className="text-[10px] text-slate-400 block font-medium">Saia:</span> <strong className="text-slate-900">{med.comprimentoSaia ? `${med.comprimentoSaia} cm` : '—'}</strong></div>
                                  <div><span className="text-[10px] text-slate-400 block font-medium">Calça:</span> <strong className="text-slate-900">{med.comprimentoCalca ? `${med.comprimentoCalca} cm` : '—'}</strong></div>
                                  
                                  {med.observacoes && (
                                    <div className="col-span-full border-t border-slate-100 pt-2 text-[11px] text-slate-500">
                                      ✏️ {med.observacoes}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                </div>
              )}

              {/* TAB 3: CUSTOMER ORDER HISTORY */}
              {currentTab === 'pedidos' && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-bold text-slate-900">👜 Histórico de Encomendas / Pedidos</h4>
                    {onNavigateToCreateOrder && (
                      <button
                        onClick={() => onNavigateToCreateOrder(clienteSelecionado.id)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-atelier-700 hover:bg-atelier-850 text-white text-xs font-bold transition-all shadow-sm"
                      >
                        <PlusCircle className="w-3.5 h-3.5" /> Novo Pedido Directo
                      </button>
                    )}
                  </div>

                  {localDb.getPedidos(atelie.id, clienteSelecionado.id).length === 0 ? (
                    <div className="p-6 border border-dashed rounded-3xl text-center text-xs text-slate-400">
                      Esta cliente ainda não tem histórico de pedidos registrados no sistema.
                    </div>
                  ) : (
                    <div className="border border-atelier-100 rounded-2xl overflow-hidden bg-white">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs min-w-[600px] border-collapse">
                        <thead>
                          <tr className="bg-atelier-50/70 border-b border-atelier-100 text-slate-700 font-bold">
                            <th className="p-3">Descrição da Peça</th>
                            <th className="p-3">Tipo</th>
                            <th className="p-3">Prazo Entrega</th>
                            <th className="p-3">Estado</th>
                            <th className="p-3 text-right">Valor Total ({PAISES_CONFIG[getAtelieCountry(atelie)].moeda})</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {localDb.getPedidos(atelie.id, clienteSelecionado.id).map((ped) => (
                            <tr key={ped.id} className="hover:bg-slate-50/50">
                              <td className="p-3 font-medium text-slate-900">
                                {ped.descricao}
                                {ped.tecido && <span className="text-[10px] text-slate-400 block mt-0.5">Tecido: {ped.tecido}</span>}
                              </td>
                              <td className="p-3"><span className="px-1.5 py-0.5 bg-atelier-100/50 text-atelier-900 rounded uppercase text-[10px] font-mono">{ped.tipoPeca}</span></td>
                              <td className="p-3 text-slate-500">{new Date(ped.prazoEntrega).toLocaleDateString('pt-AO')}</td>
                              <td className="p-3">
                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                                  ped.status === 'entregue' ? 'bg-emerald-100 text-emerald-800' :
                                  ped.status === 'finalizado' ? 'bg-sky-100 text-sky-800' :
                                  ped.status === 'em_andamento' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'
                                }}`}>
                                  {ped.status === 'em_andamento' ? 'EM MANUFATURA' : ped.status.toUpperCase()}
                                </span>
                              </td>
                              <td className="p-3 text-right font-semibold font-mono text-slate-900">{formatarMoeda(ped.valor, atelie)}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="bg-atelier-50/40 border-t border-atelier-100 font-bold text-slate-950">
                            <td colSpan={4} className="p-3 text-right font-display text-sm">Finanças totais pagas/gastas por este cliente:</td>
                            <td className="p-3 text-right font-mono text-sm leading-none text-emerald-800">
                              {formatarMoeda(
                                localDb.getPedidos(atelie.id, clienteSelecionado.id).reduce((acc, p) => acc + p.valor, 0),
                                atelie
                              )}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                    </div>
                  )}
                </div>
              )}

            </div>
          </div>
        </div>
      ) : (
        /* LIST SEARCH OVERVIEW */
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold font-display tracking-tight text-gray-950">Minha carteira de Clientes</h2>
              <p className="text-xs text-gray-500">Registe e consulte as fichas de medidas e ficheiros e histórico de encomendas das suas clientes.</p>
            </div>
            
            <button
              onClick={() => {
                if (atelie.plano === 'basico' && clientes.length >= 30) {
                  toast.error('Limite de 30 clientes atingido para o plano Básico! Atualize para o plano Pro para cadastrar clientes ilimitados.');
                } else {
                  setMostrarNovoForm(!mostrarNovoForm);
                }
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-atelier-700 hover:bg-atelier-850 text-white text-xs font-bold transition-all shadow-sm shadow-atelier-800/20"
            >
              <PlusCircle className="w-4 h-4" /> Nova Cliente
            </button>
          </div>

          {/* Plan capacity indicator progress bar */}
          <div className="p-4 bg-white border border-slate-200/90 rounded-2xl shadow-xs space-y-2.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
              <div className="space-y-0.5">
                <p className="font-bold flex items-center gap-1.5 text-slate-850">
                  {atelie.plano === 'basico' ? (
                    <>
                      <span>📊 Status da Assinatura:</span>
                      <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 font-bold uppercase text-[9.5px]">Plano Básico / Económico</span>
                    </>
                  ) : (
                    <>
                      <span>👑 Status da Assinatura:</span>
                      <span className="px-2.5 py-0.5 rounded-full bg-atelier-100 text-atelier-800 font-extrabold uppercase text-[9.5px] border border-atelier-200 animate-pulse">Plano Pro Completo</span>
                    </>
                  )}
                </p>
                <p className="text-[11px] text-slate-500">
                  {atelie.plano === 'basico' 
                    ? "Limite fixado em 30 pastas de clientes ativas." 
                    : "Sua carteira de clientes não possui limites de dossier ativos."
                  }
                </p>
              </div>
              <div className="text-right sm:shrink-0">
                <p className="font-bold font-mono text-slate-900">
                  {clientes.length} {clientes.length === 1 ? 'Cliente cadastrado' : 'Clientes cadastrados'}
                  {atelie.plano === 'basico' && ' / 30 máximo'}
                </p>
              </div>
            </div>

            {atelie.plano === 'basico' && (
              <div className="space-y-1.5">
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all duration-500 ${
                      clientes.length >= 30 
                        ? 'bg-rose-500' 
                        : clientes.length >= 25 
                        ? 'bg-amber-500' 
                        : 'bg-atelier-600'
                    }`}
                    style={{ width: `${Math.min((clientes.length / 30) * 100, 100)}%` }}
                  ></div>
                </div>
                {clientes.length >= 30 ? (
                  <p className="text-[10px] text-rose-500 font-bold font-sans">
                    ⚠️ Limite de clientes atingido! Atualize para o Pro completo na secção de Configurações para desbloquear fichas e medidas ilimitadas.
                  </p>
                ) : clientes.length >= 25 ? (
                  <p className="text-[10px] text-amber-600 font-bold font-sans">
                    ⚠️ Restam apenas {30 - clientes.length} vagas de cliente. Atualize para o plano Pro Completo hoje e garanta espaço ilimitado!
                  </p>
                ) : null}
              </div>
            )}
          </div>

          {/* New Customer Form toggler */}
          {mostrarNovoForm && (
            <div className="p-6 bg-white border border-atelier-200/85 rounded-3xl shadow-sm max-w-2xl">
              <h3 className="text-sm font-bold text-slate-900 border-b pb-1.5 mb-4">🆕 Cadastrar Nova Cliente</h3>
              <form onSubmit={handleSalvarCliente} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Nome Completo</label>
                  <input
                    type="text"
                    required
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:ring-1 focus:ring-atelier-500 focus:outline-none"
                    placeholder="Ex: Maria João"
                    value={novoNome}
                    onChange={(e) => setNovoNome(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Nº Telefone / WhatsApp</label>
                  <input
                    type="text"
                    required
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:ring-1 focus:ring-atelier-500 focus:outline-none font-mono"
                    placeholder="Ex: 244923000000"
                    value={novoTelefone}
                    onChange={(e) => setNovoTelefone(e.target.value)}
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">Insira o prefixo de Angola (244) para as chamadas e links directos.</span>
                </div>
                <div className="col-span-1 sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-600 mb-1">E-mail (opcional)</label>
                  <input
                    type="email"
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:ring-1 focus:ring-atelier-500 focus:outline-none"
                    placeholder="Ex: cliente@provador.ao"
                    value={novoEmail}
                    onChange={(e) => setNovoEmail(e.target.value)}
                  />
                </div>
                <div className="col-span-1 sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-600 mb-1">Notas adicionais (opcional)</label>
                  <textarea
                    rows={2.5}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:ring-1 focus:ring-atelier-500 focus:outline-none"
                    placeholder="Ex: Gosta de drapeados, etc."
                    value={novaObs}
                    onChange={(e) => setNovaObs(e.target.value)}
                  />
                </div>

                <div className="col-span-1 sm:col-span-2 pt-2 flex gap-2">
                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-atelier-700 hover:bg-atelier-850 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
                  >
                    Salvar Cliente
                  </button>
                  <button
                    type="button"
                    onClick={() => setMostrarNovoForm(false)}
                    className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-medium transition-all"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Filtering bar search */}
          <div className="relative max-w-md">
            <input
              type="text"
              className="w-full pl-10 pr-4 py-2.5 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-atelier-500 bg-white"
              placeholder="Buscar cliente por nome ou telefone..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
          </div>

          {/* GRID OF PROFILE PROFILE CARDS */}
          {filteredClientes.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400 border border-dashed rounded-3xl bg-white">
              Nenhuma cliente encontrada com os critérios de pesquisa indicados.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredClientes.map((cliente) => {
                const outdated = isMedidaDesatualizada(cliente.id);
                const lastMeasureDate = getMaisRecenteDataMedida(cliente.id);
                
                return (
                  <div
                    key={cliente.id}
                    onClick={() => {
                      setClienteSelecionado(cliente);
                      setCurrentTab('dados');
                    }}
                    className="bg-white p-5 cursor-pointer rounded-3xl border border-atelier-200/80 shadow-sm shadow-slate-900/5 hover:shadow-md hover:border-atelier-300 transition-all text-left flex flex-col justify-between group"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900 group-hover:text-atelier-700 transition-colors">{cliente.nome}</span>
                        <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 transition-transform" />
                      </div>
                      
                      <p className="text-xs text-slate-500 font-mono">📱 +{cliente.telefone}</p>
                      {cliente.email && <p className="text-[11px] text-slate-400 truncate">✉️ {cliente.email}</p>}
                    </div>

                    <div className="border-t border-slate-100 pt-3 mt-4 flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        {outdated ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-[9px] font-bold leading-none animate-pulse">
                            <AlertTriangle className="w-3 h-3 text-amber-600" /> Medidas Outdated
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-250 text-[9px] font-bold leading-none">
                            Medidas OK
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-400 font-medium">
                        {lastMeasureDate ? `Ficha de: ${lastMeasureDate}` : 'Sem medidas'}
                      </span>
                    </div>

                  </div>
                );
              })}
            </div>
          )}

        </div>
      )}

    </div>
  );
}
