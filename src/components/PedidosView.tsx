import React, { useState, useEffect, useMemo } from 'react';
import { localDb } from '../firebase';
import { Atelie, Cliente, Pedido, TipoPeca, PedidoStatus } from '../types';
import { Search, PlusCircle, Filter, Calendar, DollarSign, Image as ImageIcon, CheckCircle, Clock, Eye, AlertCircle, Trash2, Lock, Link, Save, HelpCircle, Maximize2, ExternalLink } from 'lucide-react';
import { toast } from '../lib/toast';
import { formatarMoeda, getAtelieCountry, PAISES_CONFIG } from '../lib/localization';

interface PedidosViewProps {
  atelie: Atelie;
  preselectedClientId?: string | null;
  onClearPreselect?: () => void;
}

export default function PedidosView({ atelie, preselectedClientId, onClearPreselect }: PedidosViewProps) {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [busca, setBusca] = useState('');
  const [statusFiltro, setStatusFiltro] = useState<string>('todos');
  
  // Create / Form toggler states
  const [mostrarNovoForm, setMostrarNovoForm] = useState(false);
  
  // Form fields
  const [clienteId, setClienteId] = useState('');
  const [descricao, setDescricao] = useState('');
  const [tipoPeca, setTipoPeca] = useState<TipoPeca>('vestido');
  const [tecido, setTecido] = useState('');
  const [valor, setValor] = useState('');
  const [sinalPago, setSinalPago] = useState('');
  const [prazoEntrega, setPrazoEntrega] = useState('');
  const [status, setStatus] = useState<PedidoStatus>('em_andamento');
  const [fotoReferencia, setFotoReferencia] = useState('');
  const [observacoes, setObservacoes] = useState('');

  // Selected for visual modals
  const [visualizandoFoto, setVisualizandoFoto] = useState<string | null>(null);
  const [pedidoFotoEdit, setPedidoFotoEdit] = useState<Pedido | null>(null);
  const [tempFotoUrl, setTempFotoUrl] = useState('');
  const [exibirDicasPinterest, setExibirDicasPinterest] = useState(false);
  const [pedidoParaExcluir, setPedidoParaExcluir] = useState<Pedido | null>(null);
  const [visualizarImagemGrande, setVisualizarImagemGrande] = useState(false);
  const [modoAjusteImagem, setModoAjusteImagem] = useState<'contain' | 'cover'>('contain');
  const [fundoEscuroLightbox, setFundoEscuroLightbox] = useState(true);

  useEffect(() => {
    loadData();
    const unsub = localDb.onDataChange(() => {
      loadData();
    });
    return () => unsub();
  }, [atelie.id]);

  useEffect(() => {
    if (preselectedClientId) {
      setClienteId(preselectedClientId);
      setMostrarNovoForm(true);
    }
  }, [preselectedClientId]);

  const loadData = () => {
    setPedidos(localDb.getPedidos(atelie.id).sort((a, b) => b.criadoEm.localeCompare(a.criadoEm)));
    setClientes(localDb.getClientes(atelie.id));
  };

  const handleSalvarPedido = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clienteId || !descricao || !valor || !prazoEntrega) {
      toast.warn('Preencha todos os campos obrigatórios!');
      return;
    }

    const clienteObj = clientes.find(c => c.id === clienteId);
    if (!clienteObj) return;

    const novoPedido: Pedido = {
      id: 'ped_' + Math.random().toString(36).substr(2, 9),
      clienteId,
      clienteNome: clienteObj.nome,
      clienteTelefone: clienteObj.telefone,
      descricao,
      tipoPeca,
      tecido,
      valor: Number(valor),
      sinalPago: sinalPago ? Number(sinalPago) : 0,
      prazoEntrega: new Date(prazoEntrega).toISOString(),
      status,
      fotoReferenciaUrl: fotoReferencia || 'https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&q=80&w=400', // Padrão algodão/cabide
      observacoes: observacoes || undefined,
      criadoEm: new Date().toISOString(),
      atualizadoEm: new Date().toISOString()
    };

    localDb.savePedido(atelie.id, novoPedido);
    
    // Reset form
    setClienteId('');
    setDescricao('');
    setTipoPeca('vestido');
    setTecido('');
    setValor('');
    setSinalPago('');
    setPrazoEntrega('');
    setFotoReferencia('');
    setObservacoes('');
    setMostrarNovoForm(false);
    
    // Clear parental preselection callbacks
    if (onClearPreselect) onClearPreselect();
    
    loadData();
  };

  const handleUpdateStatus = (pedidoId: string, novoSt: PedidoStatus) => {
    const list = localDb.getPedidos(atelie.id);
    const ped = list.find(p => p.id === pedidoId);
    if (ped) {
      if (ped.status === 'entregue' || ped.status === 'cancelado') {
        toast.warn('Esta encomenda já se encontra finalizada/entregue ou cancelada e não pode ser alterada.');
        return;
      }
      ped.status = novoSt;
      ped.atualizadoEm = new Date().toISOString();
      localDb.savePedido(atelie.id, ped);
      loadData();
    }
  };

  const handleAddSinalValue = (pedidoId: string, extraSinal: string) => {
    if (!extraSinal) return;
    const list = localDb.getPedidos(atelie.id);
    const ped = list.find(p => p.id === pedidoId);
    if (ped) {
      if (ped.status === 'entregue' || ped.status === 'cancelado') {
        toast.warn('Esta encomenda já se encontra finalizada/entregue ou cancelada e não pode ser editada.');
        return;
      }
      const soma = ped.sinalPago + Number(extraSinal);
      if (soma > ped.valor) {
        toast.warn('O valor do sinal total não pode ser superior ao valor da peça!');
        return;
      }
      ped.sinalPago = soma;
      ped.atualizadoEm = new Date().toISOString();
      localDb.savePedido(atelie.id, ped);
      loadData();
    }
  };

  const handleUpdateFotoReferencia = (novoUrl: string) => {
    if (!pedidoFotoEdit) return;
    const list = localDb.getPedidos(atelie.id);
    const ped = list.find(p => p.id === pedidoFotoEdit.id);
    if (ped) {
      ped.fotoReferenciaUrl = novoUrl;
      ped.atualizadoEm = new Date().toISOString();
      localDb.savePedido(atelie.id, ped);
      loadData();
      toast.success('Imagem de referência do modelo atualizada!');
    }
  };

  const handleDeletePedido = (id: string) => {
    localDb.deletePedido(atelie.id, id);
    loadData();
    setPedidoParaExcluir(null);
    toast.success('Encomenda excluída com sucesso.');
  };

  const filteredPedidos = useMemo(() => {
    return pedidos.filter(p => {
      const batBusca = p.clienteNome.toLowerCase().includes(busca.toLowerCase()) || p.descricao.toLowerCase().includes(busca.toLowerCase());
      const batSt = statusFiltro === 'todos' || p.status === statusFiltro;
      return batBusca && batSt;
    });
  }, [pedidos, busca, statusFiltro]);

  return (
    <div className="space-y-6">

      {/* Header view controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold font-display tracking-tight text-gray-950">Encomendas & Servicos de Costura</h2>
          <p className="text-xs text-gray-500">Desenhe os pedidos das clientes, atribua tecidos, sinalize pagamentos e calendarize entregas.</p>
        </div>

        <button
          onClick={() => setMostrarNovoForm(!mostrarNovoForm)}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-atelier-700 hover:bg-atelier-800 text-white text-xs font-bold transition-all shadow-sm"
        >
          <PlusCircle className="w-4 h-4" /> Novo Pedido
        </button>
      </div>

      {/* Form creation drawer */}
      {mostrarNovoForm && (
        <div className="p-6 bg-white border border-atelier-200 rounded-3xl shadow-sm max-w-3xl">
          <div className="flex justify-between items-center border-b border-slate-150 pb-2 mb-4">
            <h3 className="text-sm font-bold text-slate-900">👜 Desenhar Nova Encomenda / Ajuste</h3>
            <button
              onClick={() => {
                setMostrarNovoForm(false);
                if (onClearPreselect) onClearPreselect();
              }}
              className="text-xs font-bold text-red-600 hover:text-red-800"
            >
              Fechar Desenho
            </button>
          </div>

          <form onSubmit={handleSalvarPedido} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              
              {/* Select corresponding Customer */}
              <div className="col-span-1 sm:col-span-2 lg:col-span-1">
                <label className="block text-xs font-bold text-slate-600 mb-1">Selecione a Cliente</label>
                <select
                  required
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl bg-slate-50 focus:outline-none"
                  value={clienteId}
                  onChange={(e) => setClienteId(e.target.value)}
                >
                  <option value="">-- Escolher Cliente --</option>
                  {clientes.map(c => (
                    <option key={c.id} value={c.id}>{c.nome} (+{c.telefone})</option>
                  ))}
                </select>
                {clientes.length === 0 && (
                  <span className="text-[10px] text-red-500 block mt-1">Nenhuma cliente registada ainda. Por favor, adicione na aba Clientes primeiro.</span>
                )}
              </div>

              {/* Peça types classification */}
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Tipo de Peça</label>
                <select
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl bg-slate-50 focus:outline-none"
                  value={tipoPeca}
                  onChange={(e) => setTipoPeca(e.target.value as TipoPeca)}
                >
                  <option value="vestido">Vestido</option>
                  <option value="calca">Calça</option>
                  <option value="saia">Saia</option>
                  <option value="camisa">Camisa</option>
                  <option value="blazer">Blazer</option>
                  <option value="ajuste">Bainha / Ajuste Rápido</option>
                  <option value="outro">Outro Modelo</option>
                </select>
              </div>

              {/* Tecido description */}
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Tecido utilizado</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl bg-slate-50 focus:outline-none"
                  placeholder="Ex: Samakaka, Cetim..."
                  value={tecido}
                  onChange={(e) => setTecido(e.target.value)}
                />
              </div>

              {/* Descrição detailed design */}
              <div className="col-span-1 sm:col-span-2">
                <label className="block text-xs font-bold text-slate-600 mb-1">Descrição Detalhada do Modelo</label>
                <input
                  type="text"
                  required
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl bg-slate-50 focus:outline-none"
                  placeholder="Ex: Vestido Samakaka trespassado com gola alta e mangas bufantes"
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                />
              </div>

              {/* Valor total with dynamic country currency */}
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">
                  Valor do Trabalho ({PAISES_CONFIG[getAtelieCountry(atelie)].moeda})
                </label>
                <input
                  type="number"
                  required
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl bg-slate-50 focus:outline-none font-mono"
                  placeholder={`Ex: ${PAISES_CONFIG[getAtelieCountry(atelie)].basicPrice * 5}`}
                  value={valor}
                  onChange={(e) => setValor(e.target.value)}
                />
              </div>

              {/* Downpayment signal value with dynamic country currency */}
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">
                  Valor do Sinal Pago ({PAISES_CONFIG[getAtelieCountry(atelie)].moeda})
                </label>
                <input
                  type="number"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl bg-slate-50 focus:outline-none font-mono"
                  placeholder={`Ex: ${PAISES_CONFIG[getAtelieCountry(atelie)].basicPrice * 2}`}
                  value={sinalPago}
                  onChange={(e) => setSinalPago(e.target.value)}
                />
              </div>

              {/* Deadline completion calendar */}
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Prazo de Entrega</label>
                <input
                  type="date"
                  required
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl bg-slate-50 focus:outline-none font-mono text-slate-700"
                  value={prazoEntrega}
                  onChange={(e) => setPrazoEntrega(e.target.value)}
                />
              </div>

              {/* Picture reference URL */}
              <div className="col-span-1 sm:col-span-2">
                <label className="block text-xs font-bold text-slate-600 mb-1">Foto de Referência (URL de Imagem)</label>
                <input
                  type="url"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl bg-slate-50 focus:outline-none"
                  placeholder="Cole um link de imagem do modelo de referência (Ex: Pinterest, etc.)"
                  value={fotoReferencia}
                  onChange={(e) => setFotoReferencia(e.target.value)}
                />
              </div>

              {/* Initial Status config select */}
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Estado de Manufatura</label>
                <select
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl bg-slate-50 focus:outline-none"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as PedidoStatus)}
                >
                  <option value="em_andamento">Em Manufatura</option>
                  <option value="aguardando_prova">Aguardando Prova</option>
                  <option value="finalizado">Finalizado / Lavagem</option>
                  <option value="entregue">Peça Entregue ao Cliente</option>
                  <option value="cancelado">Cancelado</option>
                </select>
              </div>

              <div className="col-span-1 sm:col-span-3">
                <label className="block text-xs font-bold text-slate-600 mb-1">Notas Internas ou Observações extras</label>
                <textarea
                  rows={2}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl bg-slate-50 focus:outline-none"
                  placeholder="Bebidas oferecidas na prova, fecho zip metálico nas costas..."
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                />
              </div>

            </div>

            <div className="pt-2 flex gap-2">
              <button
                type="submit"
                className="px-5 py-2.5 bg-atelier-700 hover:bg-atelier-800 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
              >
                Salvar Desenho de Encomenda
              </button>
              <button
                type="button"
                onClick={() => {
                  setMostrarNovoForm(false);
                  if (onClearPreselect) onClearPreselect();
                }}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-705 rounded-xl text-xs font-medium transition-all"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* FILTER BUTTONS AND SEARCH OVERVIEW BAR */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 select-none">
        
        {/* Filtering inputs */}
        <div className="relative max-w-sm flex-1">
          <input
            type="text"
            className="w-full pl-10 pr-4 py-2 px-3 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-atelier-500 bg-white"
            placeholder="Prequise por modelo ou cliente..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
        </div>

        {/* State filters pills */}
        <div className="flex flex-wrap items-center gap-1.5 bg-atelier-50 p-1.5 rounded-2xl border border-atelier-100 max-w-fit">
          {[
            { id: 'todos', label: 'Todos' },
            { id: 'em_andamento', label: 'Manufatura' },
            { id: 'aguardando_prova', label: 'Provando' },
            { id: 'finalizado', label: 'Finalizado' },
            { id: 'entregue', label: 'Entregues' },
            { id: 'cancelado', label: 'Cancelado' }
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setStatusFiltro(f.id)}
              className={`py-1.5 px-3 rounded-lg text-xs font-semibold transition-all ${
                statusFiltro === f.id
                  ? 'bg-atelier-800 text-white shadow-sm font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

      </div>

      {/* ORDERS LIST COMPONENT */}
      {filteredPedidos.length === 0 ? (
        <div className="py-12 text-center text-xs text-slate-400 border border-dashed rounded-3xl bg-white">
          Nenhum registo de encomenda coincide com a sua busca ou filtros actuais.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {filteredPedidos.map((pedido) => {
            const deliveryDateStr = new Date(pedido.prazoEntrega).toLocaleDateString('pt-AO');
            const pendingPay = pedido.valor - pedido.sinalPago;
            const percentageCollected = Math.round((pedido.sinalPago / pedido.valor) * 100);

            return (
              <div
                key={pedido.id}
                className="bg-white rounded-3xl border border-atelier-200/80 shadow-sm overflow-hidden flex flex-col justify-between"
              >
                
                {/* Upper description part */}
                <div className="p-5 space-y-3.5">
                  <div className="flex items-start justify-between gap-2.5">
                    <div>
                      <h4 className="text-sm font-bold text-gray-950 font-display leading-tight">{pedido.descricao}</h4>
                      <p className="text-xs text-atelier-700 font-semibold mt-1">Cliente: <span className="text-slate-900 font-bold">{pedido.clienteNome}</span></p>
                    </div>
                    
                    {/* Tiny dropdown status controller */}
                    <select
                      className={`text-[10px] py-1 px-1.5 rounded font-bold ${
                        pedido.status === 'entregue' ? 'bg-emerald-100 text-emerald-800' :
                        pedido.status === 'finalizado' ? 'bg-sky-100 text-sky-800' :
                        pedido.status === 'em_andamento' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'
                      }`}
                      value={pedido.status}
                      disabled={pedido.status === 'entregue' || pedido.status === 'cancelado'}
                      onChange={(e) => handleUpdateStatus(pedido.id, e.target.value as PedidoStatus)}
                    >
                      <option value="em_andamento">Em Manufatura</option>
                      <option value="aguardando_prova">Aguardando Prova</option>
                      <option value="finalizado">Finalizado</option>
                      <option value="entregue">Entregue</option>
                      <option value="cancelado">Cancelado</option>
                    </select>
                  </div>

                  <div className="font-mono text-[11px] text-slate-500 space-y-1 bg-atelier-50/50 p-2.5 rounded-xl border border-atelier-100/60">
                    <p>✂️ <strong>Tipo:</strong> {pedido.tipoPeca.toUpperCase()} {pedido.tecido && `· Tecido: ${pedido.tecido}`}</p>
                    <p>📅 <strong>Entrega:</strong> {deliveryDateStr}</p>
                    {pedido.observacoes && <p className="text-sky-950 italic">💡 {pedido.observacoes}</p>}
                  </div>

                  {/* signal payment balance bar */}
                  <div className="space-y-1 pt-1.5">
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span className="text-slate-500">Fluxo Sinal / Pendente</span>
                      <span className={pendingPay === 0 ? 'text-emerald-700' : 'text-amber-700'}>
                        {percentageCollected}% Pago ({formatarMoeda(pedido.sinalPago, atelie)})
                      </span>
                    </div>
                    {/* Simulated progress indicator */}
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${pendingPay === 0 ? 'bg-emerald-600' : 'bg-amber-500'}`}
                        style={{ width: `${Math.min(100, Math.max(0, percentageCollected))}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[11px] font-mono font-medium pt-1 text-slate-500">
                      <span>Valor total: <strong>{formatarMoeda(pedido.valor, atelie)}</strong></span>
                      <span>Em falta: <strong className="text-red-700">{formatarMoeda(pendingPay, atelie)}</strong></span>
                    </div>
                  </div>

                  {/* Small signal collection option if unpaid and not delivered/canceled */}
                  {pendingPay > 0 && pedido.status !== 'entregue' && pedido.status !== 'cancelado' && (
                    <div className="pt-2 border-t border-slate-50 flex items-center gap-1.5">
                      <input
                        type="number"
                        placeholder={`Novo sinal (${PAISES_CONFIG[getAtelieCountry(atelie)].moeda})`}
                        className="w-1/2 p-1.5 text-xs text-slate-700 border border-slate-200 rounded bg-slate-50 font-mono"
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            const val = (e.target as HTMLInputElement).value;
                            handleAddSinalValue(pedido.id, val);
                            (e.target as HTMLInputElement).value = '';
                          }
                        }}
                      />
                      <span className="text-[10px] text-slate-400">Pressione Enter para registar reforço de valores.</span>
                    </div>
                  )}

                  {/* Locked order notice if delivered or canceled */}
                  {(pedido.status === 'entregue' || pedido.status === 'cancelado') && (
                    <div className="pt-2 border-t border-slate-100 flex items-center gap-1.5 text-[10px] text-slate-500 font-semibold bg-slate-50/55 px-2.5 py-1.5 rounded-lg select-none">
                      <Lock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>{pedido.status === 'entregue' ? 'Encomenda entregue — edição bloqueada' : 'Encomenda cancelada — edição bloqueada'}</span>
                    </div>
                  )}

                </div>

                {/* Footer and ref photo visual controls */}
                <div className="px-5 py-3 bg-atelier-50/50 border-t border-atelier-100 flex items-center justify-between">
                  <button
                    onClick={() => {
                      setVisualizandoFoto(pedido.fotoReferenciaUrl || 'https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&q=80&w=400');
                      setPedidoFotoEdit(pedido);
                      setTempFotoUrl(pedido.fotoReferenciaUrl || 'https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&q=80&w=400');
                    }}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 hover:text-slate-900 cursor-pointer"
                  >
                    <ImageIcon className="w-4 h-4 text-atelier-500" /> Ver Modelo Foto
                  </button>

                  <button
                    onClick={() => setPedidoParaExcluir(pedido)}
                    className="text-slate-400 hover:text-red-700 p-1.5 hover:bg-red-55/70 rounded-lg transition-colors cursor-pointer"
                    title="Excluir Encomenda"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

              </div>
            );
          })}
        </div>
      )}

      {/* Visual Reference Photo Modals */}
      {visualizandoFoto && (() => {
        const isPinterestPage = tempFotoUrl.includes('pinterest.com/') || tempFotoUrl.includes('pin.it/');
        return (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
            <div className="max-w-md w-full bg-white rounded-3xl border border-slate-200 shadow-2xl relative overflow-hidden flex flex-col my-8">
              
              {/* Modal Header */}
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-atelier-100 text-atelier-700 rounded-lg animate-pulse">
                    <ImageIcon className="w-4 h-4" />
                  </div>
                  <h3 className="font-display font-black text-sm text-slate-900 leading-none">
                    Ver & Ajustar Modelo
                  </h3>
                </div>
                <button
                  onClick={() => {
                    setVisualizandoFoto(null);
                    setPedidoFotoEdit(null);
                    setExibirDicasPinterest(false);
                  }}
                  className="p-1.5 hover:bg-slate-100 text-slate-400 hover:text-slate-700 rounded-full text-xs transition font-bold cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto w-full">
                
                {/* Descriptive Notice */}
                <p className="text-[11px] text-slate-500 leading-relaxed bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  Para costura de alta precisão, veja a peça inteira abaixo. Altere o ajuste se necessário ou abra a versão original.
                </p>

                {/* Image Preview Window */}
                <div className="relative rounded-2xl overflow-hidden border border-slate-150 bg-slate-50 flex items-center justify-center group h-72 select-none shadow-inner">
                  
                  {/* Aspect Ratio Toggle Overlays */}
                  {tempFotoUrl && (
                    <div className="absolute top-2.5 left-2.5 flex gap-1 bg-slate-900/80 p-0.5 rounded-lg text-[10px] font-bold text-white shadow-md z-10">
                      <button
                        type="button"
                        onClick={() => setModoAjusteImagem('contain')}
                        className={`px-2 py-1 rounded-md transition cursor-pointer ${modoAjusteImagem === 'contain' ? 'bg-white text-slate-900 shadow-sm font-extrabold' : 'text-slate-300 hover:text-white'}`}
                        title="Ver imagem completa sem nenhum corte nas bordas"
                      >
                        Ajustar (Imagem Completa)
                      </button>
                      <button
                        type="button"
                        onClick={() => setModoAjusteImagem('cover')}
                        className={`px-2 py-1 rounded-md transition cursor-pointer ${modoAjusteImagem === 'cover' ? 'bg-white text-slate-900 shadow-sm font-extrabold' : 'text-slate-300 hover:text-white'}`}
                        title="Preencher toda a tela de prévia"
                      >
                        Preencher
                      </button>
                    </div>
                  )}

                  {/* Interactive Full Screen Shroud Trigger */}
                  {tempFotoUrl && (
                    <div 
                      onClick={() => setVisualizarImagemGrande(true)}
                      className="absolute inset-0 bg-slate-950/0 hover:bg-slate-950/20 transition-all flex items-center justify-center cursor-pointer z-0 group"
                      title="Clique para abrir esta foto em tela cheia"
                    >
                      <div className="bg-slate-900/85 hover:bg-slate-900 text-white text-[11px] font-bold px-3 py-2 rounded-xl shadow-lg flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity transform translate-y-2 group-hover:translate-y-0 duration-200">
                        <Maximize2 className="w-3.5 h-3.5 text-atelier-400 animate-pulse" />
                        Ver Imagem Completa (Tela Cheia) 🔍
                      </div>
                    </div>
                  )}

                  {tempFotoUrl ? (
                    <img
                      src={tempFotoUrl}
                      alt="Referência Croqui / Modelo"
                      className={`w-full h-full object-${modoAjusteImagem} transition-all duration-300`}
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        // Soft placeholder fallback
                        e.currentTarget.src = 'https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&q=80&w=400';
                      }}
                    />
                  ) : (
                    <div className="text-center p-6 space-y-2 select-none">
                      <ImageIcon className="w-10 h-10 text-slate-300 mx-auto" />
                      <p className="text-xs font-bold text-slate-500">Sem imagem configurada</p>
                      <p className="text-[10px] text-slate-400">Insira um link de imagem abaixo para exibir o modelo.</p>
                    </div>
                  )}
                  
                  {/* Real-time Indicator Accent */}
                  <div className="absolute bottom-2.5 left-2.5 bg-slate-900/70 text-white text-[9px] font-mono tracking-wide px-2 py-0.5 rounded uppercase select-none pointer-events-none">
                    Visualização em Tempo Real
                  </div>
                </div>

                {/* Open Full-Size CTA Buttons */}
                {tempFotoUrl && (
                  <div className="grid grid-cols-1 gap-2">
                    <button
                      type="button"
                      onClick={() => setVisualizarImagemGrande(true)}
                      className="w-full flex items-center justify-center gap-2 py-3 bg-atelier-50 border border-atelier-200 hover:border-atelier-300 hover:bg-atelier-100 text-atelier-900 text-xs font-black rounded-2xl transition cursor-pointer select-none shadow-sm"
                    >
                      <Maximize2 className="w-4 h-4 text-atelier-700 animate-bounce" />
                      Visualizar Imagem Completa (Tela Cheia)
                    </button>

                    {tempFotoUrl.startsWith('http') && (
                      <a
                        href={tempFotoUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="w-full flex items-center justify-center gap-2 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 hover:text-slate-800 text-xs font-semibold rounded-2xl transition select-none"
                      >
                        <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                        Abrir Link Original no Navegador ↗
                      </a>
                    )}
                  </div>
                )}

                {/* URL Editing Zone */}
                <div className="space-y-1.5 pt-1.5 border-t border-slate-100">
                  <label className="block text-xs font-extrabold text-slate-700 flex items-center gap-1.5 select-none">
                    <Link className="w-3.5 h-3.5 text-atelier-605" />
                    Endereço da Imagem (Pinterest ou Web)
                  </label>
                  <p className="text-[10px] text-slate-400">Precisa terminar em .jpg, .png ou ser cópia da imagem direta.</p>
                  <div className="flex gap-2">
                    <input
                      type="url"
                      className="flex-1 px-3 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50 focus:outline-none focus:ring-2 focus:ring-atelier-500 font-mono text-slate-800"
                      placeholder="Cole o endereço da imagem do Pinterest (terminado em .jpg)"
                      value={tempFotoUrl}
                      onChange={(e) => {
                        setTempFotoUrl(e.target.value);
                        if (e.target.value.includes('pinterest.com/') || e.target.value.includes('pin.it/')) {
                          setExibirDicasPinterest(true);
                        }
                      }}
                    />
                    {tempFotoUrl && (
                      <button
                        type="button"
                        onClick={() => setTempFotoUrl('')}
                        className="px-2.5 py-1.5 text-xs font-semibold text-slate-550 border border-slate-200 hover:bg-slate-50 rounded-xl shrink-0 transition cursor-pointer"
                        title="Limpar Link"
                      >
                        Limpar
                      </button>
                    )}
                  </div>
                </div>

                {/* Dynamic Pinterest Warning Helper Box */}
                {(isPinterestPage || exibirDicasPinterest) && (
                  <div className="bg-amber-50/90 border border-amber-250 rounded-2xl p-3.5 space-y-2 text-[11px] text-amber-900 animate-in fade-in slide-in-from-top-1 duration-200">
                    <div className="flex items-center gap-1.5 font-bold text-amber-950">
                      <span className="text-sm">💡</span>
                      <span>Como copiar a foto direto do Pinterest:</span>
                    </div>
                    <p className="leading-relaxed text-amber-850">
                      Você colou um link de página do Pinterest. Páginas de Pin não são fotos de verdade e o navegador não pode mostrá-las no aplicativo. Para corrigir:
                    </p>
                    <div className="pt-1.5 border-t border-amber-200 space-y-2">
                      <ul className="list-disc list-inside space-y-1.5 pl-1 text-[10.5px] text-amber-900">
                        <li><strong className="text-slate-900 font-bold">No Computador:</strong> Clique com o <span className="font-semibold text-slate-950">botão direito</span> em cima do vestido ou foto do modelo e escolha <strong className="underline text-atelier-700">"Copiar endereço da imagem"</strong>. Em seguida, cole aqui!</li>
                        <li><strong className="text-slate-900 font-bold">No Telemóvel (Navegador):</strong> Toque de forma prolongada (carregue firme) em cima da imagem do modelo e selecione <strong className="underline text-atelier-700">"Copiar endereço da imagem"</strong>.</li>
                        <li><strong className="text-slate-900 font-bold">Na App Pinterest:</strong> Toque nos 3 pontinhos <span className="font-mono bg-white px-1 py-0.5 border border-slate-200 rounded">...</span> na imagem e escolha <strong>Baixar imagem</strong>. Depois poderá usar qualquer hospedagem pública ou enviar links diretos da web (e.g. terminado em <code>.jpg</code>, <code>.png</code>).</li>
                      </ul>
                    </div>
                  </div>
                )}

                {/* Secondary Interactive Guidance Help Button */}
                {!isPinterestPage && (
                  <button
                    type="button"
                    onClick={() => setExibirDicasPinterest(!exibirDicasPinterest)}
                    className="text-[11px] font-bold text-atelier-700 hover:text-atelier-800 flex items-center gap-1 cursor-pointer transition select-none"
                  >
                    <HelpCircle className="w-3.5 h-3.5" />
                    {exibirDicasPinterest ? 'Ocultar orientações do Pinterest' : 'Dica: Como copiar links de imagem diretamente do Pinterest?'}
                  </button>
                )}
              </div>

              {/* Modal Actions Footer */}
              <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2.5 select-none">
                <button
                  type="button"
                  onClick={() => {
                    setVisualizandoFoto(null);
                    setPedidoFotoEdit(null);
                    setExibirDicasPinterest(false);
                  }}
                  className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold cursor-pointer transition"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleUpdateFotoReferencia(tempFotoUrl);
                    setVisualizandoFoto(null);
                    setPedidoFotoEdit(null);
                    setExibirDicasPinterest(false);
                  }}
                  className="px-4 py-2 bg-atelier-600 hover:bg-atelier-700 text-white rounded-xl text-xs font-bold shadow-sm shadow-atelier-950/15 flex items-center gap-1.5 cursor-pointer transition"
                >
                  <Save className="w-3.5 h-3.5" />
                  Atualizar Modelo
                </button>
              </div>

            </div>
          </div>
        );
      })()}

      {/* Imagem em tamanho completo (FullScreen Lightbox Overlay) */}
      {visualizarImagemGrande && tempFotoUrl && (
        <div className="fixed inset-0 bg-slate-950/95 backdrop-blur-md z-[60] flex flex-col justify-between p-4 animate-in fade-in duration-200">
          
          {/* Header Controls */}
          <div className="w-full max-w-7xl mx-auto flex items-center justify-between py-2.5 border-b border-white/10 text-white select-none">
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-white/10 rounded-lg">
                <ImageIcon className="w-4 h-4 text-atelier-300 animate-pulse" />
              </span>
              <div>
                <h4 className="font-display font-black text-sm text-white">Visualização Completa do Modelo</h4>
                <p className="text-[10px] text-white/55 font-mono">Original - Sem Cortes</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Neutral background switcher */}
              <button
                type="button"
                onClick={() => setFundoEscuroLightbox(!fundoEscuroLightbox)}
                className="px-3 py-1.5 bg-white/10 hover:bg-white/15 text-white/90 rounded-xl text-[10.5px] font-bold transition flex items-center gap-1 cursor-pointer"
                title="Mudar tom do fundo"
              >
                Fundo: {fundoEscuroLightbox ? 'Escuro 🌙' : 'Claro ☀️'}
              </button>

              <button
                type="button"
                onClick={() => {
                  try {
                    navigator.clipboard.writeText(tempFotoUrl);
                    toast.success('Link da imagem copiado com sucesso!');
                  } catch (e) {}
                }}
                className="p-2 bg-white/10 hover:bg-white/15 text-white rounded-xl transition cursor-pointer"
                title="Copiar Link da Imagem"
              >
                <Link className="w-4 h-4" />
              </button>

              {tempFotoUrl.startsWith('http') && (
                <a
                  href={tempFotoUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="p-2 bg-white/10 hover:bg-white/15 text-white rounded-xl transition flex items-center justify-center cursor-pointer"
                  title="Abrir imagem externa original"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              )}

              <button
                type="button"
                onClick={() => setVisualizarImagemGrande(false)}
                className="px-4 py-1.5 bg-white hover:bg-slate-100 text-slate-900 font-extrabold text-xs rounded-xl transition cursor-pointer"
              >
                Fechar [✕]
              </button>
            </div>
          </div>

          {/* Centered Image Area */}
          <div className={`flex-1 w-full max-w-7xl mx-auto flex items-center justify-center p-2 rounded-3xl my-4 transition-colors duration-300 ${fundoEscuroLightbox ? 'bg-slate-900/40' : 'bg-white/95 border border-white/20 shadow-inner'}`}>
            <img
              src={tempFotoUrl}
              alt="Modelo Expandido"
              className="max-w-full max-h-[75vh] md:max-h-[80vh] object-contain rounded-xl select-none shadow-2xl animate-in zoom-in-95 duration-250"
              referrerPolicy="no-referrer"
              onError={(e) => {
                e.currentTarget.src = 'https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&q=80&w=400';
              }}
            />
          </div>

          {/* Tips Footer */}
          <div className="w-full text-center text-[10.5px] text-white/50 pb-2 font-mono select-none">
            Feche ou utilize os controles do cabeçalho para alternar o contraste.
          </div>
        </div>
      )}

      {/* Confirmation Dialog for Deleting Orders */}
      {pedidoParaExcluir && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="max-w-sm w-full bg-white rounded-3xl p-6 border border-atelier-200 shadow-2xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2.5 bg-rose-50 rounded-2xl text-rose-600 shrink-0">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-slate-900 font-display">Eliminar Encomenda?</h4>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Tem a certeza que deseja eliminar permanentemente a encomenda <strong className="text-slate-950 font-bold">"{pedidoParaExcluir.descricao}"</strong> do cliente <span className="font-semibold text-slate-700">{pedidoParaExcluir.clienteNome}</span>? Esta ação não pode ser desfeita.
                </p>
              </div>
            </div>

            <div className="flex gap-2.5 pt-1.5 justify-end">
              <button
                type="button"
                onClick={() => setPedidoParaExcluir(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-705 rounded-xl text-xs font-semibold cursor-pointer transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => handleDeletePedido(pedidoParaExcluir.id)}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-sm shadow-rose-950/10 cursor-pointer transition"
              >
                Confirmar Eliminação
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
