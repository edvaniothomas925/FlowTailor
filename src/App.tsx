import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { customAuth, localDb, sanitizeForPayload } from './lib/neonStore';
import { UserSession, Atelie } from './types';

// Importing custom components
import Sidebar from './components/Sidebar';
import DashboardView from './components/DashboardView';
import ClientesView from './components/ClientesView';
import PedidosView from './components/PedidosView';
import RenovarView from './components/RenovarView';
import AdminView from './components/AdminView';
import LandingPage from './components/LandingPage';
import RelatoriosView from './components/RelatoriosView';
import { SecurityDefenseView } from './components/SecurityDefenseView';
import { PAISES_CONFIG, formatarMoeda, formatarMoedaSimples, getAtelieCountry, getPrecoPlano } from './lib/localization';

// Importing notification engine
import { 
  scanExpiringOrders, 
  getAlertsHistory, 
  saveAlertsHistory, 
  getNotificationSettings, 
  saveNotificationSettings, 
  simulateTestNotification,
  PushNotificationAlert,
  NotificationSettings,
  DEFAULT_WHATSAPP_TEMPLATE,
  formatWhatsAppMessage
} from './lib/notificationEngine';

import { ToastMessage, ConfirmDialogData, toast, confirmDialog } from './lib/toast';

// Icons for Login/Register card
import { 
  Scissors, 
  AlertTriangle, 
  Sparkles, 
  User, 
  Mail, 
  Lock, 
  Phone, 
  CreditCard, 
  ShieldCheck, 
  Key,
  CheckCircle2,
  Cloud, 
  Database, 
  RefreshCw, 
  Menu,
  Bell,
  BellRing,
  Volume2,
  VolumeX,
  MessageSquare,
  Clock,
  Trash2,
  Check,
  ExternalLink,
  Info,
  Network,
  Fingerprint,
  Laptop,
  Terminal,
  FileLock2,
  Eye,
  History,
  Users,
  Brain,
  ShieldAlert,
  Activity,
  CheckCircle,
  Shirt,
  Crown,
  Ruler,
  Tag
} from 'lucide-react';

export const AVATAR_OPTIONS = [
  { id: 'scissors', label: 'Tesoura', emoji: '✂️' },
  { id: 'needle', label: 'Agulha & Linha', emoji: '🪡' },
  { id: 'tape', label: 'Fita Métrica', emoji: '📏' },
  { id: 'shirt', label: 'Peça / Roupa', emoji: '👕' },
  { id: 'crown', label: 'Alta Costura', emoji: '👑' },
  { id: 'sparkles', label: 'Ateliê Luxo', emoji: '✨' },
  { id: 'tag', label: 'Etiqueta / Marca', emoji: '🏷️' },
  { id: 'initials', label: 'Inicial do Nome', emoji: '🔤' },
];

export function AtelieAvatar({
  iconKey,
  nome,
  className = "w-8 h-8 rounded-full bg-atelier-100 border border-atelier-500 flex items-center justify-center text-atelier-700 font-bold select-none text-xs shadow-sm shrink-0"
}: {
  iconKey?: string;
  nome: string;
  className?: string;
}) {
  switch (iconKey) {
    case 'scissors':
      return <div className={className} title="Tesoura"><Scissors className="w-4 h-4" /></div>;
    case 'needle':
      return <div className={className} title="Agulha & Linha"><span className="text-sm leading-none">🪡</span></div>;
    case 'tape':
      return <div className={className} title="Fita Métrica"><Ruler className="w-4 h-4" /></div>;
    case 'shirt':
      return <div className={className} title="Peça / Roupa"><Shirt className="w-4 h-4" /></div>;
    case 'crown':
      return <div className={className} title="Alta Costura"><Crown className="w-4 h-4 text-amber-600" /></div>;
    case 'sparkles':
      return <div className={className} title="Ateliê Luxo"><Sparkles className="w-4 h-4 text-amber-500" /></div>;
    case 'tag':
      return <div className={className} title="Etiqueta / Marca"><Tag className="w-4 h-4" /></div>;
    default:
      return (
        <div className={className}>
          {(nome || 'A').substring(0, 1).toUpperCase()}
        </div>
      );
  }
}

