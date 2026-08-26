import { Link, useLocation } from 'react-router-dom';
import { customAuth, localDb } from '../firebase';
import { LayoutDashboard, Users, Scissors, Settings, ShieldAlert, LogOut, Sparkles, X, Download, TrendingUp, Cloud, CloudOff, RefreshCw } from 'lucide-react';
import { useState, useEffect } from 'react';

interface SidebarProps {
  onLogout: () => void;
  isAdmin: boolean;
  atelieName?: string;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
}

export default function Sidebar({ onLogout, isAdmin, atelieName, isOpenMobile, onCloseMobile }: SidebarProps) {
  const location = useLocation();
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showInstallModal, setShowInstallModal] = useState(false);
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);

  useEffect(() => {
    const unsubNet = localDb.onNetworkChange((online) => setIsOnline(online));
    const unsubSync = localDb.onSyncStatusChange((syncing, last) => {
      setIsSyncing(syncing);
      setLastSync(last);
    });

    return () => {
      unsubNet();
      unsubSync();
    };
  }, []);

  useEffect(() => {
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    
    const handleAppInstalled = () => {
      console.log('Aplicativo instalado com sucesso.');
      try {
        localStorage.setItem('flowtailor_app_installed', 'true');
      } catch (e) {}
      setIsStandalone(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleAppInstalled);

    // Initial check and subsequent updates of standalone mode status
    const checkStandalone = () => {
      let alreadyInstalledMark = false;
      try {
        alreadyInstalledMark = localStorage.getItem('flowtailor_app_installed') === 'true';
      } catch (e) {}

      const isPWA = window.matchMedia('(display-mode: standalone)').matches 
        || (window.navigator as any).standalone === true 
        || document.referrer.includes('android-app://')
        || alreadyInstalledMark;
      
      setIsStandalone(isPWA);
    };

    checkStandalone();
    // Run after a short delay to allow visual settings load
    setTimeout(checkStandalone, 500);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallApp = () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then((choiceResult: any) => {
        if (choiceResult.outcome === 'accepted') {
          console.log('O utilizador aceitou a instalação do FlowTailor.');
          try {
            localStorage.setItem('flowtailor_app_installed', 'true');
          } catch (e) {}
          setIsStandalone(true);
        }
        setDeferredPrompt(null);
      });
    } else {
      setShowInstallModal(true);
    }
  };

  const handleMarkAsInstalledManual = () => {
    try {
      localStorage.setItem('flowtailor_app_installed', 'true');
    } catch (e) {}
    setIsStandalone(true);
    setShowInstallModal(false);
  };

  const isSelected = (path: string) => {
    return location.pathname === path;
  };

  const navItems = isAdmin
    ? [
        { path: '/admin', label: 'Painel Admin', icon: ShieldAlert },
        { path: '/configuracoes', label: 'Minhas Configs', icon: Settings }
      ]
    : [
        { path: '/dashboard', label: 'Painel Principal', icon: LayoutDashboard },
        { path: '/clientes', label: 'Clientes & Medidas', icon: Users },
        { path: '/pedidos', label: 'Pedidos / Encomendas', icon: Scissors },
        { path: '/relatorios', label: 'Relatórios & Finanças', icon: TrendingUp },
        { path: '/configuracoes', label: 'Configurações', icon: Settings },
      ];

  return (
    <>
      {/* Backdrop for mobile overlays */}
      {isOpenMobile && (
        <div 
          onClick={onCloseMobile}
          className="lg:hidden fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-40 cursor-pointer animate-in fade-in duration-200"
        />
      )}

      <aside 
        id="sidebar-container" 
        className={`fixed top-0 bottom-0 left-0 z-50 w-64 border-r border-atelier-200 bg-white flex flex-col justify-between p-5 transition-transform duration-200 ease-in-out lg:z-30 lg:translate-x-0 ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div>
          {/* Brand Logo & Close button row */}
          <div className="flex items-center justify-between mb-8 px-2 py-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-atelier-500 rounded-lg flex items-center justify-center text-white shadow-sm">
                <Scissors className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-xl font-bold font-display tracking-tight text-atelier-900 flex items-center gap-1 leading-none">
                  Flow<span className="text-atelier-500">Tailor</span>
                </h1>
                <p className="text-[10px] font-mono tracking-wider uppercase text-slate-400 mt-1">SaaS Angolano</p>
              </div>
            </div>

            {/* Mobile Close Button */}
            {onCloseMobile && (
              <button
                type="button"
                onClick={onCloseMobile}
                className="lg:hidden p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer select-none"
                aria-label="Fechar menu"
                id="close-sidebar-btn"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

        {/* Tenant/User label */}
        <div className="mb-6 px-3.5 py-2.5 rounded-lg bg-atelier-50 border border-atelier-200 shadow-sm">
          <p className="text-[10px] font-semibold text-atelier-700 uppercase tracking-widest leading-none mb-1">
            {isAdmin ? 'Acesso Administrativo' : 'Ateliê Ativo'}
          </p>
          <p className="text-sm font-bold text-slate-800 truncate">
            {isAdmin ? 'Administração Global' : (atelieName || 'Meu Ateliê')}
          </p>
        </div>

        {/* Dynamic Navigation */}
        <nav className="space-y-1 list-none">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isSelected(item.path);
            return (
              <li key={item.path}>
                <Link
                  to={item.path}
                  onClick={onCloseMobile}
                   className={`flex items-center gap-3 px-3 py-2.5 rounded-md transition-all duration-150 group text-sm font-medium ${
                    active
                      ? 'bg-atelier-100 text-atelier-700 font-semibold'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <Icon className={`w-4 h-4 transition-transform duration-150 ${
                    active ? 'scale-110 text-atelier-700' : 'text-slate-400 group-hover:scale-110'
                  }`} />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </nav>
      </div>

      {/* Logout Control */}
      <div>
      {/* Hybrid Database Resilience Indicator */}
      <div className="px-1.5">
        {!isStandalone && (
          <button
            type="button"
            onClick={handleInstallApp}
            className="w-full flex items-center justify-center gap-2 mb-3 px-3 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shadow-md animate-bounce cursor-pointer"
          >
            <Download className="w-4 h-4" />
            Instalar Aplicação 📲
          </button>
        )}

        <div className={`p-3 border rounded-xl text-[11px] space-y-1.5 mb-4 select-none transition-colors ${
          !isOnline 
            ? 'bg-amber-50/70 border-amber-200/70 text-amber-800'
            : isSyncing 
              ? 'bg-blue-50/70 border-blue-200/70 text-blue-800'
              : 'bg-slate-50 border-slate-200/60 text-slate-500'
        }`}>
          <div className="flex items-center justify-between font-bold">
            <span className="uppercase text-[9px] tracking-wider text-slate-500 flex items-center gap-1">
              {!isOnline ? (
                <>
                  <CloudOff className="w-3 h-3 text-amber-600" />
                  <span>Modo Offline</span>
                </>
              ) : isSyncing ? (
                <>
                  <RefreshCw className="w-3 h-3 text-blue-600 animate-spin" />
                  <span>A Sincronizar...</span>
                </>
              ) : (
                <>
                  <Cloud className="w-3 h-3 text-emerald-600" />
                  <span>Sistema Híbrido</span>
                </>
              )}
            </span>
            <span className={`flex items-center gap-1 text-[10px] ${
              !isOnline ? 'text-amber-700' : isSyncing ? 'text-blue-700' : 'text-emerald-600'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full inline-block ${
                !isOnline ? 'bg-amber-500' : isSyncing ? 'bg-blue-500 animate-ping' : 'bg-emerald-500 animate-pulse'
              }`}></span> 
              {!isOnline ? 'Local' : isSyncing ? 'Nuvem...' : 'Online & Nuvem'}
            </span>
          </div>
          <p className="text-[10px] text-slate-400 leading-snug">
            {!isOnline 
              ? 'Guardado em cache local no aparelho. Será enviado assim que tiver internet.'
              : isSyncing 
                ? 'A gravar alterações no Cloud Firestore...'
                : 'Sincronização automática ativa sempre que houver internet.'}
          </p>
          {lastSync && (
            <div className="text-[9px] text-slate-400 flex items-center justify-between pt-0.5 border-t border-slate-200/40">
              <span>Última sincro:</span>
              <span className="font-mono text-[9px] text-slate-500">{lastSync.split(',')[1] || lastSync}</span>
            </div>
          )}
        </div>

        <button
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium text-red-650 hover:bg-red-50 hover:text-red-900 transition-all duration-150"
        >
          <LogOut className="w-4 h-4" />
          Terminar Sessão
        </button>
      </div>
      </div>
    </aside>

    {/* Elegant Portuguese PWA Manual Installation Modal */}
    {showInstallModal && (
      <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-[9999] flex items-center justify-center p-4 animate-in fade-in duration-200">
        <div className="bg-white rounded-3xl border border-slate-200 max-w-md w-full shadow-2xl p-6 relative overflow-hidden flex flex-col gap-4 animate-in zoom-in-95 duration-200 text-left">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <span className="text-xl">📲</span>
              <h3 className="font-bold text-slate-900 text-sm font-display tracking-tight">Instalar FlowTailor</h3>
            </div>
            <button
              onClick={() => setShowInstallModal(false)}
              className="p-1.5 rounded-lg text-slate-450 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Description */}
          <p className="text-xs text-slate-500 leading-relaxed">
            O FlowTailor é um PWA (Aplicação Web Progressiva). Adicione-o ao seu ecrã para aceder sem gastar dados (Unitel/Movicel), ter navegação super rápida e utilizar as funcionalidades no seu ateliê.
          </p>

          {/* Step Guides */}
          <div className="space-y-3.5 my-1">
            {/* iPhone / Safari */}
            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-150/60 text-xs">
              <div className="font-bold text-slate-900 mb-1 flex items-center gap-2">
                <span className="bg-slate-200 text-slate-800 text-[9px] px-1.5 py-0.5 rounded font-mono font-bold">iOS</span>
                No Safari do iPhone / iPad
              </div>
              <p className="text-slate-600 leading-normal text-[11px]">
                1. Toque no ícone de <strong className="text-slate-900">Partilhar</strong> (rectângulo com seta para cima no fundo).<br />
                2. Role nas opções e clique em <strong className="text-slate-900">"Adicionar ao Ecrã Principal"</strong>.<br />
                3. Confirme no canto superior direito clicando em <strong className="text-slate-900">"Adicionar"</strong>.
              </p>
            </div>

            {/* Android / Chrome */}
            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-150/60 text-xs">
              <div className="font-bold text-slate-900 mb-1 flex items-center gap-2">
                <span className="bg-slate-200 text-slate-800 text-[9px] px-1.5 py-0.5 rounded font-mono font-bold">ANDROID</span>
                No Google Chrome para Android
              </div>
              <p className="text-slate-600 leading-normal text-[11px]">
                1. Toque no menu de <strong className="text-slate-900">três pontos</strong> (canto superior direito).<br />
                2. Seleccione a opção <strong className="text-slate-900">"Instalar aplicação"</strong> ou <strong className="text-slate-900">"Adicionar ao ecrã inicial"</strong>.
              </p>
            </div>

            {/* Desktop / PC */}
            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-150/60 text-xs">
              <div className="font-bold text-slate-900 mb-1 flex items-center gap-2">
                <span className="bg-slate-200 text-slate-800 text-[9px] px-1.5 py-0.5 rounded font-mono font-bold">COMPUTADOR</span>
                No Chrome / Edge (PC ou Mac)
              </div>
              <p className="text-slate-600 leading-normal text-[11px]">
                Procure o ícone de instalação <strong className="text-atelier-700 font-mono">➕ (Instalar)</strong> no lado direito da barra de endereço URL ou abra as opções do navegador e clique em <strong className="text-slate-900">"Instalar FlowTailor"</strong>.
              </p>
            </div>
          </div>

          {/* Bottom Close */}
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2 flex-wrap">
            <button
              onClick={handleMarkAsInstalledManual}
              className="px-3.5 py-2 bg-slate-150 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition-all cursor-pointer"
              title="Ocultar botão de instalação para sempre no seu dispositivo"
            >
              Já instalei, ocultar botão 🎯
            </button>
            <button
              onClick={() => setShowInstallModal(false)}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
            >
              Entendido, fechar 🌟
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
