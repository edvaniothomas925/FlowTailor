import React, { useState, useEffect } from 'react';
import { localDb } from '../lib/neonStore';
import { Atelie, SolicitacaoPagamento, ConfiguracaoPagamento } from '../types';
import { 
  Shield, Sparkles, AlertCircle, CheckCircle2, XCircle, Users, Smartphone, 
  BookOpen, Key, Trash, CreditCard, Save, BarChart3, Plus, X, BarChart, 
  Calendar, Award, ArrowUpRight, TrendingUp, HelpCircle, RefreshCw, Cloud,
  Lock, Eye, EyeOff
} from 'lucide-react';
import { toast, confirmDialog } from '../lib/toast';

interface AdminViewProps {
  onRefreshAtelieSession: () => void;
}

export default function AdminView({ onRefreshAtelieSession }: AdminViewProps) {
  const [subTab, setSubTab] = useState<'comprovativos' | 'usuarios' | 'config-pag' | 'admins_list' | 'metricas'>('comprovativos');
  
  // Dynamic variables parsed from DB
  const [atelies, setAtelies] = useState<Atelie[]>([]);
  const [solicitacoes, setSolicitacoes] = useState<SolicitacaoPagamento[]>([]);
  const [configs, setConfigs] = useState<ConfiguracaoPagamento>(localDb.getConfigs());
  const [adminsList, setAdminsList] = useState<string[]>(localDb.getAdmins());

  // Search/Filters trackers
  const [comprovFilter, setComprovFilter] = useState<'pendente' | 'aprovado' | 'rejeitado'>('pendente');
  const [userBusca, setUserBusca] = useState('');
  const [userStatusFilter, setUserStatusFilter] = useState<string>('todos');
  const [userPlanFilter, setUserPlanFilter] = useState<string>('todos');

  // Modals / Inputs selectors
  const [rejeitandoId, setRejeitandoId] = useState<string | null>(null);
  const [notaRejeicao, setNotaRejeicao] = useState('');
  const [verComprovImagem, setVerComprovImagem] = useState<string | null>(null);
  const [detalheAtelie, setDetalheAtelie] = useState<Atelie | null>(null);

  // Expiration days count
  const [extensaoDias, setExtensaoDias] = useState('30');
  const [tipoAjusteVencimento, setTipoAjusteVencimento] = useState<'dias' | 'data'>('dias');
  const [dataPersonalizada, setDataPersonalizada] = useState('');
  
  // Add Admin form
  const [novoAdminEmail, setNovoAdminEmail] = useState('');
  const [novoAdminSenha, setNovoAdminSenha] = useState('');
  const [showNovoAdminSenha, setShowNovoAdminSenha] = useState(false);
  const [adminCreds, setAdminCreds] = useState<Record<string, { passwordHash: string; passwordSetAt?: string }>>({});

  // Sync state
  const [isSyncingAdmin, setIsSyncingAdmin] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);
  const [syncStageMsg, setSyncStageMsg] = useState('');

  // Floating Toast State
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(prev => prev?.message === message ? null : prev);
    }, 4500);
  };

  // Manual Atelie Creation Form State
  const [mostrarCriarForm, setMostrarCriarForm] = useState(false);
  const [novoAtelieNome, setNovoAtelieNome] = useState('');
  const [novoAtelieEmail, setNovoAtelieEmail] = useState('');
  const [novoAtelieTelefone, setNovoAtelieTelefone] = useState('');
  const [novoAteliePlano, setNovoAteliePlano] = useState<'basico' | 'pro'>('basico');
  const [novoAtelieValidade, setNovoAtelieValidade] = useState('30');
  const [novoAtelieAtivo, setNovoAtelieAtivo] = useState(true);

  // Simulation parameters for projection tab
  const [simAteliersTarget, setSimAteliersTarget] = useState(50);
  const [simPercentPro, setSimPercentPro] = useState(50); // 50% pro, 50% basic

  useEffect(() => {
    loadAdminData();
    const unsub = localDb.onDataChange(() => {
      loadAdminData();
    });
    return () => unsub();
  }, []);

  const loadAdminData = () => {
    setAtelies(localDb.getAtelies());
    setSolicitacoes(localDb.getSolicitacoes().sort((a,b) => b.solicitadoEm.localeCompare(a.solicitadoEm)));
    setConfigs(localDb.getConfigs());
    setAdminsList(localDb.getAdmins());
    setAdminCreds(localDb.getAdminCredentials());
  };

  // KPI Calculations
  const totalRegisteredAtelies = atelies.length;
  const activeAtelies = atelies.filter(a => a.ativo).length;
  const pendingComprovatives = solicitacoes.filter(s => s.status === 'pendente').length;
  
  // MRR estimation: Basic plano = 5000 Kz/mês, Pro plano = 9000 Kz/mês (Sugestão de referência)
  const estimatedMRR = atelies.filter(a => a.ativo).reduce((acc, a) => {
    const value = a.plano === 'pro' ? 9000 : 5000;
    return acc + value;
  }, 0);

  // Approve payment claim handler
  const handleAprovarSolicitacao = (solId: string) => {
    const listSol = localDb.getSolicitacoes();
    const sol = listSol.find(s => s.id === solId);
    if (sol) {
      sol.status = 'aprovado';
      sol.resolvidoEm = new Date().toISOString();
      localDb.saveSolicitacao(sol);

      // Seta ativo no ateliê e renova por +30 dias
      const ate = localDb.getAtelie(sol.atelieId);
      if (ate) {
        ate.ativo = true;
        
        // Se já estivesse ativo, prorroga a partir da expiração atual, caso contrário a partir de agora
        const expAtual = new Date(ate.dataVencimento).getTime();
        const baseTime = expAtual > Date.now() ? expAtual : Date.now();
        ate.dataVencimento = new Date(baseTime + 30 * 24 * 60 * 60 * 1000).toISOString();
        
        localDb.saveAtelie(ate);
      }

      loadAdminData();
      onRefreshAtelieSession();
      showToast('Solicitação APROVADA com sucesso! Licença estendida por +30 dias.', 'success');
    }
  };

  // Reject payment claim handler
  const handleRejeitarSolicitacaoSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejeitandoId) return;

    const listSol = localDb.getSolicitacoes();
    const sol = listSol.find(s => s.id === rejeitandoId);
    if (sol) {
      sol.status = 'rejeitado';
      sol.observacoesAdmin = notaRejeicao;
      sol.resolvidoEm = new Date().toISOString();
      localDb.saveSolicitacao(sol);

      loadAdminData();
      setRejeitandoId(null);
      setNotaRejeicao('');
      showToast('Solicitação rejeitada! A costureira receberá a notificação explicativa.', 'info');
    }
  };

  // Toggle user/atelie manual activation
  const handleToggleAtelieStatus = (id: string) => {
    const ate = localDb.getAtelie(id);
    if (ate) {
      ate.ativo = !ate.ativo;
      localDb.saveAtelie(ate);
      loadAdminData();
      onRefreshAtelieSession();
      showToast(`Ateliê "${ate.nome}" agora está ${ate.ativo ? 'ATIVO' : 'BLOQUEADO'}.`, 'info');
    }
  };

  // Change user/atelie plan manually
  const handleTogglePlano = (id: string) => {
    const ate = localDb.getAtelie(id);
    if (ate) {
      ate.plano = ate.plano === 'pro' ? 'basico' : 'pro';
      localDb.saveAtelie(ate);
      loadAdminData();
      onRefreshAtelieSession();
      showToast(`Plano de "${ate.nome}" alterado para ${ate.plano.toUpperCase()}.`, 'success');
    }
  };

  const handleCobrarWhatsApp = (user: Atelie) => {
    const expired = new Date(user.dataVencimento).getTime() < Date.now();
    const cleanPhone = user.telefone.replace(/\D/g, '');
    const text = encodeURIComponent(
      `Olá, ${user.nome}! 😊\n` +
      `Escrevemos do suporte administrativo do *FlowTailor - Ateliê Pro Angola*.\n\n` +
      `Identificamos que a sua subscrição do plano *${user.plano.toUpperCase()}* ${expired ? 'expirou' : 'vencerá'} em: ${new Date(user.dataVencimento).toLocaleDateString('pt-AO')}.\n\n` +
      `Para manter o sincronismo automático híbrido da sua costura e os seus dados sempre salvos na nuvem, envie-nos o comprovativo de renovação.\n\n` +
      `Estamos à sua inteira disposição! Abraço da equipa FlowTailor. 🇦🇴`
    );
    window.open(`https://wa.me/${cleanPhone}?text=${text}`, '_blank');
  };

  // Add complementary package days directly
  const handleAdicionarDias = (id: string, dias: number) => {
    const ate = localDb.getAtelie(id);
    if (ate) {
      const expTime = new Date(ate.dataVencimento).getTime();
      const baseTime = expTime > Date.now() ? expTime : Date.now();
      ate.dataVencimento = new Date(baseTime + dias * 24 * 60 * 60 * 1000).toISOString();
      localDb.saveAtelie(ate);
      loadAdminData();
      onRefreshAtelieSession();
      showToast(`Sucesso! Validade prorrogada em +${dias} dias.`, 'success');
    }
  };

  // Set specific/personalized expiration date directly
  const handleDefinirDataVencimento = (id: string, dataIsoString: string) => {
    const ate = localDb.getAtelie(id);
    if (ate) {
      // If the input date value is selected in local timezone, ensure it represents the correct date.
      // E.g. simple date string YYYY-MM-DD can be parsed as UTC or local. Adding a noon/afternoon hour prevents issues or we can save directly.
      const parsedDate = new Date(dataIsoString + 'T23:59:59');
      ate.dataVencimento = parsedDate.toISOString();
      localDb.saveAtelie(ate);
      loadAdminData();
      onRefreshAtelieSession();
      showToast(`Sucesso! Nova data de vencimento definida: ${parsedDate.toLocaleDateString('pt-AO')}.`, 'success');
    }
  };

  const handleDeleteAtelie = (id: string) => {
    confirmDialog(
      'ATENÇÃO: Deseja realmente ELIMINAR permanentemente esta conta de ateliê e todas as suas encomendas associadas?',
      () => {
        const remaining = atelies.filter(a => a.id !== id);
        localStorage.setItem('ateliepro_atelies', JSON.stringify(remaining));
        loadAdminData();
        showToast('Conta eliminada permanentemente.', 'error');
      }
    );
  };

  const handleSalvarConfigsPagamento = (e: React.FormEvent) => {
    e.preventDefault();
    localDb.saveConfigs(configs);
    showToast('Configurações de pagamento globais guardadas em segurança!', 'success');
    loadAdminData();
  };

  const handleAdicionarAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!novoAdminEmail) return;
    const emailClean = novoAdminEmail.toLowerCase().trim();

    try {
      await localDb.addAdmin(emailClean, novoAdminSenha ? novoAdminSenha.trim() : undefined);
      setNovoAdminEmail('');
      setNovoAdminSenha('');
      loadAdminData();
      showToast(
        novoAdminSenha
          ? 'Novo administrador adicionado com palavra-passe inicial configurada!'
          : 'Novo administrador adicionado! Ele definirá a palavra-passe no seu 1º acesso.',
        'success'
      );
    } catch (err: any) {
      showToast(err.message || 'Erro ao adicionar administrador.', 'error');
    }
  };

  const handleRemoverAdmin = (email: string) => {
    confirmDialog(
      `Tem a certeza que deseja remover as permissões admin de ${email}?`,
      () => {
        localDb.removeAdmin(email);
        loadAdminData();
        showToast('Acesso de administrador removido.', 'info');
      }
    );
  };

  // Manual Creation Logic
  const handleCriarAtelieManual = (e: React.FormEvent) => {
    e.preventDefault();
    if (!novoAtelieNome || !novoAtelieEmail || !novoAtelieTelefone) {
      showToast('Preencha os campos obrigatórios!', 'error');
      return;
    }

    const emailLower = novoAtelieEmail.toLowerCase();
    const existe = atelies.some(a => a.emailOwner.toLowerCase() === emailLower);
    if (existe) {
      showToast('Já existe um Ateliê registrado com este endereço de e-mail.', 'error');
      return;
    }

    const uid = 'atelie_man_' + (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID().replace(/-/g, '').slice(0, 12) : Date.now().toString(36));
    const validadeDiasNum = Number(novoAtelieValidade);
    const expiracao = new Date(Date.now() + validadeDiasNum * 24 * 60 * 60 * 1000).toISOString();

    const novoAtelie: Atelie = {
      id: uid,
      nome: novoAtelieNome,
      emailOwner: emailLower,
      telefone: novoAtelieTelefone,
      plano: novoAteliePlano,
      ativo: novoAtelieAtivo,
      dataVencimento: expiracao,
      criadoEm: new Date().toISOString()
    };

    localDb.saveAtelie(novoAtelie);
    showToast(`Ateliê "${novoAtelieNome}" criado com sucesso!`, 'success');
    loadAdminData();
    
    // Clear state fields
    setNovoAtelieNome('');
    setNovoAtelieEmail('');
    setNovoAtelieTelefone('');
    setNovoAteliePlano('basico');
    setNovoAtelieValidade('30');
    setNovoAtelieAtivo(true);
    setMostrarCriarForm(false);
  };

  // Manual Cloud Sync for Admin
  const handleForcarSincronizacaoAdmin = async () => {
    if (isSyncingAdmin) return;
    setIsSyncingAdmin(true);
    setSyncProgress(15);
    setSyncStageMsg('A preparar dados administrativos para sincronização com o Neon PostgreSQL...');

    try {
      const result = await localDb.forceSyncAdminToCloud((progress, msg) => {
        setSyncProgress(progress);
        setSyncStageMsg(msg);
      });

      if (result.success) {
        showToast(`Sucesso! ${result.syncedItemsCount} registos administrativos sincronizados com o Neon PostgreSQL.`, 'success');
        alert(`✅ [Sincronização Administrativa Neon Concluída]\n\nOs registos relacionais foram persistidos com sucesso no Neon PostgreSQL:\n• Ateliês da Plataforma: ${atelies.length} registos na tabela 'atelies'\n• Solicitações / Comprovativos: ${solicitacoes.length} registos na tabela 'solicitacoes_pagamento'\n• Parâmetros Bancários: gravados na tabela 'configuracoes'\n• Administradores: ${adminsList.length} autorizados na tabela 'admins'`);
      } else {
        showToast(`Erro na sincronização: ${result.error}`, 'error');
        alert(`❌ [Falha ao Gravar no Neon PostgreSQL]\n\nOcorreu um erro ao persistir dados administrativos:\n${result.error}`);
      }
    } catch (err: any) {
      console.error(err);
      showToast('Falha na sincronização administrativa com Neon.', 'error');
      alert(`❌ Erro: ${err?.message || err}`);
    } finally {
      setIsSyncingAdmin(false);
      setSyncProgress(0);
      setSyncStageMsg('');
      loadAdminData();
    }
  };

  // Sorting columns filters for clients table list
  const filteredAtelies = atelies.filter(ate => {
    const matchesBusca = ate.nome.toLowerCase().includes(userBusca.toLowerCase()) || ate.emailOwner.toLowerCase().includes(userBusca.toLowerCase());
    const matchesStatus = userStatusFilter === 'todos' || 
                          (userStatusFilter === 'ativos' && ate.ativo) || 
                          (userStatusFilter === 'inativos' && !ate.ativo);
    const matchesPlan = userPlanFilter === 'todos' || ate.plano === userPlanFilter;
    return matchesBusca && matchesStatus && matchesPlan;
  });

  return (
    <div className="space-y-6">
      
      {/* Header operations area */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4">
        <div>
          <h2 className="text-2xl font-bold font-display tracking-tight text-gray-950 flex items-center gap-2">
            <Shield className="w-6 h-6 text-atelier-700 animate-bounce" /> Painel de Gestão Admin
          </h2>
          <p className="text-xs text-cool-slate-400">Administração global, faturamento manual, verificador de comprovativos e controlo de licenças.</p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleForcarSincronizacaoAdmin}
            disabled={isSyncingAdmin}
            className="px-3.5 py-2 bg-atelier-900 hover:bg-atelier-850 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-xs cursor-pointer disabled:opacity-50"
            title="Sincronizar todos os ateliês, comprovativos e configurações com o Neon PostgreSQL"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncingAdmin ? 'animate-spin text-atelier-400' : 'text-atelier-400'}`} />
            {isSyncingAdmin ? `A sincronizar (${syncProgress}%)...` : 'Sincronizar Nuvem (Neon DB)'}
          </button>
          <span className="px-3 py-2 bg-emerald-950 text-emerald-300 font-mono text-xs rounded-xl flex items-center gap-1.5 border border-emerald-800">
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" /> Admin Ativo
          </span>
        </div>
      </div>

      {/* KPI Stats overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        
        {/* Total Users Registries */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-atelier-50 text-atelier-700 rounded-2xl">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs text-slate-500 block font-medium">Ateliês Registados</span>
            <strong className="text-2xl font-display text-slate-950 block leading-none mt-1">{totalRegisteredAtelies}</strong>
          </div>
        </div>

        {/* Total active tenants pay-walled */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-emerald-50 text-emerald-700 rounded-2xl">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs text-slate-500 block font-medium">Ateliês Activos</span>
            <strong className="text-2xl font-display text-emerald-800 block leading-none mt-1">{activeAtelies}</strong>
          </div>
        </div>

        {/* Recorrente estimate */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-sky-50 text-sky-700 rounded-2xl">
            <CreditCard className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs text-slate-500 block font-medium">MRR Activo Estimado</span>
            <strong className="text-2xl font-display text-sky-800 block leading-none mt-1">{estimatedMRR.toLocaleString('pt-AO')} Kz</strong>
          </div>
        </div>

        {/* Queue count pending verification */}
        <div className={`p-5 rounded-3xl border shadow-sm flex items-center gap-4 ${
          pendingComprovatives > 0 ? 'bg-amber-50 border-amber-200' : 'bg-white border-slate-200'
        }`}>
          <div className={`p-3 rounded-2xl ${pendingComprovatives > 0 ? 'bg-amber-100 text-amber-700' : 'bg-slate-50 text-slate-600'}`}>
            <AlertCircle className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <span className="text-xs text-slate-500 block font-medium">Comprovativos Pendentes</span>
            <strong className={`text-2xl font-display block leading-none mt-1 ${pendingComprovatives > 0 ? 'text-amber-700 font-bold' : 'text-slate-950'}`}>
              {pendingComprovatives}
            </strong>
          </div>
        </div>

      </div>

      {/* Tab select bar systems */}
      <div className="border-b border-gray-150 flex flex-wrap gap-2 sm:gap-4 select-none">
        <button
          onClick={() => setSubTab('comprovativos')}
          className={`py-3 px-1.5 text-xs font-bold border-b-2 transition-all cursor-pointer ${
            subTab === 'comprovativos' ? 'border-atelier-700 text-atelier-700' : 'border-transparent text-slate-500 hover:text-slate-950'
          }`}
        >
          📄 Validação ({pendingComprovatives})
        </button>
        <button
          onClick={() => setSubTab('usuarios')}
          className={`py-3 px-1.5 text-xs font-bold border-b-2 transition-all cursor-pointer ${
            subTab === 'usuarios' ? 'border-atelier-700 text-atelier-700' : 'border-transparent text-slate-500 hover:text-slate-950'
          }`}
        >
          👥 Gestão de Costureiras
        </button>
        <button
          onClick={() => setSubTab('metricas')}
          className={`py-3 px-1.5 text-xs font-bold border-b-2 transition-all cursor-pointer ${
            subTab === 'metricas' ? 'border-atelier-700 text-atelier-700' : 'border-transparent text-slate-500 hover:text-slate-950'
          }`}
        >
          📊 Análise & Métricas
        </button>
        <button
          onClick={() => setSubTab('config-pag')}
          className={`py-3 px-1.5 text-xs font-bold border-b-2 transition-all cursor-pointer ${
            subTab === 'config-pag' ? 'border-atelier-700 text-atelier-700' : 'border-transparent text-slate-500 hover:text-slate-955'
          }`}
        >
          ⚙️ Parametrizar Pagamentos
        </button>
        <button
          onClick={() => setSubTab('admins_list')}
          className={`py-3 px-1.5 text-xs font-bold border-b-2 transition-all cursor-pointer ${
            subTab === 'admins_list' ? 'border-atelier-700 text-atelier-700' : 'border-transparent text-slate-500 hover:text-slate-955'
          }`}
        >
          🔑 Administradores
        </button>
      </div>

      {/* CORE ADMIN SECTIONS */}
      <div className="p-3">
        
        {/* SUBTAB 1: PROOFS QUEUE COMPLETER */}
        {subTab === 'comprovativos' && (
          <div className="space-y-4">
            
            {/* Filter selectors inside the proofs queue */}
            <div className="flex gap-2">
              {(['pendente', 'aprovado', 'rejeitado'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setComprovFilter(f)}
                  className={`py-1.5 px-3 rounded-xl text-xs font-semibold uppercase ${
                    comprovFilter === f
                      ? 'bg-slate-900 text-white'
                      : 'bg-atelier-50 text-slate-600 hover:bg-atelier-100'
                  }`}
                >
                  {f === 'pendente' ? 'Pendentes d\'Aprovação' : f === 'aprovado' ? 'Aprovados' : 'Rejeitados'}
                </button>
              ))}
            </div>

            {/* List entries */}
            {solicitacoes.filter(s => s.status === comprovFilter).length === 0 ? (
              <div className="p-8 border rounded-2xl text-center text-xs text-slate-400 bg-white">
                Nenhum comprovativo registrado nesta pasta.
              </div>
            ) : (
              <div className="space-y-3.5">
                {solicitacoes.filter(s => s.status === comprovFilter).map((sol) => (
                  <div key={sol.id} className="p-5 bg-white rounded-3xl border border-slate-150 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-slate-900">{sol.atelieNome}</span>
                        <span className="text-[10px] px-2 py-0.5 bg-slate-900 text-white font-bold uppercase rounded-md">{sol.plano}</span>
                        <span className={`text-[10px] px-2 py-0.5 font-bold uppercase rounded-md ${
                          sol.metodoPagamento === 'multicaixa' 
                            ? 'bg-indigo-50 text-indigo-700 border border-indigo-150' 
                            : 'bg-indigo-100 text-slate-900 border border-indigo-200'
                        }`}>
                          {sol.metodoPagamento === 'multicaixa' ? '💳 Multicaixa Express' : '🏦 Transferência'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500">
                        E-mail de Cadastro: <strong className="text-slate-800">{sol.emailOwner}</strong> · Contacto: +{sol.telefoneOwner}
                      </p>
                      <p className="text-[11px] font-mono text-slate-400">
                        Solicitado em: {new Date(sol.solicitadoEm).toLocaleString('pt-AO')}
                      </p>
                      {sol.observacoesAdmin && (
                        <p className="text-xs text-red-700 block bg-red-50 p-2 rounded-xl border border-red-100 mt-1">
                          ✖️ Motivo da Rejeição: "{sol.observacoesAdmin}"
                        </p>
                      )}
                    </div>

                    {/* Controls alignment */}
                    <div className="flex items-center gap-2">
                      {sol.status === 'pendente' && (
                        <>
                          <button
                            onClick={() => handleAprovarSolicitacao(sol.id)}
                            className="py-2 px-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl cursor-pointer shadow-md transition-all active:scale-95 duration-100"
                          >
                            ✓ Aprovar Ativação
                          </button>
                          <button
                            onClick={() => setRejeitandoId(sol.id)}
                            className="py-2 px-3.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl cursor-pointer shadow-md transition-all active:scale-95 duration-100"
                          >
                            ✖ Rejeitar
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* SUBTAB 2: USER TENANT TABLE CONTROL */}
        {subTab === 'usuarios' && (
          <div className="space-y-4">
            
            {/* Quick action operations header with registration toggle */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-55 p-5 rounded-2xl border border-slate-200/80 mb-1">
              <div>
                <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-wide">Operações de Ativação Rápidas</h4>
                <p className="text-[11px] text-slate-500 mt-0.5">Registe ateliês manualmente (recebimento em mãos/dinheiro físico) ou adicione novas licenças.</p>
              </div>
              <button
                onClick={() => setMostrarCriarForm(!mostrarCriarForm)}
                className="py-2 px-4 bg-atelier-700 hover:bg-atelier-850 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer self-start transition-all shadow-sm active:scale-95 duration-100"
              >
                {mostrarCriarForm ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                {mostrarCriarForm ? 'Fechar Formulário' : 'Novo Ateliê Manual'}
              </button>
            </div>

            {/* Collapsible offline user creator */}
            {mostrarCriarForm && (
              <form onSubmit={handleCriarAtelieManual} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4 animate-in fade-in slide-in-from-top-3 duration-200">
                <div className="flex items-center justify-between border-b pb-2">
                  <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5 font-display">
                    <Plus className="w-4 h-4 text-atelier-700 animate-pulse" /> Registar Conta por Fora do Portal
                  </h4>
                  <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 font-mono uppercase font-bold rounded">Subscrição Directa</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Nome do Ateliê *</label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: Ateliê Glamour de Luanda"
                      className="w-full p-2.5 text-xs border rounded-xl bg-slate-50 focus:outline-none focus:ring-1 focus:ring-atelier-500 text-slate-900 font-semibold"
                      value={novoAtelieNome}
                      onChange={(e) => setNovoAtelieNome(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">E-mail do Proprietário *</label>
                    <input
                      type="email"
                      required
                      placeholder="Ex: proprietario@atelie.ao"
                      className="w-full p-2.5 text-xs border rounded-xl bg-slate-50 focus:outline-none focus:ring-1 focus:ring-atelier-500 text-slate-900 font-mono"
                      value={novoAtelieEmail}
                      onChange={(e) => setNovoAtelieEmail(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Telefone / Contacto *</label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: 244923111222"
                      className="w-full p-2.5 text-xs border rounded-xl bg-slate-50 focus:outline-none focus:ring-1 focus:ring-atelier-500 text-slate-900 font-mono"
                      value={novoAtelieTelefone}
                      onChange={(e) => setNovoAtelieTelefone(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Plano Inicial</label>
                    <select
                      className="w-full p-2.5 text-xs border rounded-xl bg-slate-50 text-slate-900 focus:outline-none font-medium"
                      value={novoAteliePlano}
                      onChange={(e) => setNovoAteliePlano(e.target.value as 'basico' | 'pro')}
                    >
                      <option value="basico">Plano Básico (5.000 Kz/mês)</option>
                      <option value="pro">Plano Pro Premium (9.000 Kz/mês)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Validade Inicial</label>
                    <select
                      className="w-full p-2.5 text-xs border rounded-xl bg-slate-50 text-slate-905 focus:outline-none font-medium"
                      value={novoAtelieValidade}
                      onChange={(e) => setNovoAtelieValidade(e.target.value)}
                    >
                      <option value="7">7 Dias (Cortesia Experimental)</option>
                      <option value="30">30 Dias (Padrão Mensal)</option>
                      <option value="90">90 Dias (Trimestral)</option>
                      <option value="365">365 Dias (Anual Pro)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Estado do Acesso</label>
                    <select
                      className="w-full p-2.5 text-xs border rounded-xl bg-slate-50 text-slate-905 focus:outline-none font-medium"
                      value={novoAtelieAtivo ? 'true' : 'false'}
                      onChange={(e) => setNovoAtelieAtivo(e.target.value === 'true')}
                    >
                      <option value="true">Activar Imediatamente</option>
                      <option value="false">Iniciar Bloqueado (Aguardar pagamento)</option>
                    </select>
                  </div>
                </div>

                <div className="flex gap-2 justify-end pt-3 border-t">
                  <button
                    type="button"
                    onClick={() => {
                      setMostrarCriarForm(false);
                      setNovoAtelieNome('');
                      setNovoAtelieEmail('');
                      setNovoAtelieTelefone('');
                    }}
                    className="py-2 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl cursor-pointer"
                  >
                    Mudar de Ideia
                  </button>
                  <button
                    type="submit"
                    className="py-2 px-5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md cursor-pointer transition-all"
                  >
                    Confirmar Registo Manual
                  </button>
                </div>
              </form>
            )}

            {/* Filter tools */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <input
                type="text"
                placeholder="Pesquisar por nome de ateliê ou e-mail..."
                className="p-2 border rounded-xl text-xs bg-white text-slate-800 flex-1 max-w-sm"
                value={userBusca}
                onChange={(e) => setUserBusca(e.target.value)}
              />

              <select
                className="p-2 border rounded-xl text-xs bg-white text-slate-800"
                value={userStatusFilter}
                onChange={(e) => setUserStatusFilter(e.target.value)}
              >
                <option value="todos">Todos os Estados</option>
                <option value="ativos">Apenas Ativos</option>
                <option value="inativos">Apenas Suspensos/Declarados</option>
              </select>

              <select
                className="p-2 border rounded-xl text-xs bg-white text-slate-800"
                value={userPlanFilter}
                onChange={(e) => setUserPlanFilter(e.target.value)}
              >
                <option value="todos">Todos os Planos</option>
                <option value="basico">Plano Básico</option>
                <option value="pro">Plano Pro</option>
              </select>
            </div>

            {/* Tabular render list */}
            <div className="border rounded-2xl overflow-hidden bg-white">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs min-w-[800px] border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b font-bold text-slate-700">
                    <th className="p-3">Ateliê de Costura</th>
                    <th className="p-3">Plano</th>
                    <th className="p-3">Sincronia</th>
                    <th className="p-3">Estado</th>
                    <th className="p-3">Vencimento</th>
                    <th className="p-3">Cadastro</th>
                    <th className="p-3 text-right">Acções de Controlo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredAtelies.map(user => {
                    const expired = new Date(user.dataVencimento).getTime() < Date.now();
                    return (
                      <tr key={user.id} className="hover:bg-slate-50/50">
                        <td className="p-3 font-semibold text-slate-900">
                          {user.nome}
                          <span className="text-[10px] text-slate-400 block font-normal">{user.emailOwner}</span>
                        </td>
                        <td className="p-3 capitalize">{user.plano}</td>
                        <td className="p-3">
                          <span className="inline-flex items-center gap-1.5 text-[9.5px] text-emerald-800 bg-emerald-50 border border-emerald-200/50 px-2 py-0.5 rounded-full font-bold">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                            Híbrido Sincronizado
                          </span>
                        </td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded-full font-bold text-[9px] ${
                            user.ativo 
                              ? 'bg-emerald-100 text-emerald-800' 
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {user.ativo ? 'CONTA ATIVA' : 'BLOQUEADO'}
                          </span>
                        </td>
                        <td className="p-3">
                          <span className={expired ? 'text-red-600 font-semibold' : 'text-slate-600'}>
                            {new Date(user.dataVencimento).toLocaleDateString('pt-AO')}
                          </span>
                        </td>
                        <td className="p-3 text-slate-400">{new Date(user.criadoEm).toLocaleDateString('pt-AO')}</td>
                        <td className="p-3 text-right space-x-1.5 space-y-1.5">
                          <button
                            onClick={() => {
                              setDetalheAtelie(user);
                              setTipoAjusteVencimento('dias');
                              const dateObj = new Date(user.dataVencimento);
                              const year = dateObj.getFullYear();
                              const month = String(dateObj.getMonth() + 1).padStart(2, '0');
                              const day = String(dateObj.getDate()).padStart(2, '0');
                              setDataPersonalizada(`${year}-${month}-${day}`);
                            }}
                            className="px-2 py-1 bg-slate-50 border hover:bg-slate-100 text-slate-700 rounded text-[10px] font-semibold cursor-pointer"
                          >
                            Ajustar Vencimento
                          </button>
                          <button
                            onClick={() => handleToggleAtelieStatus(user.id)}
                            className={`px-2 py-1 rounded text-[10px] font-semibold cursor-pointer ${
                              user.ativo ? 'bg-amber-50 text-amber-700 border hover:bg-amber-100' : 'bg-emerald-50 text-emerald-700 border hover:bg-emerald-100'
                            }`}
                          >
                            {user.ativo ? 'Suspender' : 'Activar'}
                          </button>
                          <button
                            onClick={() => handleTogglePlano(user.id)}
                            className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded text-[10px] font-semibold cursor-pointer"
                          >
                            Trocar Plano
                          </button>
                          <button
                            onClick={() => handleCobrarWhatsApp(user)}
                            className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded text-[10px] font-bold cursor-pointer"
                            title="Enviar Lembrete de Cobrança via WhatsApp"
                          >
                            Cobrar WhatsApp 💬
                          </button>
                          <button
                            onClick={() => handleDeleteAtelie(user.id)}
                            className="px-2 py-1 hover:bg-red-50 text-red-600 rounded text-[10px] cursor-pointer"
                            title="Eliminar Conta"
                          >
                            Excluir
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            </div>

          </div>
        )}

        {/* SUBTAB 3: EDIT PAYMENT RECEUVER TARGET CONFIGS */}
        {subTab === 'config-pag' && (
          <form onSubmit={handleSalvarConfigsPagamento} className="max-w-xl bg-white p-6 border rounded-3xl shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-900 border-b pb-1.5 flex items-center gap-1.5">
              <CreditCard className="w-4 h-4 text-atelier-700" /> Parametrizar Dados de Recebimento de Mensalidades
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Nº Multicaixa Express</label>
                <input
                  type="text"
                  required
                  className="w-full p-2 text-xs border rounded-xl bg-slate-50 font-mono focus:outline-none"
                  value={configs.numeroExpress}
                  onChange={(e) => setConfigs({ ...configs, numeroExpress: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Contacto WhatsApp Recepção Comprovantes *</label>
                <input
                  type="text"
                  required
                  className="w-full p-2 text-xs border rounded-xl bg-slate-50 font-mono focus:outline-none focus:ring-1 focus:ring-atelier-500"
                  value={configs.whatsappAdmin}
                  onChange={(e) => setConfigs({ ...configs, whatsappAdmin: e.target.value.replace(/\D/g, '') })}
                />
                <span className="text-[9px] text-slate-400 mt-1 block">Mandatório. Ex formato Angola: 244923000000.</span>
              </div>

              <div className="col-span-1 sm:col-span-2">
                <label className="block text-xs font-bold text-slate-600 mb-1">NIB / IBAN Bancário</label>
                <input
                  type="text"
                  required
                  className="w-full p-2 text-xs border rounded-xl bg-slate-50 font-mono focus:outline-none"
                  value={configs.iban}
                  onChange={(e) => setConfigs({ ...configs, iban: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Nome do Banco</label>
                <input
                  type="text"
                  required
                  className="w-full p-2 text-xs border rounded-xl bg-slate-50 focus:outline-none"
                  value={configs.banco}
                  onChange={(e) => setConfigs({ ...configs, banco: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Titular da Conta</label>
                <input
                  type="text"
                  required
                  className="w-full p-2 text-xs border rounded-xl bg-slate-50 focus:outline-none"
                  value={configs.titular}
                  onChange={(e) => setConfigs({ ...configs, titular: e.target.value })}
                />
              </div>
            </div>

            <div className="pt-2 border-t text-right">
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-atelier-700 hover:bg-atelier-850 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
              >
                <Save className="w-3.5 h-3.5" /> Guardar Dados Financeiros
              </button>
            </div>
          </form>
        )}

        {/* SUBTAB 4: MANAGE ADMIN LIST */}
        {subTab === 'admins_list' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            
            {/* Administrators Listing */}
            <div className="bg-white p-5 border rounded-3xl shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b pb-2">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  <Shield className="w-4 h-4 text-amber-600" /> Administradores Registados ({adminsList.length})
                </h3>
                <span className="text-[11px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">
                  Segurança Ativa
                </span>
              </div>
              
              <div className="divide-y divide-slate-100 space-y-3.5">
                {adminsList.map(adminEmail => {
                  const hasPass = Boolean(adminCreds[adminEmail.toLowerCase()]?.passwordHash);
                  const passSetAt = adminCreds[adminEmail.toLowerCase()]?.passwordSetAt;

                  return (
                    <div key={adminEmail} className="pt-3.5 first:pt-0 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-900 font-mono">{adminEmail}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {hasPass ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                              <CheckCircle2 className="w-3 h-3" /> Palavra-passe configurada
                              {passSetAt && (
                                <span className="text-[9px] text-emerald-600 font-normal">
                                  ({new Date(passSetAt).toLocaleDateString('pt-AO')})
                                </span>
                              )}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">
                              <Key className="w-3 h-3" /> 1º Acesso Pendente (Definirá ao entrar)
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => handleRemoverAdmin(adminEmail)}
                          className="text-red-600 hover:text-red-800 hover:bg-red-50 px-2.5 py-1 rounded-lg font-semibold transition-all"
                        >
                          Remover Acesso
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Promote Admin Form */}
            <form onSubmit={handleAdicionarAdmin} className="bg-white p-5 border rounded-3xl shadow-sm space-y-4 h-fit">
              <div className="border-b pb-2">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  <Plus className="w-4 h-4 text-slate-700" /> Promover Novo Administrador
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Adicione e-mails autorizados a gerir os ateliês e comprovativos na plataforma.
                </p>
              </div>
              
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">E-mail do Administrador *</label>
                <input
                  type="email"
                  required
                  placeholder="Ex: novo.admin@flowtailor.ao"
                  className="w-full p-2.5 border rounded-xl text-xs bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 font-mono"
                  value={novoAdminEmail}
                  onChange={(e) => setNovoAdminEmail(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700 flex items-center justify-between">
                  <span className="flex items-center gap-1"><Lock className="w-3.5 h-3.5 text-slate-500" /> Palavra-passe Inicial (Opcional)</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-400 font-normal">Min. 6 caracteres</span>
                    {novoAdminSenha.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setShowNovoAdminSenha(!showNovoAdminSenha)}
                        className="text-[11px] text-slate-500 hover:text-slate-800 flex items-center gap-1 font-medium cursor-pointer"
                      >
                        {showNovoAdminSenha ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                        {showNovoAdminSenha ? 'Ocultar' : 'Mostrar'}
                      </button>
                    )}
                  </div>
                </label>
                <input
                  type={showNovoAdminSenha ? 'text' : 'password'}
                  minLength={6}
                  placeholder="Deixar em branco para definir no 1º acesso"
                  className="w-full p-2.5 border rounded-xl text-xs bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                  value={novoAdminSenha}
                  onChange={(e) => setNovoAdminSenha(e.target.value)}
                />
                <p className="text-[10px] text-slate-500 leading-normal pt-1">
                  💡 <strong>Regra do 1º Acesso:</strong> Se não definir agora uma palavra-passe, o administrador será obrigado a cadastrá-la no seu primeiro dia de acesso antes de poder visualizar o painel.
                </p>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full py-2.5 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-bold transition-all shadow-md"
                >
                  Adicionar Administrador
                </button>
              </div>
            </form>

          </div>
        )}

        {/* SUBTAB 5: MODERN ANALYTICS INTERACTIVE METRICS */}
        {subTab === 'metricas' && (
          <div className="space-y-6">
            
            {/* Upper Intro block */}
            <div className="bg-slate-900 text-white rounded-3xl p-6 relative overflow-hidden">
              <div className="absolute right-0 top-0 bottom-0 w-1/3 opacity-10 flex items-center justify-center">
                <BarChart className="w-48 h-48 text-white stroke-1" />
              </div>
              <div className="relative z-10 space-y-2 max-w-xl">
                <span className="text-[10px] font-bold uppercase tracking-widest text-atelier-300 bg-atelier-950 px-2.5 py-1 rounded border border-atelier-800">
                  📈 SaaS KPI Cockpit
                </span>
                <h3 className="text-xl font-bold font-display tracking-tight mt-1">Metodologia de Faturamento & Integridade</h3>
                <p className="text-xs text-slate-350 leading-relaxed">
                  Acompanhe a receita estimada baseada em assinaturas activas das costureiras em Angola. Modele cenários de crescimento para definir suas metas de captação de novos clientes.
                </p>
              </div>
            </div>

            {/* Plan Partition Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              
              {/* Basic Plan Segment */}
              <div className="bg-white border rounded-3xl p-5 shadow-sm space-y-3">
                <div className="flex justify-between items-start border-b pb-2">
                  <div>
                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Subscrição Básico</h4>
                    <p className="text-lg font-bold text-slate-900 font-display mt-1">{atelies.filter(a => a.plano === 'basico' && a.ativo).length} Ativas</p>
                  </div>
                  <span className="px-2 py-0.5 bg-slate-100 text-[10px] text-slate-600 font-bold rounded">5.000 Kz/mês</span>
                </div>
                
                <div className="space-y-1.5 text-xs text-slate-600">
                  <div className="flex justify-between text-[11px]">
                    <span>Total Registritos:</span>
                    <strong>{atelies.filter(a => a.plano === 'basico').length} contas</strong>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span>Faturamento Estimado:</span>
                    <strong className="text-slate-900">{(atelies.filter(a => a.plano === 'basico' && a.ativo).length * 5000).toLocaleString('pt-AO')} Kz/mês</strong>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span>Conversão Ativa:</span>
                    <strong className="text-slate-700">
                      {atelies.filter(a => a.plano === 'basico').length > 0 
                        ? Math.round((atelies.filter(a => a.plano === 'basico' && a.ativo).length / atelies.filter(a => a.plano === 'basico').length) * 100)
                        : 0}%
                    </strong>
                  </div>
                </div>
              </div>

              {/* Pro Premium Segment */}
              <div className="bg-white border rounded-3xl p-5 shadow-sm space-y-3">
                <div className="flex justify-between items-start border-b pb-2">
                  <div>
                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Subscrição Pro Premium</h4>
                    <p className="text-lg font-bold text-slate-900 font-display mt-1">{atelies.filter(a => a.plano === 'pro' && a.ativo).length} Ativas</p>
                  </div>
                  <span className="px-2 py-0.5 bg-atelier-50 text-[10px] text-atelier-700 font-bold rounded">9.000 Kz/mês</span>
                </div>
                
                <div className="space-y-1.5 text-xs text-slate-600">
                  <div className="flex justify-between text-[11px]">
                    <span>Total Registritos:</span>
                    <strong>{atelies.filter(a => a.plano === 'pro').length} contas</strong>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span>Faturamento Estimado:</span>
                    <strong className="text-atelier-800">{(atelies.filter(a => a.plano === 'pro' && a.ativo).length * 9000).toLocaleString('pt-AO')} Kz/mês</strong>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span>Conversão Ativa:</span>
                    <strong className="text-slate-700">
                      {atelies.filter(a => a.plano === 'pro').length > 0
                        ? Math.round((atelies.filter(a => a.plano === 'pro' && a.ativo).length / atelies.filter(a => a.plano === 'pro').length) * 100)
                        : 0}%
                    </strong>
                  </div>
                </div>
              </div>

              {/* Total Summary Growth */}
              <div className="bg-atelier-50/50 border border-atelier-250/70 rounded-3xl p-5 flex flex-col justify-between">
                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Métricas Anuais Projetadas</h4>
                  <div className="flex items-baseline gap-2 mt-1">
                    <strong className="text-xl font-display text-atelier-900">{(estimatedMRR * 12).toLocaleString('pt-AO')} Kz</strong>
                    <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-0.5 font-mono">
                      <TrendingUp className="w-3 h-3" /> +100%
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500 leading-normal mt-1">
                    Com base no faturamento recorrente mensal recorrente acumulado (MRR) actual de <strong>{estimatedMRR.toLocaleString('pt-AO')} Kz</strong>.
                  </p>
                </div>
                <div className="border-t border-slate-200/50 pt-2 flex items-center justify-between text-[11px] text-slate-500 mt-2">
                  <span>Projecção Trimestral:</span>
                  <strong className="text-slate-900 font-mono">{(estimatedMRR * 3).toLocaleString('pt-AO')} Kz</strong>
                </div>
              </div>

            </div>

            {/* Visual Distribution Share Chart */}
            <div className="bg-white border border-slate-150 rounded-3xl p-6 shadow-sm space-y-4">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5 font-display">
                📊 Partilha e Distribuição Actual do MRR Registado
              </h4>
              
              {estimatedMRR === 0 ? (
                <p className="text-xs text-slate-400 font-medium">Sem dados activos suficientes de momento.</p>
              ) : (
                <div className="space-y-4 pt-2">
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs font-mono text-slate-600">
                      <span>Plano Básico (5.000 Kz)</span>
                      <span>{( (atelies.filter(a => a.plano === 'basico' && a.ativo).length * 5000 / estimatedMRR) * 100 ).toFixed(0)}% do MRR</span>
                    </div>
                    
                    {/* Progress container */}
                    <div className="h-4 bg-slate-100 rounded-full overflow-hidden flex p-0.5 border border-slate-205/50">
                      <div 
                        className="bg-indigo-950 h-full rounded-l-full transition-all duration-300"
                        style={{ width: `${(atelies.filter(a => a.plano === 'basico' && a.ativo).length * 5000 / estimatedMRR) * 100}%` }}
                      ></div>
                      <div 
                        className="bg-indigo-600 h-full rounded-r-full transition-all duration-300"
                        style={{ width: `${(atelies.filter(a => a.plano === 'pro' && a.ativo).length * 9000 / estimatedMRR) * 100}%` }}
                      ></div>
                    </div>
                  </div>

                  <div className="flex items-center gap-6 text-[11px] font-sans flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-lg bg-indigo-950 inline-block shadow-sm"></span>
                      <span className="text-slate-655 font-medium">Básico (Total: {(atelies.filter(a => a.plano === 'basico' && a.ativo).length * 5000).toLocaleString('pt-AO')} Kz)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-lg bg-indigo-600 inline-block shadow-sm"></span>
                      <span className="text-slate-655 font-medium">Pro Premium (Total: {(atelies.filter(a => a.plano === 'pro' && a.ativo).length * 9000).toLocaleString('pt-AO')} Kz)</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Interactive growth modeling sheet */}
            <div className="bg-white border rounded-3xl p-6 shadow-sm space-y-4">
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2 font-display">
                  <Award className="w-4.5 h-4.5 text-atelier-700" /> Simulador de Escala & Receita (Metas FlowTailor)
                </h4>
                <p className="text-xs text-slate-500">
                  Defina o número alvo de costureiras cadastradas e estime o faturamento gerado para viabilizar investimentos de marketing.
                </p>
              </div>

              {/* Interactive sliders layout */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2 border-t border-slate-100">
                <div className="space-y-4">
                  
                  {/* Slider 1: User numbers */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-semibold text-slate-700">Costureiras Alvo (Ativas):</span>
                      <strong className="text-slate-900 bg-slate-100 px-2 py-0.5 rounded font-mono">{simAteliersTarget} Ateliês</strong>
                    </div>
                    <input
                      type="range"
                      min="10"
                      max="500"
                      step="5"
                      value={simAteliersTarget}
                      onChange={(e) => setSimAteliersTarget(Number(e.target.value))}
                      className="w-full accent-atelier-700 h-1.5 bg-slate-100 rounded-lg cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] text-slate-400 font-medium">
                      <span>10 Ateliês</span>
                      <span>250 Ateliês</span>
                      <span>500 Ateliês</span>
                    </div>
                  </div>

                  {/* Slider 2: Plan mix percentage */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-semibold text-slate-700">Participação de Planos Pro Premium (%):</span>
                      <strong className="text-atelier-700 bg-atelier-50 px-2 py-0.5 rounded font-mono">{simPercentPro}% Pro</strong>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="5"
                      value={simPercentPro}
                      onChange={(e) => setSimPercentPro(Number(e.target.value))}
                      className="w-full accent-atelier-700 h-1.5 bg-slate-100 rounded-lg cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] text-slate-400 font-medium">
                      <span>0% Pro (Apenas Básico)</span>
                      <span>50% Pro / 50% Básico</span>
                      <span>100% Pro Premium</span>
                    </div>
                  </div>

                </div>

                {/* Simulated Revenue Output Block */}
                <div className="bg-slate-50 border rounded-2xl p-5 flex flex-col justify-between space-y-4">
                  <div className="space-y-3">
                    <span className="text-[10px] font-bold text-slate-405 uppercase tracking-widest font-mono">Retorno Estável Projetado</span>
                    
                    <div className="space-y-2 text-xs text-slate-650">
                      <div className="flex justify-between items-center">
                        <span>Clientes Plano Básico (5.000 Kz):</span>
                        <strong className="text-slate-900">{Math.round(simAteliersTarget * (1 - simPercentPro / 100))} Ateliês</strong>
                      </div>
                      <div className="flex justify-between items-center">
                        <span>Clientes Plano Pro (9.000 Kz):</span>
                        <strong className="text-slate-900">{Math.round(simAteliersTarget * (simPercentPro / 100))} Ateliês</strong>
                      </div>
                    </div>
                  </div>

                  {/* Big outcome visualization */}
                  <div className="border-t border-slate-200/80 pt-3">
                    <p className="text-[11px] text-slate-500 font-medium">Faturamento Estimado Mensal:</p>
                    <div className="flex items-baseline gap-2 mt-1">
                      <strong className="text-2xl font-display font-black text-slate-900">
                        {(
                          Math.round(simAteliersTarget * (1 - simPercentPro / 100)) * 5000 +
                          Math.round(simAteliersTarget * (simPercentPro / 100)) * 9000
                        ).toLocaleString('pt-AO')}{' '}
                        Kz
                      </strong>
                      <span className="text-xs text-slate-400">/mês</span>
                    </div>
                    <p className="text-[10px] text-slate-400 leading-normal mt-1 flex items-center gap-1">
                      <HelpCircle className="w-3.5 h-3.5" /> Metodologia de cálculo baseada no factor de conversão offline padrão.
                    </p>
                  </div>
                </div>
              </div>

            </div>

          </div>
        )}

      </div>

      {/* Verification manual picture/PDF viewing modal */}
      {verComprovImagem && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 select-none">
          <div className="max-w-md w-full bg-white rounded-3xl overflow-hidden shadow-2xl relative border">
            <button
              onClick={() => setVerComprovImagem(null)}
              className="absolute top-3.5 right-3.5 p-1 bg-slate-900 text-white rounded-full text-xs hover:bg-black transition-colors"
            >
              Fechar
            </button>
            <div className="p-4 bg-slate-100 font-bold text-xs text-slate-700 text-center">
              Visualização de Recibo Comprovativo
            </div>
            
            <img
              src={verComprovImagem}
              alt="Recibo Comprovante Pago"
              className="w-full h-96 object-contain bg-slate-50"
              referrerPolicy="no-referrer"
            />
          </div>
        </div>
      )}

      {/* Adjust Expiration Extends Model Panel */}
      {detalheAtelie && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 border shadow-2xl space-y-4">
            <div>
              <h4 className="text-sm font-bold text-slate-900 font-display">🗓️ Ajustar Período de Licença</h4>
              <p className="text-xs text-slate-500 mt-1">Ateliê: <strong>{detalheAtelie.nome}</strong></p>
            </div>

            {/* Selector mode */}
            <div className="flex bg-slate-100 p-1 rounded-xl gap-1 select-none">
              <button
                type="button"
                onClick={() => setTipoAjusteVencimento('dias')}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  tipoAjusteVencimento === 'dias' 
                    ? 'bg-white text-slate-900 shadow-sm' 
                    : 'text-slate-500 hover:text-slate-805'
                }`}
              >
                Estender Dias
              </button>
              <button
                type="button"
                onClick={() => setTipoAjusteVencimento('data')}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  tipoAjusteVencimento === 'data' 
                    ? 'bg-white text-slate-900 shadow-sm' 
                    : 'text-slate-500 hover:text-slate-805'
                }`}
              >
                Data Limite
              </button>
            </div>
            
            {tipoAjusteVencimento === 'dias' ? (
              <div className="space-y-3">
                <label className="block text-xs font-bold text-slate-600">Quantidade de Dias Adicionais</label>
                <select
                  className="w-full p-2 border rounded-xl text-xs bg-slate-50 text-slate-900 font-semibold focus:outline-none"
                  value={extensaoDias}
                  onChange={(e) => setExtensaoDias(e.target.value)}
                >
                  <option value="7">Estender em 7 Dias (Cortesia)</option>
                  <option value="15">Estender em 15 Dias</option>
                  <option value="30">Estender em 30 Dias (Renovação Padrão)</option>
                  <option value="90">Estender em 90 Dias (Trimestral)</option>
                  <option value="180">Estender em 180 Dias (Semestral)</option>
                  <option value="365">Estender em 365 Dias (Anual)</option>
                </select>
                <p className="text-[10px] text-slate-400">
                  O vencimento actual ({new Date(detalheAtelie.dataVencimento).toLocaleDateString('pt-AO')}) será estendido a partir de hoje ou do próprio vencimento (o que for maior).
                </p>
              </div>
            ) : (
              <div className="space-y-3 animate-in fade-in duration-150">
                <label className="block text-xs font-bold text-slate-600">Nova Data de Vencimento Personalizada</label>
                <input
                  type="date"
                  required
                  className="w-full p-2.5 border rounded-xl text-xs bg-slate-50 text-slate-900 font-semibold focus:outline-none focus:ring-1 focus:ring-atelier-500"
                  value={dataPersonalizada}
                  onChange={(e) => setDataPersonalizada(e.target.value)}
                />
                <p className="text-[10px] text-slate-400">
                  Data de vencimento precedente: {new Date(detalheAtelie.dataVencimento).toLocaleDateString('pt-AO')}.
                </p>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => {
                  if (tipoAjusteVencimento === 'dias') {
                    handleAdicionarDias(detalheAtelie.id, Number(extensaoDias));
                  } else {
                    if (!dataPersonalizada) {
                      showToast('Por favor, selecione uma data válida!', 'error');
                      return;
                    }
                    handleDefinirDataVencimento(detalheAtelie.id, dataPersonalizada);
                  }
                  setDetalheAtelie(null);
                }}
                className="flex-1 py-2 bg-atelier-700 hover:bg-atelier-850 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm"
              >
                Confirmar Ajuste
              </button>
              <button
                onClick={() => setDetalheAtelie(null)}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-705 rounded-xl text-xs font-semibold cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject payment text explanation modal */}
      {rejeitandoId && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={handleRejeitarSolicitacaoSubmit} className="bg-white rounded-3xl max-w-sm w-full p-6 border shadow-2xl space-y-4">
            <div>
              <h4 className="text-sm font-bold text-slate-900 font-display">✖ Rejeitar Comprovativo de Pagamento</h4>
              <p className="text-xs text-slate-500 mt-1">Explique o motivo para notificar e orientar a costureira.</p>
            </div>
            
            <div className="space-y-3">
              <label className="block text-xs font-bold text-slate-600">Motivo da Rejeição</label>
              <textarea
                required
                rows={3}
                placeholder="Ex Nome do titular diferente / O ficheiro de imagem está corrompido ou ilegível..."
                className="w-full p-2.5 border rounded-xl text-xs bg-slate-50 focus:outline-none focus:ring-1 focus:ring-atelier-500"
                value={notaRejeicao}
                onChange={(e) => setNotaRejeicao(e.target.value)}
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="submit"
                className="flex-1 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all"
              >
                Confirmar Rejeição
              </button>
              <button
                type="button"
                onClick={() => {
                  setRejeitandoId(null);
                  setNotaRejeicao('');
                }}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-705 rounded-xl text-xs font-semibold"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Floating Modern Toast Popup Manager */}
      {toast && (
        <div className={`fixed bottom-5 right-5 z-50 flex items-center gap-2.5 px-4 py-3 rounded-2xl shadow-xl border animate-in slide-in-from-bottom-5 duration-200 ${
          toast.type === 'success' 
            ? 'border-emerald-200 text-emerald-950 bg-emerald-55/90 backdrop-blur' 
            : toast.type === 'error' 
              ? 'border-red-200 text-red-950 bg-red-55/90 backdrop-blur' 
              : 'border-blue-250 text-blue-950 bg-blue-55/90 backdrop-blur font-medium'
        }`}>
          {toast.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
          {toast.type === 'error' && <XCircle className="w-4 h-4 text-red-600 shrink-0" />}
          {toast.type === 'info' && <AlertCircle className="w-4 h-4 text-blue-600 shrink-0" />}
          <span className="text-xs font-bold font-sans tracking-tight">{toast.message}</span>
        </div>
      )}

    </div>
  );
}