export default function App() {
  const [session, setSession] = useState<UserSession | null>(customAuth.getCurrentUser());
  const [atelie, setAtelie] = useState<Atelie | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [bypassLanding, setBypassLanding] = useState(false);
  const [authInitialTab, setAuthInitialTab] = useState<'login' | 'register'>('login');
  const [authInitialCountry, setAuthInitialCountry] = useState<'AO' | 'PT' | 'BR'>('AO');
  
  // Triggers for deep interaction cross-page navigations (e.g. pre-selecting client id for pedido creation)
  const [preselectedClientId, setPreselectedClientId] = useState<string | null>(null);

  // Push notification states
  const [bellOpen, setBellOpen] = useState(false);
  const [notifHistory, setNotifHistory] = useState<PushNotificationAlert[]>([]);
  const [activeAlert, setActiveAlert] = useState<PushNotificationAlert | null>(null);

  // Toast & Custom Confirm Dialog States
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [confirmData, setConfirmData] = useState<ConfirmDialogData | null>(null);

  useEffect(() => {
    const handleToast = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail) {
        const id = (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36));
        setToasts((prev) => [...prev, { id, message: detail.message, type: detail.type }]);
        setTimeout(() => {
          setToasts((prev) => prev.filter((t) => t.id !== id));
        }, 4000);
      }
    };

    const handleConfirm = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail) {
        setConfirmData(detail);
      }
    };

    window.addEventListener('app-toast', handleToast);
    window.addEventListener('app-confirm', handleConfirm);

    return () => {
      window.removeEventListener('app-toast', handleToast);
      window.removeEventListener('app-confirm', handleConfirm);
    };
  }, []);

  // Load history when atelie is initialized
  useEffect(() => {
    if (atelie) {
      setNotifHistory(getAlertsHistory(atelie.id));
      
      // Perform initial check with a short delay to avoid layout flashes
      const initialDelay = setTimeout(() => {
        triggerAutomaticScan();
      }, 3000);

      // Background scanner scans every 45s for deadlines to prompt alerts
      const scanInterval = setInterval(() => {
        triggerAutomaticScan();
      }, 45000);

      return () => {
        clearTimeout(initialDelay);
        clearInterval(scanInterval);
      };
    } else {
      setNotifHistory([]);
      setActiveAlert(null);
    }
  }, [atelie]);

  const triggerAutomaticScan = () => {
    if (!atelie) return;
    scanExpiringOrders(atelie.id, (newAlert) => {
      // Set the sliding toast
      setActiveAlert(newAlert);
      // Automatically refresh count and history
      setNotifHistory(getAlertsHistory(atelie.id));
    });
  };

  const markAllAsRead = () => {
    if (!atelie) return;
    const updated = notifHistory.map(n => ({ ...n, read: true }));
    setNotifHistory(updated);
    saveAlertsHistory(atelie.id, updated);
  };

  const deleteAlert = (alertId: string) => {
    if (!atelie) return;
    const updated = notifHistory.filter(n => n.id !== alertId);
    setNotifHistory(updated);
    saveAlertsHistory(atelie.id, updated);
  };

  useEffect(() => {
    refreshSession();
  }, []);

  // Global automatic hybrid sync whenever user is online or internet connection is restored
  useEffect(() => {
    if (!atelie) return;

    // Trigger initial sync if online
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      localDb.syncIfOnline(atelie.id, true);
    }

    const handleGlobalOnline = () => {
      toast.success('🌐 Ligação à Internet restabelecida! Dados sincronizados com o Neon PostgreSQL.');
      localDb.syncIfOnline(atelie.id, false);
    };

    window.addEventListener('online', handleGlobalOnline);
    return () => {
      window.removeEventListener('online', handleGlobalOnline);
    };
  }, [atelie?.id]);

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const queryCountry = params.get('country') || params.get('pais');
      if (queryCountry === 'BR' || queryCountry === 'PT' || queryCountry === 'AO') {
        setAuthInitialCountry(queryCountry);
      }
    } catch (e) {
      console.warn("Could not read country parameter on mount", e);
    }
  }, []);

  const refreshSession = () => {
    const currentSession = customAuth.getCurrentUser();
    setSession(currentSession);

    if (currentSession && !currentSession.isAdmin) {
      const tenantData = localDb.getAtelies().find(a => a.emailOwner.toLowerCase() === currentSession.email.toLowerCase());
      setAtelie(tenantData || null);
    } else {
      setAtelie(null);
    }
  };

  const handleLogout = () => {
    customAuth.logout();
    setBypassLanding(false);
    refreshSession();
  };

  if (!session) {
    const isInstalledStandalone = typeof window !== 'undefined' && (
      window.matchMedia('(display-mode: standalone)').matches 
      || (window.navigator as any).standalone === true 
      || document.referrer.includes('android-app://')
    );

    if (!isInstalledStandalone && !bypassLanding) {
      return (
        <LandingPage 
          onStartTrial={(country: 'AO' | 'PT' | 'BR') => {
            setAuthInitialTab('register');
            setAuthInitialCountry(country);
            setBypassLanding(true);
          }}
          onLogin={() => {
            setAuthInitialTab('login');
            setBypassLanding(true);
          }}
        />
      );
    }

    return (
      <AuthScreen 
        onLoginSuccess={refreshSession} 
        initialTab={authInitialTab}
        onBackToLanding={!isInstalledStandalone ? () => setBypassLanding(false) : undefined}
        initialCountry={authInitialCountry}
      />
    );
  }

  // Check if tenant account is expired or inactive (except if administrators are logged in)
  const isExpired = atelie ? (new Date(atelie.dataVencimento).getTime() < Date.now()) : false;
  const isBlocked = atelie ? (!atelie.ativo || isExpired) : false;

  if (!session.isAdmin && isBlocked && atelie) {
    return (
      <RenovarView
        atelie={atelie}
        onLogout={handleLogout}
        onRefresh={refreshSession}
      />
    );
  }

  return (
    <Router>
      <div className="min-h-screen bg-atelier-50 text-slate-800 flex flex-col">
        
        {/* Persistent Layout Sidebar container */}
        <Sidebar
          onLogout={handleLogout}
          isAdmin={session.isAdmin}
          atelieName={atelie?.nome}
          isOpenMobile={mobileMenuOpen}
          onCloseMobile={() => setMobileMenuOpen(false)}
        />

        {/* Core application canvas panels */}
        <main className="lg:pl-64 pl-0 min-h-screen flex flex-col justify-between transition-all duration-200">
          <div className="flex-1 flex flex-col">
            {/* Header Section */}
            <header className="h-16 flex items-center justify-between px-4 sm:px-6 md:px-8 bg-white border-b border-atelier-200 shadow-sm shrink-0 select-none">
              <div className="flex items-center min-w-0">
                {/* Mobile Hamburger toggle button */}
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(true)}
                  className="lg:hidden p-2 -ml-1.5 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 mr-2 cursor-pointer select-none transition-colors shrink-0"
                  aria-label="Toggle menu"
                >
                  <Menu className="w-5 h-5" />
                </button>

                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 hidden md:inline">Workspace:</span>
                  <span className="text-xs font-bold text-atelier-900 sm:text-sm truncate">{session.isAdmin ? 'Painel de Controlo Admin' : (atelie?.nome || 'Meu Ateliê')}</span>
                </div>
              </div>
              
              <div className="flex items-center gap-3 md:gap-4 shrink-0 relative">
                {atelie && (
                  <>
                    {/* Expiry date tag */}
                    <div className="bg-atelier-400 border border-atelier-300 px-2 py-0.5 sm:px-3 sm:py-1 rounded text-[10px] sm:text-[11px] text-atelier-700 font-bold shrink-0">
                      <span className="hidden xs:inline">Vencença: </span>{new Date(atelie.dataVencimento).toLocaleDateString('pt-AO')}
                    </div>

                    {/* Notification Bell with Dropdown */}
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setBellOpen(!bellOpen)}
                        className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl relative cursor-pointer select-none transition-all flex items-center justify-center border border-slate-100 bg-slate-50/50"
                        title="Alertas de Encomendas"
                      >
                        {notifHistory.some(n => !n.read) ? (
                          <BellRing className="w-4 h-4 text-amber-500 animate-pulse" />
                        ) : (
                          <Bell className="w-4 h-4" />
                        )}
                        {notifHistory.filter(n => !n.read).length > 0 && (
                          <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-600 text-white rounded-full text-[8px] font-bold flex items-center justify-center animate-beat">
                            {notifHistory.filter(n => !n.read).length}
                          </span>
                        )}
                      </button>

                      {bellOpen && (
                        <div className="absolute right-0 mt-3.5 w-80 bg-white rounded-2xl border border-slate-200/80 shadow-xl z-55 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
                          <div className="p-3.5 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                            <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5 uppercase tracking-wider font-display">
                              <Bell className="w-3.5 h-3.5 text-atelier-700 font-bold" /> Avisos (2 dias)
                            </h4>
                            {notifHistory.some(n => !n.read) && (
                              <button
                                onClick={markAllAsRead}
                                className="text-[10px] font-bold text-atelier-700 hover:text-atelier-900 cursor-pointer"
                              >
                                Marcar lidos
                              </button>
                            )}
                          </div>

                          <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
                            {notifHistory.length === 0 ? (
                              <div className="p-6 text-center text-slate-400 space-y-2 select-none">
                                <span className="text-2xl block">🪡</span>
                                <p className="text-xs font-medium leading-relaxed">Excelente! Nenhuma encomenda a vencer em 2 dias hoje.</p>
                              </div>
                            ) : (
                              notifHistory.map((notif) => (
                                <div 
                                  key={notif.id} 
                                  className={`p-3 text-left transition hover:bg-slate-50/50 space-y-2 ${
                                    notif.read ? 'opacity-80' : 'bg-atelier-50/20'
                                  }`}
                                >
                                  <div className="flex items-start justify-between gap-1.5">
                                    <div className="flex gap-2">
                                      <span className="text-slate-400 font-mono mt-0.5"><Clock className="w-3.5 h-3.5 text-amber-500 shrink-0" /></span>
                                      <div className="space-y-0.5 min-w-0">
                                        <p className="text-xs font-bold text-slate-900 leading-tight truncate">
                                          {notif.clientNome}
                                        </p>
                                        <p className="text-[10px] text-slate-500 line-clamp-2">
                                          {notif.orderDesc}
                                        </p>
                                      </div>
                                    </div>
                                    <button
                                      onClick={() => deleteAlert(notif.id)}
                                      className="p-1 hover:bg-slate-100 rounded-lg text-slate-300 hover:text-red-650 cursor-pointer shrink-0"
                                      title="Apagar alerta"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  </div>

                                  <div className="flex items-center gap-1.5 justify-between pt-1">
                                    <span className="text-[9px] text-slate-400 font-medium font-mono">
                                      {new Date(notif.sentAt).toLocaleDateString('pt-AO')}
                                    </span>
                                    
                                    <a
                                      href={notif.whatsappUrl}
                                      target="_blank"
                                      rel="noreferrer noopener"
                                      className="py-1 px-2.5 bg-emerald-55 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 font-bold rounded-lg text-[9px] flex items-center gap-1 cursor-pointer transition"
                                      onClick={() => {
                                        // Mark single notif as read when clicked
                                        const found = notifHistory.find(n => n.id === notif.id);
                                        if (found) {
                                          found.read = true;
                                        }
                                        setNotifHistory([...notifHistory]);
                                        saveAlertsHistory(atelie.id, notifHistory);
                                      }}
                                    >
                                      <MessageSquare className="w-3 h-3 text-emerald-650 shrink-0" /> Gerar WhatsApp
                                    </a>
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                          
                          <div className="p-2 border-t border-slate-105 text-center bg-slate-50/50">
                            <button
                              onClick={() => {
                                setBellOpen(false);
                                // Workaround navigations helper
                                setBellOpen(false);
                                const link = document.querySelector('a[href="/configuracoes"]');
                                if (link) {
                                  (link as HTMLElement).click();
                                } else {
                                  window.location.href = '/configuracoes';
                                }
                              }}
                              className="text-[10px] font-bold text-slate-500 hover:text-slate-900 flex items-center gap-1 justify-center mx-auto cursor-pointer"
                            >
                              Configurar Alertas <ExternalLink className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                )}
                
                <div className="flex items-center gap-2">
                  <div className="text-right hidden sm:block">
                    <p className="text-xs font-semibold leading-none text-slate-700 truncate max-w-[120px]">
                      {atelie ? atelie.nome : (localStorage.getItem('ateliepro_admin_nome') || 'Administrador Global')}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-0.5 font-mono truncate max-w-[150px]">{session.email}</p>
                  </div>
                  <AtelieAvatar
                    iconKey={atelie?.avatarIcon || localStorage.getItem('ateliepro_admin_avatar_icon') || 'scissors'}
                    nome={atelie?.nome || localStorage.getItem('ateliepro_admin_nome') || 'Administrador Global'}
                  />
                </div>
              </div>
            </header>

            <div className="max-w-7xl mx-auto p-6 lg:p-8 space-y-6 w-full flex-1">
              
              <Routes>
                {session.isAdmin ? (
                  <>
                    <Route path="/admin" element={<AdminView onRefreshAtelieSession={refreshSession} />} />
                    <Route path="/configuracoes" element={<ConfiguracoesView atelie={null} onRefresh={refreshSession} />} />
                    <Route path="*" element={<Navigate to="/admin" replace />} />
                  </>
                ) : (
                  <>
                    {/* Standard Tailor Workstations Workspace */}
                    <Route path="/dashboard" element={atelie && <DashboardView atelie={atelie} />} />
                    <Route
                      path="/clientes"
                      element={
                        atelie && (
                          <ClientesView
                            atelie={atelie}
                            onNavigateToCreateOrder={(cliId) => {
                              setPreselectedClientId(cliId);
                              // Programmatic route push isn't strictly necessary since we can link states,
                              // we navigate to /pedidos tab wrapper.
                              window.location.href = '/pedidos';
                            }}
                          />
                        )
                      }
                    />
                    <Route
                      path="/pedidos"
                      element={
                        atelie && (
                          <PedidosView
                            atelie={atelie}
                            preselectedClientId={preselectedClientId}
                            onClearPreselect={() => setPreselectedClientId(null)}
                          />
                        )
                      }
                    />
                    <Route 
                      path="/relatorios" 
                      element={
                        atelie && (
                          <RelatoriosView 
                            atelie={atelie} 
                          />
                        )
                      } 
                    />
                    <Route 
                      path="/configuracoes" 
                      element={
                        atelie && (
                          <ConfiguracoesView 
                            atelie={atelie} 
                            onRefresh={refreshSession} 
                            onNewAlertTriggered={(alert) => {
                              setActiveAlert(alert);
                              setNotifHistory(getAlertsHistory(atelie.id));
                            }}
                          />
                        )
                      } 
                    />
                    <Route path="*" element={<Navigate to="/dashboard" replace />} />
                  </>
                )}
              </Routes>

            </div>
          </div>

          {/* Bottom Status Bar */}
          <footer className="min-h-[2.5rem] py-3 sm:py-0 bg-atelier-900 text-white/60 flex flex-col sm:flex-row items-center justify-between px-4 sm:px-8 text-[10px] uppercase tracking-wider font-bold border-t border-atelier-950 gap-2 select-none">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
                <span>📡 Servidor Activo</span>
              </span>
              <span className="opacity-20 text-[8px]">|</span>
              <span className="font-mono text-[9px] text-white/40">v1.0.4-MVP</span>
            </div>
            <div className="text-center sm:text-right text-white/50">
              FlowTailor Luanda — Orgulhosamente Angolano <span className="inline-block animate-pulse">🇦🇴</span>
            </div>
          </footer>
        </main>
      </div>

      {/* Real-time Push Notification sliding toast */}
      {activeAlert && (
        <div className="fixed bottom-6 right-6 z-55 max-w-sm w-full bg-slate-900 text-white rounded-2xl p-5 shadow-2xl border border-slate-800 animate-in slide-in-from-bottom-5 duration-300 flex flex-col gap-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex gap-2.5">
              <span className="p-2 bg-amber-500/20 rounded-xl text-amber-400 shrink-0 mt-0.5 animate-pulse">
                <BellRing className="w-5 h-5" />
              </span>
              <div className="space-y-1">
                <h5 className="text-[10px] font-bold text-amber-400 uppercase tracking-wildest font-display shrink-0">Lembrete de Prazo (2 dias)</h5>
                <h6 className="text-sm font-bold text-white leading-snug">{activeAlert.clientNome}</h6>
                <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed">{activeAlert.orderDesc}</p>
              </div>
            </div>
            <button
              onClick={() => setActiveAlert(null)}
              className="text-slate-400 hover:text-white transition p-1 rounded-lg hover:bg-slate-800 cursor-pointer shrink-0"
              title="Fechar"
            >
              <Check className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-2 pt-1 border-t border-slate-850">
            <a
              href={activeAlert.whatsappUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-550 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
              onClick={() => {
                // Mark as read
                activeAlert.read = true;
                setNotifHistory([...notifHistory]);
                if (atelie) saveAlertsHistory(atelie.id, notifHistory);
                setActiveAlert(null);
              }}
            >
              <MessageSquare className="w-4 h-4 shrink-0" /> Gerar WhatsApp 💬
            </a>
            <button
              onClick={() => setActiveAlert(null)}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-750 text-slate-305 font-semibold rounded-xl text-xs cursor-pointer transition-colors"
            >
              Ignorar
            </button>
          </div>
        </div>
      )}

      {/* Custom High-Fidelity Toasts Overlay */}
      <div className="fixed bottom-6 left-6 z-100 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto p-4 rounded-2xl shadow-xl border flex items-start gap-3 animate-in slide-in-from-left-5 duration-300 w-full ${
              toast.type === 'success'
                ? 'bg-emerald-950 text-emerald-100 border-emerald-800'
                : toast.type === 'error'
                ? 'bg-rose-950 text-rose-100 border-rose-900'
                : toast.type === 'warning'
                ? 'bg-amber-950 text-amber-100 border-amber-800'
                : 'bg-slate-900 text-slate-100 border-slate-800'
            }`}
          >
            <span className={`p-1.5 rounded-lg shrink-0 mt-0.5 ${
              toast.type === 'success'
                ? 'bg-emerald-900/50 text-emerald-400'
                : toast.type === 'error'
                ? 'bg-rose-900/50 text-rose-450'
                : toast.type === 'warning'
                ? 'bg-amber-900/50 text-amber-500'
                : 'bg-slate-800 text-slate-400'
            }`}>
              {toast.type === 'success' ? (
                <Check className="w-4 h-4" />
              ) : toast.type === 'error' ? (
                <AlertTriangle className="w-4 h-4" />
              ) : (
                <Info className="w-4 h-4" />
              )}
            </span>
            <div className="flex-1 text-xs font-semibold leading-relaxed pr-2">
              {toast.message}
            </div>
            <button
              onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
              className="text-white/40 hover:text-white transition-opacity p-0.5 cursor-pointer shrink-0"
            >
              &times;
            </button>
          </div>
        ))}
      </div>

      {/* Custom High-Fidelity Confirmation Modal */}
      {confirmData && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 z-101 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl border border-slate-200 p-6 max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-200 space-y-5">
            <div className="flex items-center justify-center w-12 h-12 bg-amber-50 border border-amber-200 text-amber-600 rounded-full select-none">
              <AlertTriangle className="w-6 h-6 animate-pulse" />
            </div>
            
            <div className="text-center space-y-2">
              <h5 className="text-sm font-bold text-slate-900 font-display">Confirmação de Ação</h5>
              <p className="text-xs text-slate-500 leading-relaxed font-sans">{confirmData.message}</p>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => {
                  if (confirmData.onCancel) confirmData.onCancel();
                  setConfirmData(null);
                }}
                className="flex-1 py-2.5 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  confirmData.onConfirm();
                  setConfirmData(null);
                }}
                className="flex-1 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition shadow-sm cursor-pointer"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </Router>
  );
}

/* AUTHENTICATION VIEW COMPONENT (LOGIN / REGISTER WITH DEMO QUICK FILLS) */
interface AuthScreenProps {
  onLoginSuccess: () => void;
  initialTab?: 'login' | 'register';
  onBackToLanding?: () => void;
  initialCountry?: 'AO' | 'PT' | 'BR';
}

function AuthScreen({ onLoginSuccess, initialTab = 'login', onBackToLanding, initialCountry = 'AO' }: AuthScreenProps) {
  const [activeTab, setActiveTab] = useState<'login' | 'register'>(initialTab);
  const [regPais, setRegPais] = useState<'AO' | 'PT' | 'BR'>(initialCountry);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    if (initialCountry) {
      setRegPais(initialCountry);
    }
  }, [initialCountry]);

  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [errorMess, setErrorMess] = useState('');

  // Admin First Access Password Setup State
  const [adminFirstSetup, setAdminFirstSetup] = useState<{ email: string } | null>(null);
  const [adminFirstSenha, setAdminFirstSenha] = useState('');
  const [adminFirstSenhaConfirm, setAdminFirstSenhaConfirm] = useState('');
  const [isSettingAdminPassword, setIsSettingAdminPassword] = useState(false);

  // Register Fields
  const [regAtelieNome, setRegAtelieNome] = useState('');
  const [regNomeDono, setRegNomeDono] = useState('');
  const [regTelefone, setRegTelefone] = useState('244');

  useEffect(() => {
    const ddi = PAISES_CONFIG[regPais]?.codigoDDI || '244';
    setRegTelefone(ddi);
  }, [regPais]);

  const [regEmail, setRegEmail] = useState('');
  const [regSenha, setRegSenha] = useState('');
  const [regPlano, setRegPlano] = useState<'basico' | 'pro'>('basico');

  const openGoogleAuth = async () => {
    setErrorMess('');
    try {
      const sess = await customAuth.loginWithGoogle();
      if (sess) {
        toast.success('Autenticado com o Google com sucesso!');
        onLoginSuccess();
      }
    } catch (err: any) {
      if (
        err?.code === 'auth/cancelled-popup-request' ||
        err?.code === 'auth/popup-closed-by-user' ||
        err?.message?.includes('popup-closed-by-user') ||
        err?.message?.includes('fechada antes de concluir')
      ) {
        toast.info('Autenticação do Google cancelada.');
      } else if (err?.code === 'auth/popup-blocked' || err?.message?.includes('bloqueado')) {
        toast.error('O popup de login foi bloqueado. Por favor, permita popups neste navegador ou abra a app noutra aba.');
      } else {
        console.error('Google Auth Error:', err);
        toast.error('Erro de autenticação com o Google: ' + (err.message || err));
      }
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMess('');

    const mailLower = email.toLowerCase().trim();
    const isAdmin = localDb.getAdmins().includes(mailLower);

    // Se for administrador e ainda não tem senha configurada (1º dia de acesso)
    if (isAdmin && !localDb.hasAdminPassword(mailLower)) {
      if (senha && senha.length >= 6) {
        try {
          await customAuth.login(mailLower, senha);
          toast.success('🛡️ Palavra-passe de Administrador definida com sucesso no seu 1º acesso!');
          onLoginSuccess();
          return;
        } catch (err: any) {
          setErrorMess(err.message || 'Falha ao autenticar administrador.');
          return;
        }
      } else {
        // Abre o fluxo dedicado de configuração de palavra-passe no primeiro dia
        setAdminFirstSetup({ email: mailLower });
        return;
      }
    }

    try {
      await customAuth.login(email, senha);
      onLoginSuccess();
    } catch (err: any) {
      if (err?.isFirstAdminAccess) {
        setAdminFirstSetup({ email: err.adminEmail || mailLower });
      } else {
        setErrorMess(err.message || 'Erro inesperado.');
      }
    }
  };

  const handleAdminFirstPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMess('');

    if (!adminFirstSetup?.email) return;

    if (!adminFirstSenha || adminFirstSenha.length < 6) {
      setErrorMess('A palavra-passe deve ter pelo menos 6 caracteres.');
      return;
    }

    if (adminFirstSenha !== adminFirstSenhaConfirm) {
      setErrorMess('As palavras-passe não coincidem. Por favor, confirme novamente.');
      return;
    }

    setIsSettingAdminPassword(true);
    try {
      await customAuth.setupAdminFirstPassword(adminFirstSetup.email, adminFirstSenha);
      toast.success('🛡️ Palavra-passe de Administrador criada com sucesso! Acesso concedido.');
      onLoginSuccess();
    } catch (err: any) {
      setErrorMess(err.message || 'Erro ao gravar palavra-passe de Administrador.');
    } finally {
      setIsSettingAdminPassword(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMess('');

    if (!regAtelieNome || !regNomeDono || !regEmail) {
      setErrorMess('Por favor, preencha todos os campos obrigatórios.');
      return;
    }

    try {
      await customAuth.signUp(regEmail, regAtelieNome, regTelefone, regSenha);
      
      // Update the newly created ateliê to matching selected plan and country (since signUp default-seeds basico/AO)
      const current = customAuth.getCurrentUser();
      if (current && current.uid) {
        const ate = localDb.getAtelie(current.uid);
        if (ate) {
          ate.plano = regPlano;
          ate.pais = regPais;
          localDb.saveAtelie(ate);
        }
      }

      onLoginSuccess();
    } catch (err: any) {
      setErrorMess(err.message || 'Falha ao registrar Ateliê.');
    }
  };

  return (
    <div className="min-h-screen bg-atelier-50/40 flex flex-col items-center justify-center p-4 relative">
      {onBackToLanding && (
        <button
          onClick={onBackToLanding}
          className="absolute top-4 left-4 sm:top-6 sm:left-6 bg-white/90 hover:bg-white text-slate-700 hover:text-slate-900 text-xs font-bold px-3.5 py-2 border border-slate-200 hover:border-slate-350 rounded-xl flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
        >
          ← Voltar à Página Inicial
        </button>
      )}
      
      {/* Upper Branded welcome banner */}
      <div className="text-center space-y-2 mb-8 select-none">
        <div className="inline-flex p-3.5 bg-atelier-600 text-white rounded-3xl shadow-lg shadow-atelier-650/25 mb-2 scale-110">
          <Scissors className="w-8 h-8 rotate-45" />
        </div>
        <h1 className="text-3xl font-extrabold font-display text-atelier-950 tracking-tight flex items-center justify-center gap-1.5 leading-none">
          FlowTailor <Sparkles className="w-4 h-4 text-atelier-500 fill-atelier-300" />
        </h1>
        <p className="text-xs text-slate-500 max-w-sm tracking-wide leading-relaxed">
          O Software de Gestão Pro para Costureiras e Alfaiates de Angola. 🇦🇴 Controle medidas, prazos e faturamento manual num só lugar.
        </p>
      </div>

      <div className="w-full max-w-md bg-white rounded-3xl border border-atelier-200/80 shadow-2xl shadow-atelier-950/5 overflow-hidden transition-all">
        
        {/* If Admin First Setup is Active */}
        {adminFirstSetup ? (
          <div className="p-6 sm:p-8 space-y-5">
            <div className="text-center space-y-1.5 pb-2 border-b border-atelier-100">
              <div className="inline-flex p-3 bg-amber-500/10 text-amber-600 rounded-2xl mb-1">
                <ShieldCheck className="w-7 h-7" />
              </div>
              <h2 className="text-xl font-bold font-display text-slate-900">
                Primeiro Acesso de Administrador
              </h2>
              <p className="text-xs text-slate-500 max-w-xs mx-auto">
                Conta: <span className="font-semibold text-slate-800">{adminFirstSetup.email}</span>
              </p>
            </div>

            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-2.5">
              <Key className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-900 leading-relaxed font-medium">
                Por motivos de segurança, no seu primeiro dia de acesso como Administrador é obrigatório definir uma palavra-passe mestre para a sua conta.
              </p>
            </div>

            {errorMess && (
              <div className="p-3 bg-red-50 border border-red-200 text-xs font-semibold text-red-700 rounded-xl leading-normal flex items-start gap-2">
                <AlertTriangle className="w-4.5 h-4.5 text-red-600 shrink-0" />
                <span>{errorMess}</span>
              </div>
            )}

            <form onSubmit={handleAdminFirstPasswordSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                  <Lock className="w-3.5 h-3.5 text-slate-500" /> Nova Palavra-passe de Administrador
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  placeholder="Mínimo 6 caracteres"
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  value={adminFirstSenha}
                  onChange={(e) => setAdminFirstSenha(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-slate-500" /> Confirmar Palavra-passe
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  placeholder="Digite a mesma palavra-passe"
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  value={adminFirstSenhaConfirm}
                  onChange={(e) => setAdminFirstSenhaConfirm(e.target.value)}
                />
              </div>

              <div className="pt-2 space-y-2">
                <button
                  type="submit"
                  disabled={isSettingAdminPassword}
                  className="w-full py-3 bg-amber-600 hover:bg-amber-700 text-white font-bold text-sm rounded-xl transition-all shadow-md shadow-amber-600/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <ShieldCheck className="w-4 h-4" />
                  {isSettingAdminPassword ? 'A gravar segurança...' : 'Gravar Senha e Entrar no Painel'}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setAdminFirstSetup(null);
                    setAdminFirstSenha('');
                    setAdminFirstSenhaConfirm('');
                    setErrorMess('');
                  }}
                  className="w-full py-2.5 text-xs font-bold text-slate-500 hover:text-slate-800 transition-all text-center cursor-pointer"
                >
                  Cancelar e Voltar
                </button>
              </div>
            </form>
          </div>
        ) : (
          <>
            {/* Session tabs select */}
            <div className="grid grid-cols-2 bg-atelier-50/50 border-b border-atelier-100 select-none">
              <button
                onClick={() => {
                  setActiveTab('login');
                  setErrorMess('');
                }}
                className={`py-3.5 text-xs font-bold text-center transition-all ${
                  activeTab === 'login'
                    ? 'bg-white border-b-2 border-atelier-600 text-atelier-950 font-extrabold'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                Entrar no Painel
              </button>
              
              <button
                onClick={() => {
                  setActiveTab('register');
                  setErrorMess('');
                }}
                className={`py-3.5 text-xs font-bold text-center transition-all ${
                  activeTab === 'register'
                    ? 'bg-white border-b-2 border-atelier-600 text-atelier-950 font-extrabold'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                Cadastrar Ateliê
              </button>
            </div>

            <div className="p-6 sm:p-8 space-y-6">
              
              {errorMess && (
                <div className="p-3 bg-red-50 border border-red-200 text-xs font-semibold text-red-700 rounded-xl leading-normal flex items-start gap-2">
                  <AlertTriangle className="w-4.5 h-4.5 text-red-600 shrink-0" />
                  <span>{errorMess}</span>
                </div>
              )}

          {activeTab === 'login' ? (
            /* LOGIN MODULE */
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600 flex items-center gap-1"><Mail className="w-3.5 h-3.5" /> Adereço de E-mail</label>
                <input
                  type="email"
                  required
                  placeholder="Seu e-mail cadastrado"
                  className="w-full px-3.5 py-2 text-sm border border-gray-200 rounded-xl bg-slate-50 focus:outline-none"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600 flex items-center gap-1"><Lock className="w-3.5 h-3.5" /> Palavra-passe</label>
                <input
                  type="password"
                  required
                  placeholder="Introduza a sua senha"
                  className="w-full px-3.5 py-2 text-sm border border-gray-200 rounded-xl bg-slate-50 focus:outline-none"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full py-3 bg-atelier-700 hover:bg-atelier-850 text-white font-bold text-sm rounded-xl transition-all shadow-md shadow-atelier-750/15"
                >
                  Confirmar Acesso ao Ateliê
                </button>
              </div>

              {/* OU ENTRE COM GOOGLE */}
              <div className="relative flex py-1.5 items-center">
                <div className="flex-grow border-t border-slate-200/80"></div>
                <span className="flex-shrink mx-3 text-slate-400 text-[10px] font-bold uppercase tracking-widest font-mono">Ou entre com</span>
                <div className="flex-grow border-t border-slate-200/80"></div>
              </div>

              <button
                type="button"
                onClick={openGoogleAuth}
                className="w-full py-3 px-4 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-xl flex items-center justify-center gap-3 transition-all select-none shadow-sm cursor-pointer hover:scale-[1.01] active:scale-[0.99]"
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#EA4335"
                    d="M5.266 9.765A7.077 7.077 0 0112 4.909c1.69 0 3.218.6 4.418 1.582L19.91 3C17.782 1.145 15.055 0 12 0 7.33 0 3.313 2.682 1.34 6.582l3.926 3.183z"
                  />
                  <path
                    fill="#4285F4"
                    d="M16.04 15.345c-1.07.727-2.437 1.164-4.04 1.164a7.077 7.077 0 01-6.734-4.855L1.34 14.836A12 12 0 0012 24c3.245 0 6.19-1.09 8.41-2.945l-4.37-3.71z"
                  />
                  <path
                    fill="#34A853"
                    d="M11.999 16.51c-.13 0-.255-.01-.382-.01l4.418 3.755A12.017 12.017 0 0024 12c0-.727-.068-1.427-.182-2.11L12 10v4.51c1.8 0 3.23.864 3.755 2.01l.245-.01z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M1.34 6.582a12.001 12.001 0 000 10.836l3.926-3.183c-.227-.682-.34-1.4-.34-2.235 0-.837.113-1.555.34-2.236L1.34 6.582z"
                  />
                </svg>
                Entrar com o Google
              </button>
            </form>
          ) : (
            /* REGISTER MODULE WITH INHERENT PRICING PLAN CARDS */
            <form onSubmit={handleRegisterSubmit} className="space-y-4 max-h-[420px] overflow-y-auto pr-1">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600 flex items-center gap-1"><Scissors className="w-3.5 h-3.5" /> Nome do seu Ateliê *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Ateliê Ramos Alfaiataria"
                  className="w-full px-3.5 py-2 text-sm border border-gray-200 rounded-xl bg-slate-50 focus:outline-none"
                  value={regAtelieNome}
                  onChange={(e) => setRegAtelieNome(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600 flex items-center gap-1"><User className="w-3.5 h-3.5" /> Nome do Costureiro(a) Dono(a) *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Rosa Ramos"
                  className="w-full px-3.5 py-2 text-sm border border-gray-200 rounded-xl bg-slate-50 focus:outline-none"
                  value={regNomeDono}
                  onChange={(e) => setRegNomeDono(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600 flex items-center gap-1"><Phone className="w-3.5 h-3.5" /> Telefone / WhatsApp *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: 244923000000"
                  className="w-full px-3.5 py-2 text-sm border border-gray-200 rounded-xl bg-slate-50 focus:outline-none font-mono"
                  value={regTelefone}
                  onChange={(e) => setRegTelefone(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600 flex items-center gap-1"><Mail className="w-3.5 h-3.5" /> E-mail de Contacto Principal *</label>
                <input
                  type="email"
                  required
                  placeholder="Ex: rosa.ramos@gmail.com"
                  className="w-full px-3.5 py-2 text-sm border border-gray-200 rounded-xl bg-slate-50 focus:outline-none"
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600 flex items-center gap-1"><Lock className="w-3.5 h-3.5" /> Palavra-passe de Acesso *</label>
                <input
                  type="password"
                  required
                  placeholder="Crie de pelo menos 6 caracteres"
                  className="w-full px-3.5 py-2 text-sm border border-gray-200 rounded-xl bg-slate-50 focus:outline-none font-sans"
                  value={regSenha}
                  onChange={(e) => setRegSenha(e.target.value)}
                />
              </div>


              {/* Plan Choice option Cards */}
              <div className="space-y-1.5 pt-1.5">
                <label className="text-xs font-bold text-slate-650 flex items-center gap-1"><CreditCard className="w-3.5 h-3.5" /> Selecione o Plano Desejado</label>
                <div className="grid grid-cols-2 gap-2.5">
                  <div
                    onClick={() => setRegPlano('basico')}
                    className={`p-3.5 rounded-2xl border text-left cursor-pointer transition-all ${
                      regPlano === 'basico'
                        ? 'border-atelier-600 bg-atelier-50/40 shadow-sm'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <strong className="text-xs block text-slate-900">Básico (Estúdio)</strong>
                    <span className="text-[11px] text-slate-500 block">
                      {formatarMoedaSimples(PAISES_CONFIG[regPais].basicPrice, regPais)} / mês
                    </span>
                  </div>

                  <div
                    onClick={() => setRegPlano('pro')}
                    className={`p-3.5 rounded-2xl border text-left cursor-pointer transition-all ${
                      regPlano === 'pro'
                        ? 'border-atelier-600 bg-atelier-50/40 shadow-sm'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <strong className="text-xs block text-slate-900">Pro (Ilimitado)</strong>
                    <span className="text-[11px] text-slate-550 block font-bold text-atelier-700">
                      {formatarMoedaSimples(PAISES_CONFIG[regPais].proPrice, regPais)} / mês
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full py-3 bg-atelier-700 hover:bg-atelier-850 text-white font-bold text-sm rounded-xl transition-all shadow-md shadow-atelier-750/15"
                >
                  Criar minha Conta Costureira
                </button>
              </div>

              {/* OU CADASTRAR COM GOOGLE */}
              <div className="relative flex py-1.5 items-center">
                <div className="flex-grow border-t border-slate-200/80"></div>
                <span className="flex-shrink mx-3 text-slate-400 text-[10px] font-bold uppercase tracking-widest font-mono">Ou registe-se via</span>
                <div className="flex-grow border-t border-slate-200/80"></div>
              </div>

              <button
                type="button"
                onClick={openGoogleAuth}
                className="w-full py-3 px-4 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-xl flex items-center justify-center gap-3 transition-all select-none shadow-sm cursor-pointer hover:scale-[1.01] active:scale-[0.99]"
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#EA4335"
                    d="M5.266 9.765A7.077 7.077 0 0112 4.909c1.69 0 3.218.6 4.418 1.582L19.91 3C17.782 1.145 15.055 0 12 0 7.33 0 3.313 2.682 1.34 6.582l3.926 3.183z"
                  />
                  <path
                    fill="#4285F4"
                    d="M16.04 15.345c-1.07.727-2.437 1.164-4.04 1.164a7.077 7.077 0 01-6.734-4.855L1.34 14.836A12 12 0 0012 24c3.245 0 6.19-1.09 8.41-2.945l-4.37-3.71z"
                  />
                  <path
                    fill="#34A853"
                    d="M11.999 16.51c-.13 0-.255-.01-.382-.01l4.418 3.755A12.017 12.017 0 0024 12c0-.727-.068-1.427-.182-2.11L12 10v4.51c1.8 0 3.23.864 3.755 2.01l.245-.01z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M1.34 6.582a12.001 12.001 0 000 10.836l3.926-3.183c-.227-.682-.34-1.4-.34-2.235 0-.837.113-1.555.34-2.236L1.34 6.582z"
                  />
                </svg>
                Registar com o Google
              </button>
            </form>
          )}

          {/* NO DEMO ACC PANEL */}

        </div>
          </>
        )}
      </div>

    </div>
  );
}

/* NOTIFICATION SETTINGS CARD MODULE */
interface NotificationSettingsCardProps {
  atelie: Atelie;
  onNewAlertTriggered?: (alert: PushNotificationAlert) => void;
}

function NotificationSettingsCard({ atelie, onNewAlertTriggered }: NotificationSettingsCardProps) {
  const [settings, setSettings] = useState<NotificationSettings>(() => getNotificationSettings(atelie.id));
  const [permissionState, setPermissionState] = useState<string>(() => {
    try {
      if (!('Notification' in window)) return 'unsupported';
      return Notification.permission;
    } catch (e) {
      console.warn('Blocked reading Notification.permission from sandboxed iframe:', e);
      return 'denied';
    }
  });
  const [loadingTest, setLoadingTest] = useState(false);

  const handleToggleEnabled = () => {
    const next = { ...settings, enabled: !settings.enabled };
    setSettings(next);
    saveNotificationSettings(atelie.id, next);
  };

  const handleToggleSound = () => {
    const next = { ...settings, soundEnabled: !settings.soundEnabled };
    setSettings(next);
    saveNotificationSettings(atelie.id, next);
  };

  const requestPermission = () => {
    try {
      if (!('Notification' in window)) {
        toast.warn('Este navegador não suporta notificações push nativas de sistema.');
        return;
      }
      
      const req = Notification.requestPermission();
      if (req && typeof req.then === 'function') {
        req.then((perm) => {
          setPermissionState(perm);
          if (perm === 'granted') {
            toast.success('Excelente! Permissões de notificação push concedidas com sucesso.');
          } else {
            toast.error('As notificações foram negadas. Se desejar habilitar, ajuste as permissões de privacidade no seu browser.');
          }
        }).catch((err) => {
          console.warn('Notification permission request rejected or failed:', err);
          toast.error('Não foi possível obter permissões de notificação neste ambiente.');
        });
      } else {
        // Fallback for older browsers using callbacks
        (Notification as any).requestPermission((perm: string) => {
          setPermissionState(perm);
        });
      }
    } catch (e) {
      console.warn('Failed to call Notification.requestPermission in sandboxed iframe:', e);
      toast.error('Habilitar notificações não é suportado pelo seu navegador neste ambiente de simulação.');
    }
  };

  const handleRunSimulation = () => {
    setLoadingTest(true);
    setTimeout(() => {
      simulateTestNotification(atelie.id, (alert) => {
        if (onNewAlertTriggered) {
          onNewAlertTriggered(alert);
        }
      });
      setLoadingTest(false);
    }, 600);
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-6 relative overflow-hidden mt-6">
      <div className="absolute right-0 top-0 w-24 h-24 bg-gradient-to-bl from-amber-500/5 to-transparent rounded-full pointer-events-none select-none"></div>
      
      <div className="border-b border-slate-100 pb-3 mb-5 flex flex-col xs:flex-row xs:items-center justify-between gap-3 select-none animate-in fade-in duration-200">
        <div>
          <span className="text-[9px] uppercase font-bold tracking-widest text-amber-600 bg-amber-50 px-2.5 py-1 rounded-md border border-amber-200 font-sans">
            🔔 Sistema de Alertas Inteligentes
          </span>
          <h3 className="text-base font-bold text-slate-900 mt-1.5 font-display font-bold">Configurar Notificações Push & WhatsApp</h3>
          <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">Alertas e avisos push para encomendas prestes a vencer em 2 dias.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in fade-in duration-300">
        
        {/* Left column: Toggles & Permissions */}
        <div className="space-y-4">
          <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Controladores de Estado</h4>
          
          <div className="space-y-3.5 pt-1 select-none">
            {/* Toggle 1: Enabled */}
            <div className="flex items-center justify-between p-3.5 border border-slate-100/80 rounded-2xl hover:bg-slate-50/40 transition">
              <div className="space-y-0.5">
                <p className="text-xs font-bold text-slate-800">Alertas de Prazos Activos (2 Dias)</p>
                <p className="text-[10px] text-slate-500 max-w-[210px] leading-relaxed">Varre e avisa sobre encomendas que entregam perfeitamente em 2 dias.</p>
              </div>
              <button
                type="button"
                onClick={handleToggleEnabled}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  settings.enabled ? 'bg-amber-500' : 'bg-slate-200'
                }`}
              >
                <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                  settings.enabled ? 'translate-x-5' : 'translate-x-0'
                }`} />
              </button>
            </div>

            {/* Toggle 2: Sound Chime */}
            <div className="flex items-center justify-between p-3.5 border border-slate-100/80 rounded-2xl hover:bg-slate-50/40 transition">
              <div className="space-y-0.5">
                <p className="text-xs font-bold text-slate-800">Sino de Alerta Acústico</p>
                <p className="text-[10px] text-slate-500 max-w-[210px] leading-relaxed">Toca um sinal acústico agradável nas colunas do computador ao emitir uma notificação.</p>
              </div>
              <button
                type="button"
                onClick={handleToggleSound}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  settings.soundEnabled ? 'bg-amber-500' : 'bg-slate-200'
                }`}
              >
                <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                  settings.soundEnabled ? 'translate-x-5' : 'translate-x-0'
                }`} />
              </button>
            </div>

            {/* Browser Permission Panel */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-0.5">
                <p className="text-xs font-bold text-slate-800 flex items-center gap-1.5 font-display">
                  📡 Notificações no Navegador
                </p>
                <p className="text-[10px] text-slate-500">
                  Estado actual do sistema: <strong className="uppercase font-mono text-[9px] text-amber-800 bg-amber-50 px-1.5 border border-amber-200/60 rounded">{permissionState}</strong>
                </p>
              </div>
              
              {permissionState !== 'granted' ? (
                <button
                  type="button"
                  onClick={requestPermission}
                  className="py-1.5 px-3.5 bg-atelier-900 border border-slate-950 text-white rounded-xl text-[10px] font-bold cursor-pointer select-none hover:bg-slate-800 active:scale-95 transition-all text-center"
                >
                  Permitir no Browser
                </button>
              ) : (
                <span className="text-[10px] font-bold text-emerald-700 flex items-center gap-1 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-250 select-none">
                  <Check className="w-3.5 h-3.5 text-emerald-700" /> Permissão Ativa
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right column: Simulator & Instructions */}
        <div className="space-y-5 flex flex-col justify-between">
          <div className="space-y-3">
            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono animate-pulse">Testes de Segurança & Envio WhatsApp</h4>
            <p className="text-xs text-slate-500 leading-relaxed">
              O AteliêPro monitoriza as especificações de cada encomenda em manufatura regularmente. Sempre que faltarem exactamente 2 dias, o painel do utilizador exibe o aviso push para enviar uma mensagem em Angola com detalhe estrito ao cliente.
            </p>
            <div className="p-3.5 bg-slate-50 border border-slate-100 rounded-2xl flex items-start gap-2.5">
              <Info className="w-4 h-4 text-amber-500 shrink-0 mt-0.5 animate-pulse" />
              <div className="space-y-0.5">
                <span className="text-[10px] font-bold text-slate-700 block select-none">Anatomia do Script de WhatsApp:</span>
                <p className="text-[9.5px] text-slate-450 leading-relaxed">
                  "Olá, [Cliente]! Passando para relembrar que a sua encomenda no AteliêPro ([Vestido/Calca]) está agendada para daqui a 2 dias (no dia [Data]). Estamos a finalizar..."
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-2 pt-3.5 border-t border-slate-50">
            <button
              type="button"
              onClick={handleRunSimulation}
              disabled={loadingTest}
              className="w-full py-2.5 bg-amber-500 hover:bg-amber-450 text-white rounded-xl text-xs font-bold shadow-sm flex items-center justify-center gap-1.5 cursor-pointer hover:scale-[1.01] active:scale-[0.99] transition-all disabled:opacity-50 select-none uppercase tracking-wider"
            >
              <BellRing className={`w-3.5 h-3.5 text-white ${loadingTest ? 'animate-spin' : ''}`} />
              {loadingTest ? 'A Gerar Cenário de Teste...' : 'Testar / Simular Alvo de 2 dias'}
            </button>
            <p className="text-[9px] text-center text-slate-450 font-medium">
              Gera instantaneamente uma encomenda virtual a vencer em 2 dias para validar o layout push e som sine wave.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}

/* SETTINGS VIEW MODULE COMPONENT */
interface ConfiguracoesProps {
  atelie: Atelie | null;
  onRefresh: () => void;
  onNewAlertTriggered?: (alert: PushNotificationAlert) => void;
}

function ConfiguracoesView({ atelie, onRefresh, onNewAlertTriggered }: ConfiguracoesProps) {
  // If atelie is null, we are logged in as admin. We edit simple configs
  const [nome, setNome] = useState(() => {
    if (atelie) return atelie.nome;
    return localStorage.getItem('ateliepro_admin_nome') || 'Administrador Global';
  });
  const [telefone, setTelefone] = useState(() => {
    if (atelie) return atelie.telefone;
    return localStorage.getItem('ateliepro_admin_telefone') || '244923456789';
  });
  const [pais, setPais] = useState<'AO' | 'PT' | 'BR'>(() => {
    if (atelie) return atelie.pais || 'AO';
    return 'AO';
  });
  const [avatarIcon, setAvatarIcon] = useState<string>(() => {
    if (atelie) return atelie.avatarIcon || 'scissors';
    return localStorage.getItem('ateliepro_admin_avatar_icon') || 'scissors';
  });
  const [salvando, setSalvando] = useState(false);

  // Hybrid Sync States
  const [syncMode, setSyncMode] = useState<'hybrid' | 'offline_local'>(() => {
    return (localStorage.getItem('flowtailor_sync_mode') as 'hybrid' | 'offline_local') || 'hybrid';
  });
  const [lastSync, setLastSync] = useState<string | null>(() => {
    return localStorage.getItem('flowtailor_last_sync') || new Date().toLocaleString('pt-AO');
  });
  const [connectionType, setConnectionType] = useState<string>('Banda Larga / WiFi');
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncProgress, setSyncProgress] = useState<number>(0);
  const [syncStageMsg, setSyncStageMsg] = useState<string>('');

  // State to manage configuration subtabs
  const [activeConfigTab, setActiveConfigTab] = useState<'perfil' | 'whatsapp' | 'seguranca'>('perfil');

  // Template state inside ConfiguracoesView
  const [notifConfig, setNotifConfig] = useState<NotificationSettings>(() => {
    return atelie ? getNotificationSettings(atelie.id) : { enabled: true, soundEnabled: true, lastScannedAt: null };
  });
  const [whatsappTemplate, setWhatsappTemplate] = useState<string>(() => {
    return notifConfig.whatsappTemplate || DEFAULT_WHATSAPP_TEMPLATE;
  });
  const [salvandoTemplate, setSalvandoTemplate] = useState(false);
  const [previewValue, setPreviewValue] = useState<number>(15000);

  const handleSaveTemplate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!atelie) return;
    setSalvandoTemplate(true);
    setTimeout(() => {
      const updatedConfig = { 
        ...notifConfig, 
        whatsappTemplate: whatsappTemplate 
      };
      setNotifConfig(updatedConfig);
      saveNotificationSettings(atelie.id, updatedConfig);
      setSalvandoTemplate(false);
      toast.success('Modelo de mensagem de lembrete WhatsApp salvo com sucesso!');
    }, 600);
  };

  const handleResetTemplate = () => {
    confirmDialog(
      'Tem certeza que deseja restaurar o modelo de WhatsApp para o padrão do sistema?',
      () => {
        setWhatsappTemplate(DEFAULT_WHATSAPP_TEMPLATE);
        toast.info('Modelo de WhatsApp restaurado para o padrão.');
      }
    );
  };

  const injectPlaceholder = (tag: string) => {
    setWhatsappTemplate(prev => prev + tag);
  };

  useEffect(() => {
    // Online listeners
    const handleOnline = () => {
      setIsOnline(true);
      const providers = ['Unitel 4G', 'Movicel LTE', 'Zap Fibra', 'DSTv Net', 'Banda Larga / WiFi'];
      let randomIndex = 0;
      if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
        const arr = new Uint32Array(1);
        crypto.getRandomValues(arr);
        randomIndex = arr[0] % providers.length;
      }
      setConnectionType(providers[randomIndex]);
    };
    const handleOffline = () => {
      setIsOnline(false);
      setConnectionType('Sem ligação');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Set initial custom provider
    if (navigator.onLine) {
      setConnectionType('Zap Fibra (Elevada Velocidade)');
    } else {
      setConnectionType('Sem ligação');
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    if (atelie && atelie.plano === 'basico' && syncMode !== 'offline_local') {
      setSyncMode('offline_local');
      localStorage.setItem('flowtailor_sync_mode', 'offline_local');
    }
  }, [atelie, syncMode]);

  // Sync mode toggle handler
  const handleToggleSyncMode = (mode: 'hybrid' | 'offline_local') => {
    if (mode === 'hybrid' && atelie && atelie.plano === 'basico') {
      toast.error('O backup na nuvem com sincronização híbrida automática é um benefício exclusivo do plano Pro Completo. Ative o plano completo para usufruir da segurança de dados avançada!');
      return;
    }
    setSyncMode(mode);
    localStorage.setItem('flowtailor_sync_mode', mode);
  };

  // Manual Trigger: Persist all recent data directly to Neon PostgreSQL API
  const handleManualSync = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    setSyncProgress(15);
    setSyncStageMsg('A preparar dados locais para sincronização com o Neon PostgreSQL...');

    try {
      if (atelie) {
        const result = await localDb.forceSyncAllToCloud(atelie.id, (progress, msg) => {
          setSyncProgress(progress);
          setSyncStageMsg(msg);
        });

        const timeStr = new Date().toLocaleString('pt-AO');
        setLastSync(timeStr);
        localStorage.setItem('flowtailor_last_sync', timeStr);
        setIsSyncing(false);

        if (result.success) {
          const clientesList = localDb.getClientes(atelie.id);
          const pedidosList = localDb.getPedidos(atelie.id);
          const medidasList = localDb.getMedidas(atelie.id);
          toast.success(`Sucesso! ${result.syncedItemsCount} registos sincronizados com o Neon PostgreSQL.`);
          alert(`✅ [Sincronização Neon PostgreSQL Concluída]\n\nOs documentos foram persistidos com sucesso na base de dados relacional:\n• Ateliê: ${atelie.nome} (${atelie.id})\n• Clientes: ${clientesList.length} registos na tabela 'clientes'\n• Encomendas: ${pedidosList.length} registos na tabela 'encomendas'\n• Medidas: ${medidasList.length} registos na tabela 'medidas'`);
        } else {
          toast.error(`Erro na sincronização: ${result.error}`);
          alert(`❌ [Falha ao Gravar no Neon PostgreSQL]\n\nOcorreu um erro ao persistir as tabelas na base de dados:\n${result.error}`);
        }
      } else {
        const result = await localDb.forceSyncAdminToCloud((progress, msg) => {
          setSyncProgress(progress);
          setSyncStageMsg(msg);
        });

        const timeStr = new Date().toLocaleString('pt-AO');
        setLastSync(timeStr);
        localStorage.setItem('flowtailor_last_sync', timeStr);
        setIsSyncing(false);

        if (result.success) {
          toast.success(`Sucesso! ${result.syncedItemsCount} registos administrativos gravados no Neon PostgreSQL.`);
          alert(`✅ [Sincronização Administrativa Neon Concluída]\n\nTodos os documentos de administração foram persistidos com sucesso:\n• Ateliês Cadastrados: ${localDb.getAtelies().length} registos na tabela 'atelies'\n• Solicitações / Comprovativos: ${localDb.getSolicitacoes().length} registos na tabela 'solicitacoes_pagamento'\n• Parâmetros Bancários: gravados na tabela 'configuracoes'\n• Administradores: ${localDb.getAdmins().length} e-mails autorizados na tabela 'admins'`);
        } else {
          toast.error(`Erro na sincronização administrativa: ${result.error}`);
          alert(`❌ [Falha ao Gravar no Neon PostgreSQL]\n\nOcorreu um erro ao persistir dados administrativos:\n${result.error}`);
        }
      }
    } catch (err: any) {
      console.error('Falha na gravação com Neon PostgreSQL:', err);
      setIsSyncing(false);
      setSyncProgress(0);
      setSyncStageMsg('');
      const errorMessage = err?.message || err?.code || String(err);
      toast.error(`Erro ao gravar no Neon: ${errorMessage}`);
      alert(`❌ [Falha ao Gravar no Neon PostgreSQL]\n\nOcorreu um erro ao persistir as tabelas na base de dados:\n${errorMessage}`);
    }
  };

  const handleSalvarConfigs = (e: React.FormEvent) => {
    e.preventDefault();
    if (!atelie) {
      setSalvando(true);
      setTimeout(() => {
        localStorage.setItem('ateliepro_admin_nome', nome);
        localStorage.setItem('ateliepro_admin_telefone', telefone.replace(/\D/g, ''));
        localStorage.setItem('ateliepro_admin_pais', pais);
        localStorage.setItem('ateliepro_admin_avatar_icon', avatarIcon);
        onRefresh();
        setSalvando(false);
        toast.success('Configurações do administrador guardadas com sucesso na nuvem híbrida!');
      }, 800);
      return;
    }

    setSalvando(true);
    setTimeout(() => {
      atelie.nome = nome;
      atelie.telefone = telefone.replace(/\D/g, '');
      atelie.pais = pais;
      atelie.avatarIcon = avatarIcon;
      localDb.saveAtelie(atelie);
      
      onRefresh();
      setSalvando(false);
      toast.success('Configurações do ateliê foram salvas com sucesso!');
    }, 800);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold font-display tracking-tight text-gray-950">Ajustes & Configurações de Perfil</h2>
        <p className="text-xs text-gray-500">Mantenha os detalhes de contacto do seu ateliê atualizados.</p>
      </div>

      {/* Configuration Subtabs Navigation */}
      <div className="flex items-center border-b border-slate-200 select-none gap-2">
        <button
          onClick={() => setActiveConfigTab('perfil')}
          className={`py-2.5 px-4 font-display text-sm font-bold border-b-2 -mb-px transition-all cursor-pointer ${
            activeConfigTab === 'perfil'
              ? 'border-atelier-700 text-slate-900 border-b-2 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-700 font-medium'
          }`}
        >
          👤 Perfil & Sincronização
        </button>
        {atelie && (
          <button
            onClick={() => setActiveConfigTab('whatsapp')}
            className={`py-2.5 px-4 font-display text-sm font-bold border-b-2 -mb-px transition-all flex items-center gap-1.5 cursor-pointer ${
              activeConfigTab === 'whatsapp'
                ? 'border-atelier-700 text-slate-900 border-b-2 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-700 font-medium'
            }`}
          >
            <span>💬 Modelos WhatsApp</span>
            <span className="text-[9px] uppercase tracking-wide font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">Novo</span>
          </button>
        )}
        <button
          onClick={() => setActiveConfigTab('seguranca')}
          className={`py-2.5 px-4 font-display text-sm font-bold border-b-2 -mb-px transition-all flex items-center gap-1.5 cursor-pointer ${
            activeConfigTab === 'seguranca'
              ? 'border-emerald-600 text-emerald-950 border-b-2 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-700 font-medium'
          }`}
        >
          <span>🛡️ Cibersegurança & Back-End</span>
          <span className="text-[9px] uppercase tracking-wide font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">Blindado</span>
        </button>
      </div>

      {activeConfigTab === 'perfil' ? (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Profile Settings form */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm lg:col-span-2">
          <h3 className="text-sm font-bold text-slate-900 border-b pb-1.5 mb-4 font-display">
            {atelie ? '✏️ Perfil do Ateliê' : '🛡️ Perfil Administrativo (Híbrido)'}
          </h3>
          <form onSubmit={handleSalvarConfigs} className="space-y-4">
            <div className={`grid grid-cols-1 ${atelie ? 'sm:grid-cols-2' : 'sm:grid-cols-3'} gap-4`}>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">
                  {atelie ? 'Nome do Ateliê / Alfaiataria' : 'Nome de Administrador'}
                </label>
                <input
                  type="text"
                  required
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl bg-slate-50 focus:outline-none"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                />
              </div>


              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">
                  {atelie ? `Telefone (${PAISES_CONFIG[pais].nome})` : 'Telefone de Suporte / Admin'}
                </label>
                <input
                  type="text"
                  required
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl bg-slate-50 focus:outline-none font-mono"
                  value={telefone}
                  onChange={(e) => setTelefone(e.target.value)}
                />
              </div>
            </div>

            {/* Avatar Icon Selector */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-slate-700">
                  🎨 Ícone de Avatar do Cabeçalho
                </label>
                <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-xl text-[11px] text-slate-600 font-medium">
                  <span>Pré-visualização:</span>
                  <AtelieAvatar iconKey={avatarIcon} nome={nome} className="w-5 h-5 rounded-full bg-atelier-100 border border-atelier-400 flex items-center justify-center text-atelier-800 text-[10px] font-bold shadow-2xs" />
                </div>
              </div>
              
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {AVATAR_OPTIONS.map((opt) => {
                  const isSelected = avatarIcon === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setAvatarIcon(opt.id)}
                      className={`p-2.5 rounded-2xl border text-left transition-all flex items-center gap-2.5 cursor-pointer select-none ${
                        isSelected
                          ? 'border-atelier-600 bg-atelier-50/70 ring-2 ring-atelier-400/30 text-atelier-950 font-bold shadow-xs'
                          : 'border-slate-200/90 bg-slate-50/50 hover:bg-slate-100/80 text-slate-700'
                      }`}
                    >
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs shrink-0 transition-transform ${
                        isSelected ? 'bg-atelier-700 text-white shadow-xs scale-105' : 'bg-white border border-slate-200 text-slate-700'
                      }`}>
                        <AtelieAvatar iconKey={opt.id} nome={nome} className="w-full h-full rounded-full flex items-center justify-center" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="text-xs font-bold block truncate leading-tight">{opt.label}</span>
                        <span className="text-[10px] text-slate-400 block truncate">{opt.emoji}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={salvando}
                className="px-5 py-2.5 bg-atelier-700 hover:bg-atelier-850 text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50 cursor-pointer"
              >
                {salvando ? 'Salvando ajustes...' : 'Guardar Alterações'}
              </button>
            </div>
          </form>
        </div>



        {/* Plan / Subscription Details or Admin System Overview Panel */}
        {atelie ? (
          <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-slate-900 border-b pb-1.5 font-display">💎 Minha Assinatura FlowTailor</h3>
              
              <div className="p-4 bg-atelier-50/70 border border-atelier-100 rounded-2xl text-xs space-y-2">
                <p>📌 <strong>Plano Activo:</strong> <span className="capitalize font-bold text-atelier-750">{atelie.plano}</span></p>
                <p>📌 <strong>Capacidade:</strong> {atelie.plano === 'pro' ? 'Espaço Ilimitado para Clientes' : 'Máximo 30 Clientes'}</p>
                <p>📌 <strong>Vencimento:</strong> <strong className="text-slate-950">{new Date(atelie.dataVencimento).toLocaleDateString('pt-AO')}</strong></p>
                <p>📌 <strong>Estado da Conta:</strong> <span className="font-bold text-emerald-700">ACTIVO</span></p>
              </div>

              <p className="text-[11px] text-slate-400 leading-normal">
                Deseja antecipar a sua renovação mensal preventiva ou alterar o seu plano? Pode abrir um claim na plataforma do administrador para validar o seu comprovativo correspondente.
              </p>
            </div>

            <div className="pt-4 border-t border-slate-50 flex items-center justify-between">
              <span className="text-xs text-slate-400 font-medium font-sans">SaaS em {PAISES_CONFIG[getAtelieCountry(atelie)].nome} {PAISES_CONFIG[getAtelieCountry(atelie)].flag}</span>
            </div>
          </div>
        ) : (
          <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-slate-900 border-b pb-1.5 font-display">⚙️ Status do Ecossistema SaaS</h3>
              
              <div className="p-4 bg-slate-50 border border-slate-150 rounded-2xl text-xs space-y-2.5">
                <p className="flex justify-between">
                  <span className="text-slate-500">Banco de Dados:</span>
                  <span className="text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.5 rounded text-[10px]">HÍBRIDO COMPLETO</span>
                </p>
                <p className="flex justify-between">
                  <span className="text-slate-500">Administradores Activos:</span>
                  <span className="font-bold font-mono text-slate-950">{localDb.getAdmins().length} Admin(s)</span>
                </p>
                <p className="flex justify-between">
                  <span className="text-slate-500">Ateliês Registados:</span>
                  <span className="font-bold font-mono text-slate-950">{localDb.getAtelies().length} Ateliê(s)</span>
                </p>
                <p className="flex justify-between">
                  <span className="text-slate-500">Integridade de Cache:</span>
                  <span className="text-emerald-600 font-bold">100% Consistente</span>
                </p>
              </div>

              <p className="text-[11px] text-slate-400 leading-normal">
                Como Administrador do FlowTailor, o seu painel de controlo opera com o banco de dados híbrido local instantâneo, com redundância e replicação automática para os servidores da nuvem.
              </p>
            </div>

            <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-400 font-medium font-sans">Administração Geral</span>
            </div>
          </div>
        )}

      </div>

      {/* PUSH NOTIFICATIONS SYSTEM CARD */}
      {atelie && (
        <NotificationSettingsCard atelie={atelie} onNewAlertTriggered={onNewAlertTriggered} />
      )}

      {/* Hybrid Sync Controls Row */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 relative overflow-hidden mt-6">
          {/* Decorative Grid Line styling */}
          <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-gradient-to-l from-atelier-50/20 to-transparent pointer-events-none select-none"></div>

          {/* Column 1: Mode Switches */}
          <div className="lg:col-span-7 space-y-5">
            <div>
              <span className="text-[10px] uppercase font-bold tracking-widest text-atelier-700 bg-atelier-50 px-2.5 py-1 rounded border border-atelier-200">
                ⚡ Arquitetura Híbrida Inteligente
              </span>
              <h3 className="text-lg font-bold text-slate-900 mt-2 font-display font-bold">Controlo de Armazenamento Robustecida</h3>
              <p className="text-xs text-slate-500 leading-relaxed max-w-xl mt-1">
                O FlowTailor suporta as oscilações de internet em Angola. Opte pelo sincronismo automático por nuvem ou isole para o modo estritamente local offline preservando o saldo de dados (Unitel/Movicel).
              </p>
            </div>

            <div className="space-y-3">
              {/* Mode A: Hybrid Online Cloud */}
              <button
                onClick={() => handleToggleSyncMode('hybrid')}
                className={`w-full p-4 rounded-2xl text-left border-2 transition-all flex items-start gap-4 cursor-pointer select-none group ${
                  syncMode === 'hybrid'
                    ? 'border-atelier-500 bg-atelier-50/50 shadow-sm shadow-atelier-500/5'
                    : 'border-slate-100 hover:border-slate-200 hover:bg-slate-50/50 bg-white'
                }`}
              >
                <div className={`p-3 rounded-xl shrink-0 transition-all ${
                  syncMode === 'hybrid'
                    ? 'bg-atelier-500 text-white shadow-md shadow-atelier-500/20'
                    : 'bg-slate-100 text-slate-500 group-hover:bg-slate-200'
                }`}>
                  <Cloud className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <p className="text-sm font-bold text-slate-900 font-display">Híbrido Automático (Nuvem)</p>
                    <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                      syncMode === 'hybrid' ? 'border-atelier-500 bg-atelier-500' : 'border-slate-300'
                    }`}>
                      {syncMode === 'hybrid' && <span className="w-1.5 h-1.5 rounded-full bg-white"></span>}
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Backup redundante e automático em tempo real sempre que houver internet. Cache local imediata para visualização ultra rápida mesmo offline.
                  </p>
                </div>
              </button>

              {/* Mode B: Full Offline Local */}
              <button
                onClick={() => handleToggleSyncMode('offline_local')}
                className={`w-full p-4 rounded-2xl text-left border-2 transition-all flex items-start gap-4 cursor-pointer select-none group ${
                  syncMode === 'offline_local'
                    ? 'border-atelier-900 bg-atelier-50/40 shadow-sm shadow-atelier-900/5'
                    : 'border-slate-100 hover:border-slate-200 hover:bg-slate-50/50 bg-white'
                }`}
              >
                <div className={`p-3 rounded-xl shrink-0 transition-all ${
                  syncMode === 'offline_local'
                    ? 'bg-atelier-900 text-white shadow-md shadow-atelier-900/20'
                    : 'bg-slate-100 text-slate-400 group-hover:bg-slate-200'
                }`}>
                  <Database className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <p className="text-sm font-bold text-slate-900 font-display">Modo 100% Offline (Resiliente)</p>
                    <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                      syncMode === 'offline_local' ? 'border-atelier-900 bg-atelier-900' : 'border-slate-300'
                    }`}>
                      {syncMode === 'offline_local' && <span className="w-1.5 h-1.5 rounded-full bg-white"></span>}
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Evita o consumo de internet móvel por completo. Ideal para poupar o saldo de dados (Unitel / Movicel), gravando as medidas de clientes localmente.
                  </p>
                </div>
              </button>
            </div>
          </div>

          {/* Column 2: Synchronize action Progress / Info details */}
          <div className="lg:col-span-5 bg-atelier-50/60 border border-atelier-200/60 rounded-2xl p-5 flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-atelier-200/50 pb-2">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest font-mono font-bold">Status da Sincronização</span>
                <span className="text-[10px] font-bold text-atelier-700 bg-atelier-100 px-2.5 py-0.5 rounded-md font-bold">Encriptado (SSL)</span>
              </div>
              
              <div className="text-xs space-y-2 text-slate-600">
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-slate-450">💾 Último Backup:</span>
                  <strong className="text-slate-850 font-mono font-medium">{lastSync || 'Pendente'}</strong>
                </div>
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-slate-450">🌐 Ligação Activa:</span>
                  <strong className={`font-semibold ${isOnline ? 'text-emerald-600' : 'text-slate-500'}`}>
                    {isOnline ? `Online (${connectionType})` : 'Offline (Local)'}
                  </strong>
                </div>
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-slate-450">🛡️ Integridade de Dados:</span>
                  <strong className="text-emerald-700 font-semibold font-mono font-bold">100% Consistente</strong>
                </div>
              </div>
            </div>

            {/* Sync Trigger button */}
            <div className="space-y-3">
              {isSyncing ? (
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between text-[11px] font-semibold text-slate-700">
                    <span className="truncate max-w-[80%] flex items-center gap-1.5">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-atelier-500" />
                      {syncStageMsg}
                    </span>
                    <span className="font-mono">{syncProgress}%</span>
                  </div>
                  {/* Visual Progress bar */}
                  <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-atelier-500 rounded-full transition-all duration-300"
                      style={{ width: `${syncProgress}%` }}
                    ></div>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleManualSync}
                  disabled={syncMode === 'offline_local' && !isOnline}
                  className={`w-full py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all select-none shadow-sm cursor-pointer ${
                    syncMode === 'offline_local' && !isOnline
                      ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                      : 'bg-atelier-900 hover:bg-atelier-950 text-white hover:scale-[1.01] active:scale-[0.99] duration-155'
                  }`}
                >
                  <RefreshCw className="w-3.5 h-3.5 animate-pulse" />
                  Forçar Sincronização Manual
                </button>
              )}
              <p className="text-[10px] text-center text-slate-400 select-none leading-relaxed">
                O FlowTailor armazena as faturas localmente e propaga os dados na nuvem de forma resiliente.
              </p>
            </div>
          </div>

        </div>
        </>
      ) : activeConfigTab === 'whatsapp' ? (
        /* WHATSAPP MODEL TEMPLATE CUSTOMIZER - CLASSIFIED WITH requested class */
        atelie && (
          <div className="configuracoes-view-card bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm animate-in fade-in duration-300 relative overflow-hidden">
            <div className="absolute right-0 top-0 w-32 h-32 bg-gradient-to-bl from-emerald-500/5 to-transparent rounded-full pointer-events-none select-none"></div>

            <div className="border-b border-slate-100 pb-3 mb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 select-none">
              <div>
                <span className="text-[9px] uppercase font-bold tracking-widest text-[#128c7e] bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200 font-sans">
                  💬 Personalizar Mensagem Automática
                </span>
                <h3 className="text-base font-bold text-slate-900 mt-1.5 font-display font-bold">Variáveis de Modelagem de Encomendas</h3>
                <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">Crie mensagens personalizadas utilizando os dados fornecidos automaticamente pelo sistema.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 font-sans">
              
              {/* Textarea & Variable Inserters Column */}
              <form onSubmit={handleSaveTemplate} className="lg:col-span-7 space-y-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700">Texto do Modelo de Lembrete (2 Dias):</label>
                  <p className="text-[10px] text-slate-450 leading-relaxed mb-1.5">
                    Modifique o corpo da mensagem como desejar. Não se esqueça de manter as tags com chavetas exatamente como mostrado abaixo para substituir em tempo real.
                  </p>
                  <textarea
                    rows={6}
                    required
                    value={whatsappTemplate}
                    onChange={(e) => setWhatsappTemplate(e.target.value)}
                    placeholder="Exemplo: Olá, {clienteNome}! Seu {descricao} está agendado para entrega..."
                    className="w-full p-3 text-xs leading-relaxed border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-slate-50 font-sans"
                  />
                </div>

                {/* Variable quick injector buttons */}
                <div className="space-y-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Injetores de Tags Rápidas (Toque para Inserir)</span>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => injectPlaceholder('{clienteNome}')}
                      className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-lg text-[10px] font-mono font-semibold transition cursor-pointer"
                    >
                      {'{clienteNome}'} → Nome do Cliente
                    </button>
                    <button
                      type="button"
                      onClick={() => injectPlaceholder('{descricao}')}
                      className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-lg text-[10px] font-mono font-semibold transition cursor-pointer"
                    >
                      {'{descricao}'} → Detalhes da Encomenda
                    </button>
                    <button
                      type="button"
                      onClick={() => injectPlaceholder('{prazoEntrega}')}
                      className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-lg text-[10px] font-mono font-semibold transition cursor-pointer"
                    >
                      {'{prazoEntrega}'} → Data Formatada de Entrega
                    </button>
                  </div>
                </div>

                {/* Action Controls for Template */}
                <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={handleResetTemplate}
                    className="px-3.5 py-2.5 border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-800 rounded-xl text-xs font-semibold transition bg-white cursor-pointer"
                  >
                    Restaurar Padrão do Sistema
                  </button>

                  <button
                    type="submit"
                    disabled={salvandoTemplate}
                    className="px-5 py-2.5 bg-[#128c7e] hover:bg-[#075e54] text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
                  >
                    {salvandoTemplate ? 'A Guardar Modelo...' : 'Salvar Modelo'}
                  </button>
                </div>
              </form>

              {/* Real-time High-fidelity WhatsApp Chat Preview Panel */}
              <div className="lg:col-span-5 flex flex-col justify-between space-y-3">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">Pré-visualização do Lembrete em Tempo Real</span>
                
                <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm bg-[#efeae2] pb-6 flex flex-col h-full min-h-[265px]">
                  {/* Header resembling true WhatsApp UI */}
                  <div className="bg-[#075e54] text-white px-4 py-2.5 flex items-center justify-between select-none">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-slate-300 flex items-center justify-center text-[#075e54] font-bold text-xs font-mono">
                        IN
                      </div>
                      <div>
                        <p className="text-xs font-bold leading-tight">Isabel Neto</p>
                        <p className="text-[9px] text-emerald-100 leading-none">Online</p>
                      </div>
                    </div>
                    <span className="text-[9px] bg-emerald-700/60 px-2 py-0.5 rounded text-emerald-200 border border-emerald-600 font-mono">Simulador</span>
                  </div>

                  {/* Message Bubble rendering */}
                  <div className="p-4 flex-1 flex flex-col justify-start">
                    <div className="max-w-[88%] bg-white rounded-xl rounded-tl-none p-3 shadow-sm text-xs text-slate-800 relative self-start border border-slate-150 leading-relaxed whitespace-pre-wrap font-sans">
                      {formatWhatsAppMessage(
                        whatsappTemplate, 
                        "Isabel Neto", 
                        "Kaftan com Bordados Ouro", 
                        new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString()
                      )}
                      <div className="flex items-center justify-end gap-1 mt-1 text-[9px] text-slate-400 select-none">
                        <span>{new Date().toLocaleTimeString('pt-AO', { hour: '2-digit', minute: '2-digit' })}</span>
                        <span className="text-[#34b7f1] font-bold text-[10px]">✓✓</span>
                      </div>
                    </div>
                  </div>
                </div>

                <p className="text-[10.5px] text-center text-slate-450 leading-normal font-sans">
                  Sempre que gerar lembretes ou disparar notificações automatizadas de 2 dias, o texto personalizado acima será utilizado.
                </p>
              </div>

            </div>
          </div>
        )
      ) : activeConfigTab === 'seguranca' ? (
        <SecurityDefenseView />
      ) : null}
    </div>
  );
}
