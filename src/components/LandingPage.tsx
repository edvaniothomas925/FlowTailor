import React, { useState } from 'react';
import { 
  Scissors, 
  Sparkles, 
  Check, 
  Zap, 
  Smartphone, 
  ShieldCheck, 
  MessageSquare, 
  MessageCircle,
  Clock, 
  Users, 
  TrendingUp, 
  ArrowRight,
  Database,
  Award,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Gift,
  Ruler,
  Calendar,
  Wallet,
  Star,
  CheckCircle2
} from 'lucide-react';
import { PAISES_CONFIG, formatarMoedaSimples } from '../lib/localization';

interface LandingPageProps {
  onStartTrial: (country: 'AO' | 'PT' | 'BR') => void;
  onLogin: () => void;
}

const LANDING_TEXTS = {
  AO: {
    countryLabel: "Angola",
    badgeLabel: "Oferta de Lançamento em Angola",
    headline: "Organize o seu Ateliê. Corte sem Complicações.",
    subTitle: "O primeiro software de gestão feito sob medida para costureiras, alfaiates e designers de moda em Angola. Controle medidas, encomendas, prazos importantes e faturamento em Kwanzas sem perder folhas ou estressar.",
    mrrLabel: "MRR Activo",
    mrrValue: "140.000 Kz",
    todayLabel: "0 Kz Hoje",
    priceBasic: "5.000 Kz",
    pricePro: "9.000 Kz",
    networkTitle: "Trabalhe Sem Net (Resiliência Angola)",
    networkDesc: "Sabemos como é a internet móvel. Todas as modificações, medidas e registos novos ficam guardados localmente e sincronizam perfeitamente quando estiver ligado sem conflitos!",
    financeDesc: "Gestão simplificada de recebimentos e pagamentos (Sinal de 50%, Preço Total, Gastos de Tecido e Linhas). Acompanhe o lucro real que entra no ateliê em Kz.",
    testimonialsTitle: "Aprovado por Costureiras e Alfaiates em Angola",
    testimonialsDesc: "O que dizem os nossos parceiros que já usam no dia a dia do seu negócio",
    testimonials: [
      {
        stars: 5,
        text: '"Antes do FlowTailor, era comum eu perder papéis com medidas de clientes em cima da mesa de corte ou falhar a data de entrega dos trajes de noivado. Agora está tudo no telemóvel dos alfaiates! Uma benção para a nossa alfaiataria em Luanda."',
        author: "Sr. Manuel C.",
        role: "Alfaiataria Premium · Maianga, Luanda"
      },
      {
        stars: 5,
        text: '"Uso até mesmo no Cazenga quando o sinal da Unitel está péssimo! Salva tudo offline e depois de noite, quando chego a casa com bom Wi-Fi, sincroniza no servidor. Os meus clientes adoram receber o lembrete de prova profissional no WhatsApp."',
        author: "Dona Rosa Ramos",
        role: "Ateliê Rosa de Ouro · Cazenga"
      }
    ],
    faqAnswer2: "Sim! O FlowTailor foi desenhado especificamente pensando nos desafios de ligação em Angola. Todas as suas fichas de medidas e novos pedidos podem ser inseridos sem internet; assim que o dispositivo restabelecer o sinal de rede, eles são sincronizados de forma segura e automática com a nuvem.",
    faqAnswer3: "Aceitamos transferências bancárias, depósitos ou pagamentos via Multicaixa / Express. No próprio menu de configurações do seu ateliê, pode anexar de forma descomplicada a imagem do comprovativo e a nossa equipa valida a ativação, concedendo 30 dias adicionais de vigência.",
    faqDesc: "Esclareça as suas principais dúvidas sobre o funcionamento do FlowTailor para o seu negócio de costura em Angola.",
    footerText1: "© 2026 FlowTailor Angola. Suporte e Tecnologia para Alfaiates e Costureiras.",
    footerText2: "Feito de forma resiliente contra falhas de rede. 🇦🇴"
  },
  BR: {
    countryLabel: "Brasil",
    badgeLabel: "Feito para costureiras no Brasil",
    headline: "Organize o seu Ateliê de Costura no Brasil 🇧🇷",
    subTitle: "O primeiro software de gestão feito sob medida para costureiras, alfaiates e estilistas no Brasil. Controle medidas, encomendas, prazos importantes e faturamento em Reais sem perder folhas ou se estressar.",
    mrrLabel: "Faturamento Fixo (MRR)",
    mrrValue: "R$ 4.900",
    todayLabel: "R$ 0 Hoje",
    priceBasic: "R$ 29",
    pricePro: "R$ 49",
    networkTitle: "Trabalhe Sem Internet (Resiliência Offline)",
    networkDesc: "Sabemos como a conexão oscila em algumas regiões. Todas as modificações, medidas e novos registros ficam guardados localmente e sincronizam perfeitamente quando restabelecer o sinal!",
    financeDesc: "Gestão simplificada de recebimentos e pagamentos (Sinal de 50%, Preço Total, Gastos de Tecido e Linhas). Acompanhe o lucro real que entra no ateliê em R$.",
    testimonialsTitle: "Aprovado por Costureiras e Alfaiates no Brasil",
    testimonialsDesc: "O que dizem os nossos parceiros que já usam no dia a dia do seu negócio",
    testimonials: [
      {
        stars: 5,
        text: '"Antes do FlowTailor, era comum eu perder papéis com medidas de clientes em cima da mesa de corte ou falhar a data de entrega dos vestidos. Agora está tudo no celular das costureiras! Uma bênção para o nosso ateliê em São Paulo."',
        author: "Mariana S.",
        role: "Costureira Criativa · Pinheiros, São Paulo"
      },
      {
        stars: 5,
        text: '"Uso até mesmo na minha confecção onde o sinal de celular às vezes cai. Salva tudo offline e depois de noite, quando chego em casa com bom Wi-Fi, sincroniza no servidor. Minhas clientes adoram receber o lembrete de prova profissional no WhatsApp."',
        author: "Dona Sandra M.",
        role: "Ateliê Fio de Ouro · Madureira, Rio de Janeiro"
      }
    ],
    faqAnswer2: "Sim! O FlowTailor foi desenhado especificamente pensando nos desafios de conexão no Brasil. Todas as suas fichas de medidas e novos pedidos podem ser inseridos e consultados sem internet; assim que o dispositivo restabelecer o sinal, eles são sincronizados de forma segura com o servidor cloud.",
    faqAnswer3: "Aceitamos pagamentos via chave PIX de forma rápida e segura. No próprio menu de configurações do seu ateliê, pode anexar de forma descomplicada a imagem do comprovativo e a nossa equipa valida a ativação, concedendo 30 dias adicionais de vigência.",
    faqDesc: "Esclareça as suas principais dúvidas sobre o funcionamento do FlowTailor para o seu negócio de costura no Brasil.",
    footerText1: "© 2026 FlowTailor Brasil. Suporte e Tecnologia para Alfaiates e Costureiras.",
    footerText2: "Feito de forma resiliente contra falhas de rede. 🇧🇷"
  },
  PT: {
    countryLabel: "Portugal",
    badgeLabel: "Feito para costureiras em Portugal",
    headline: "Organize o seu Atelier de Costura em Portugal 🇵🇹",
    subTitle: "O primeiro software de gestão feito sob medida para costureiras, alfaiates e designers de moda em Portugal. Controle medidas, encomendas, prazos importantes e faturação em Euros sem perder folhas ou se estressar.",
    mrrLabel: "Faturação Fixa (MRR)",
    mrrValue: "1.250 €",
    todayLabel: "0 € Hoje",
    priceBasic: "9 €",
    pricePro: "15 €",
    networkTitle: "Trabalhe Sem Net (Resiliência Offline)",
    networkDesc: "A internet móvel pode falhar. Todas as modificações, medidas e novos registos ficam guardados localmente e sincronizam perfeitamente de forma automática assim que tiver uma ligação de rede estável!",
    financeDesc: "Gestão simplificada de recebimentos e pagamentos (Sinal de 50%, Preço Total, Gastos de Tecido e Linhas). Acompanhe o lucro real que entra no atelier em €.",
    testimonialsTitle: "Aprovado por Costureiras e Alfaiates em Portugal",
    testimonialsDesc: "O que dizem os nossos parceiros que já usam no dia a dia do seu negócio",
    testimonials: [
      {
        stars: 5,
        text: '"Antes do FlowTailor, era frequente eu perder papéis com medidas de clientes em cima da mesa de corte ou falhar a data de entrega dos vestidos. Agora está tudo no telemóvel das costureiras! Uma ajuda fantástica para o nosso ateliê de costura no Porto."',
        author: "Inês C.",
        role: "Atelier de Alta Costura · Porto"
      },
      {
        stars: 5,
        text: '"Uso no meu atelier mesmo quando a rede móvel falha. Guarda tudo em modo offline e depois sincroniza perfeitamente com o servidor quando tenho rede estável. As minhas clientes adoram receber o lembrete de prova personalizado por WhatsApp."',
        author: "Dona Maria Silva",
        role: "Costura & Arte · Braga"
      }
    ],
    faqAnswer2: "Sim! O FlowTailor foi desenhado especificamente pensando nos desafios de rede e conectividade em Portugal. Todas as suas fichas de medidas e novos pedidos podem ser inseridos mesmo sem ligação à Internet; assim que o dispositivo restabelecer o sinal de rede, tudo é sincronizado.",
    faqAnswer3: "Aceitamos transferências bancárias, MB Way ou cartões. No próprio menu de configurações do seu ateliê, pode anexar de forma descomplicada a imagem do comprovativo de pagamento e a nossa equipa valida a ativação rápida por mais 30 dias.",
    faqDesc: "Esclareça as suas principais dúvidas sobre o funcionamento do FlowTailor para o seu negócio de costura em Portugal.",
    footerText1: "© 2026 FlowTailor Portugal. Suporte e Tecnologia para Alfaiates e Costureiras.",
    footerText2: "Feito de forma resiliente contra falhas de rede. 🇵🇹"
  }
};

export default function LandingPage({ onStartTrial, onLogin }: LandingPageProps) {
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const pais = 'AO';
  const texts = LANDING_TEXTS[pais];

  const faqItems = [
    {
      question: "Como funciona o teste grátis de 7 dias?",
      answer: "Ao criar a sua conta, ganha acesso imediato e irrestrito a todas as funcionalidades do FlowTailor por uma de cortesia de 1 semana. Não precisa introduzir dados de pagamento ou comprovativos para começar a usufruir de todas as vantagens do sistema."
    },
    {
      question: "Consigo usar o sistema mesmo sem internet (offline)?",
      answer: texts.faqAnswer2
    },
    {
      question: "Como é realizado o pagamento do plano após o teste?",
      answer: texts.faqAnswer3
    },
    {
      question: "As medidas e dados das minhas clientes estão seguros?",
      answer: "Totalmente. O FlowTailor encripta todos os backups automáticos das fichas de medidas e faturamento no Neon PostgreSQL (nuvem encriptada). Cada ateliê possui isolamento completo e seguro de banco de dados, garantindo privacidade máxima."
    },
    {
      question: "O FlowTailor funciona como um aplicativo no meu telemóvel?",
      answer: "Sim! Por ser um PWA (Progressive Web App) moderno, pode adicioná-lo diretamente ao ecrã principal do seu telefone Android ou iPhone com 2 cliques pelo navegador, funcionando como um app de alta eficiência sem ocupar espaço na memória."
    }
  ];

  return (
    <div id="landing-container" className="min-h-screen bg-atelier-50/50 text-slate-800 selection:bg-atelier-100 selection:text-atelier-900 scroll-smooth">
      {/* Dynamic Header Navbar */}
      <header id="landing-header" className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-atelier-200/80 px-4 sm:px-6 lg:px-8 py-3.5 select-none transition-all">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-atelier-600 text-white rounded-2xl shadow-sm rotate-45">
              <Scissors className="w-5 h-5" />
            </div>
            <span className="font-display font-extrabold text-xl text-atelier-950 tracking-tight flex items-center gap-1">
              FlowTailor
              <Sparkles className="w-3.5 h-3.5 text-atelier-500 fill-atelier-300" />
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onLogin}
              className="px-4 py-2 text-xs font-bold text-slate-650 hover:text-slate-900 hover:bg-slate-50 transition-colors rounded-xl cursor-pointer"
            >
              Entrar
            </button>
            <button
              onClick={() => onStartTrial(pais)}
              className="px-4.5 py-2.5 bg-atelier-600 hover:bg-atelier-700 text-white text-xs font-bold rounded-xl shadow-md shadow-atelier-600/15 transition-all hover:scale-[1.02] active:scale-95 cursor-pointer flex items-center gap-1.5"
            >
              <Gift className="w-4 h-4 text-amber-200" />
              <span>1 Semana Grátis</span>
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section id="landing-hero" className="relative pt-12 pb-20 px-4 sm:px-6 lg:px-8 overflow-hidden">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-atelier-100/40 rounded-full filter blur-3xl -z-10 animate-pulse duration-[10s]"></div>
        <div className="absolute bottom-10 right-1/4 w-80 h-80 bg-atelier-200/20 rounded-full filter blur-2xl -z-10"></div>

        <div className="max-w-5xl mx-auto text-center space-y-8">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-atelier-100/85 text-atelier-800 text-[11px] font-bold uppercase tracking-wider rounded-full border border-atelier-200/60 shadow-xs animate-bounce">
            <Award className="w-3.5 h-3.5 text-atelier-600" />
            <span>{texts.badgeLabel}</span>
          </div>

          {/* Headline */}
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-display font-black text-atelier-950 tracking-tight leading-[1.08] max-w-4xl mx-auto">
            {texts.headline}
          </h1>

          {/* Subtitle */}
          <p className="text-sm sm:text-base text-slate-550 max-w-2xl mx-auto leading-relaxed">
            {texts.subTitle}
          </p>

          {/* Trust Value Pitch Callout */}
          <div className="p-3.5 sm:p-4 bg-white/90 max-w-lg mx-auto rounded-3xl border border-atelier-200 shadow-sm flex items-center justify-between gap-3 text-left">
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600 shadow-xs shrink-0">
                <Gift className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-900">Teste sem riscos por 7 Dias!</p>
                <p className="text-[10px] text-slate-500">Acesso completo com sincronismo ilimitado.</p>
              </div>
            </div>
            <span className="text-[10px] font-black uppercase text-atelier-700 bg-atelier-100 px-2.5 py-1 rounded-xl shrink-0">
              {texts.todayLabel}
            </span>
          </div>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 select-none">
            <button
              onClick={() => onStartTrial(pais)}
              className="w-full sm:w-auto px-8 py-4 bg-atelier-600 hover:bg-atelier-700 text-white font-bold text-sm rounded-2xl shadow-xl shadow-atelier-600/20 hover:shadow-atelier-600/30 transition-all hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
            >
              Criar Conta e Testar Grátis <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={onLogin}
              className="w-full sm:w-auto px-6 py-4 bg-white border border-slate-200 hover:border-slate-350 text-slate-800 text-sm font-bold rounded-2xl transition-all shadow-xs hover:bg-slate-50 flex items-center justify-center gap-2 cursor-pointer"
            >
              Já tenho Registado
            </button>
          </div>

          {/* Device Frame layout mock preview */}
          <div className="mt-14 max-w-3xl mx-auto bg-white rounded-3xl border border-atelier-200/90 shadow-2xl overflow-hidden text-left relative transition-all hover:border-slate-300">
            <div className="bg-slate-900 px-5 py-3.5 flex items-center justify-between border-b border-white/5">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-rose-500"></span>
                <span className="w-3 h-3 rounded-full bg-amber-500"></span>
                <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
                <span className="text-[11px] text-slate-400 font-mono ml-2">painel.flowtailor.ao</span>
              </div>
              <span className="text-[10px] text-emerald-400 font-mono flex items-center gap-1 bg-emerald-900/35 px-2 py-0.5 rounded-full">
                <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-ping"></div>
                Ateliê Ativo
              </span>
            </div>

            <div className="p-5 sm:p-6 bg-slate-50/70 space-y-5">
              {/* Stat Rows mockup */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div className="bg-white p-3.5 rounded-2xl border border-slate-150/80 shadow-xs">
                  <p className="text-[10px] text-slate-405 font-medium uppercase tracking-wider">{texts.mrrLabel}</p>
                  <p className="text-base font-black text-slate-850 font-display">{texts.mrrValue}</p>
                </div>
                <div className="bg-white p-3.5 rounded-2xl border border-slate-150/80 shadow-xs">
                  <p className="text-[10px] text-slate-405 font-medium uppercase tracking-wider">Pedidos a Decorrer</p>
                  <p className="text-base font-black text-slate-850 font-display">12 Vestidos</p>
                </div>
                <div className="bg-white p-3.5 rounded-2xl border border-slate-150/80 shadow-xs col-span-2 md:col-span-1">
                  <p className="text-[10px] text-slate-405 font-medium uppercase tracking-wider">Fidelização Clientes</p>
                  <p className="text-base font-black text-emerald-600 font-display">98.5% Satisfeito</p>
                </div>
              </div>

              {/* Order progress item row */}
              <div className="bg-white p-4 rounded-2xl border border-slate-150 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900">Rosa Ramos</span>
                    <span className="bg-indigo-50 text-indigo-700 text-[10px] font-bold px-1.5 py-0.5 rounded">Vestido de Gala</span>
                  </div>
                  <p className="text-slate-500 text-[11px]">Medidas: Busto: <strong className="text-slate-800">92cm</strong> · Cintura: <strong className="text-slate-800">74cm</strong> · Ombros: <strong className="text-slate-800">41cm</strong></p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-amber-600 font-bold bg-amber-50 px-2 py-1 rounded text-[10px]">⚠️ Falta 3 dias</span>
                  <button className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold border border-emerald-150 rounded-lg text-[10px] flex items-center gap-1 cursor-default">
                    💬 Enviar Cobrança
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Value Propositions - Bento Grid Section */}
      <section id="landing-features" className="py-20 bg-white border-y border-atelier-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="text-center space-y-3 max-w-2xl mx-auto">
            <h2 className="text-2xl sm:text-3xl font-display font-black text-atelier-950 tracking-tight">
              Tudo o que precisa para gerir o seu Ateliê num único software
            </h2>
            <p className="text-xs sm:text-sm text-slate-500">
              Desenhado para ser simples, visual e rápido. Feito sob medida para faturar mais e controlar o fluxo das costuras.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Medidas de Clientes */}
            <div className="p-6 bg-slate-50/75 rounded-3xl border border-slate-200/80 space-y-4 hover:border-atelier-200 transition-all group">
              <div className="w-10 h-10 rounded-2xl bg-atelier-100 text-atelier-700 flex items-center justify-center shadow-xs">
                <Ruler className="w-5 h-5 text-atelier-700" />
              </div>
              <h3 className="font-display font-bold text-slate-900 group-hover:text-atelier-900 transition-colors">
                Histórico & Fichas de Medidas
              </h3>
              <p className="text-xs text-slate-550 leading-relaxed">
                Guarde todas as medidas corporais detalhadamente (Busto, Cintura, Anca, Costas, Mangas, etc.) de forma organizada. Nunca mais re-meça os clientes fiéis por falta de notas!
              </p>
            </div>

            {/* Controlo de Prazos */}
            <div className="p-6 bg-slate-50/75 rounded-3xl border border-slate-200/80 space-y-4 hover:border-atelier-200 transition-all group">
              <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center shadow-xs">
                <Calendar className="w-5 h-5 text-amber-700" />
              </div>
              <h3 className="font-display font-bold text-slate-900 group-hover:text-amber-800 transition-colors">
                Controlo Inteligente de Prazos
              </h3>
              <p className="text-xs text-slate-550 leading-relaxed">
                Alertas visuais baseados na proximidade de prazos das suas roupas e encomendas. No painel inicial do FlowTailor, sabe exactamente o que se deve costurar hoje.
              </p>
            </div>

            {/* Notificações WhatsApp */}
            <div className="p-6 bg-slate-50/75 rounded-3xl border border-slate-200/80 space-y-4 hover:border-atelier-200 transition-all group">
              <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center shadow-xs">
                <MessageCircle className="w-5 h-5 text-emerald-700" />
              </div>
              <h3 className="font-display font-bold text-slate-900 group-hover:text-emerald-800 transition-colors">
                Integração Direta com WhatsApp
              </h3>
              <p className="text-xs text-slate-550 leading-relaxed">
                Esqueça reescrever cobranças cansativas. Clique num botão para gerar o aviso polido pronto para envio com o resumo de encomendas e detalhes ao cliente do seu ateliê.
              </p>
            </div>

            {/* Caixa Híbrido Offline */}
            <div className="p-6 bg-slate-50/75 rounded-3xl border border-slate-200/80 space-y-4 hover:border-atelier-200 transition-all group">
              <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-700 flex items-center justify-center shadow-xs">
                <Database className="w-5 h-5 text-indigo-700" />
              </div>
              <h3 className="font-display font-bold text-slate-900 group-hover:text-indigo-800 transition-colors">
                {texts.networkTitle}
              </h3>
              <p className="text-xs text-slate-550 leading-relaxed">
                {texts.networkDesc}
              </p>
            </div>

            {/* Faturamento */}
            <div className="p-6 bg-slate-50/75 rounded-3xl border border-slate-200/80 space-y-4 hover:border-atelier-200 transition-all group">
              <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center shadow-xs">
                <Wallet className="w-5 h-5 text-amber-700" />
              </div>
              <h3 className="font-display font-bold text-slate-900 group-hover:text-amber-800 transition-colors">
                Finanças e Custos de Matéria
              </h3>
              <p className="text-xs text-slate-550 leading-relaxed">
                {texts.financeDesc}
              </p>
            </div>

            {/* PWA ready */}
            <div className="p-6 bg-slate-50/75 rounded-3xl border border-slate-200/80 space-y-4 hover:border-atelier-200 transition-all group">
              <div className="w-10 h-10 rounded-2xl bg-purple-50 text-purple-750 flex items-center justify-center shadow-xs">
                <Smartphone className="w-5 h-5 text-purple-700" />
              </div>
              <h3 className="font-display font-bold text-slate-900 group-hover:text-purple-800 transition-colors">
                Instalação PWA Rápida
              </h3>
              <p className="text-xs text-slate-550 leading-relaxed">
                Adicione ao ecrã do seu smartphone Android ou iOS com apenas 2 cliques. Funciona tal como uma app normal da Play Store / App Store, poupando espaço de memória.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section id="landing-testimonials" className="py-20 bg-atelier-50/30">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-display font-black text-slate-900">
              {texts.testimonialsTitle}
            </h2>
            <p className="text-xs text-slate-500">{texts.testimonialsDesc}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {texts.testimonials.map((test, i) => (
              <div key={i} className="p-6 bg-white rounded-3xl border border-atelier-200/70 shadow-sm space-y-3.5">
                <div className="flex items-center gap-1 text-amber-400">
                  {Array.from({ length: test.stars }).map((_, idx) => (
                    <Star key={idx} className="w-4 h-4 fill-amber-400 text-amber-400" />
                  ))}
                </div>
                <p className="text-xs text-slate-650 italic leading-relaxed">
                  {test.text}
                </p>
                <div>
                  <p className="text-xs font-bold text-slate-900">{test.author}</p>
                  <p className="text-[10px] text-slate-500">{test.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Table with 7-Days Trial prominence */}
      <section id="landing-pricing" className="py-20 bg-white border-t border-atelier-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="text-center space-y-3 max-w-2xl mx-auto">
            <h2 className="text-2xl sm:text-3xl font-display font-black text-atelier-950 tracking-tight">
              Preços Transparentes Sem Surpresas
            </h2>
            <p className="text-xs sm:text-sm text-slate-550">
              Todos os planos incluem <strong className="text-atelier-700 font-bold">1 SEMANA GRÁTIS</strong> de avaliação. Ative a sua conta e se não gostar, não ative o plano - simples e livre de riscos.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-3xl mx-auto select-none">
            {/* Plano Básico */}
            <div className="p-8 bg-slate-50 rounded-3xl border border-slate-200 flex flex-col justify-between space-y-6 relative hover:shadow-lg transition-all">
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-[11px] uppercase font-mono tracking-wider text-slate-500 font-bold">Ateliê Básico</span>
                  <span className="text-[10px] px-2 py-0.5 bg-slate-200 text-slate-800 rounded-md font-bold font-sans">Económico</span>
                </div>
                <div className="space-y-1">
                  <p className="text-3xl font-black text-slate-900 font-display">
                    {texts.priceBasic}
                    <span className="text-xs text-slate-500 font-normal"> /mês</span>
                  </p>
                  <p className="text-[11.5px] text-emerald-600 font-semibold flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    Comece hoje com 7 Dias Grátis
                  </p>
                </div>
                <p className="text-xs text-slate-500">Ideal para costureiras individuais ou pequenos estúdios em casa.</p>
                
                <ul className="space-y-2.5 pt-2 text-xs text-slate-650">
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-atelier-600 shrink-0" />
                    <span>Fichas de Medidas Ilimitadas</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-atelier-600 shrink-0" />
                    <span>Controlo de Encomendas Activas</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-atelier-600 shrink-0" />
                    <span>Resiliência Híbrida Offline</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-atelier-600 shrink-0" />
                    <span>Dispositivo Único</span>
                  </li>
                </ul>
              </div>

              <button
                onClick={() => onStartTrial(pais)}
                className="w-full py-3 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl transition-all hover:scale-[1.01] cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Gift className="w-3.5 h-3.5 text-amber-300" />
                Avaliar 1 Semana Grátis
              </button>
            </div>

            {/* Plano Pro Premium */}
            <div className="p-8 bg-gradient-to-b from-atelier-50/80 to-white rounded-3xl border-2 border-atelier-600 flex flex-col justify-between space-y-6 relative hover:shadow-xl transition-all ring-4 ring-atelier-100">
              <div className="absolute -top-3.5 left-6 bg-gradient-to-r from-atelier-800 to-atelier-600 text-white text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-full shadow-md flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-amber-300" /> RECOMENDADO
              </div>
              
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-[11px] uppercase font-mono tracking-wider text-atelier-800 font-bold">Pro Multi-Ateliê</span>
                  <span className="text-[10px] px-2 py-0.5 bg-atelier-100 text-atelier-800 rounded-md font-bold font-sans">Completo</span>
                </div>
                <div className="space-y-1">
                  <p className="text-3xl font-black text-atelier-950 font-display">
                    {texts.pricePro}
                    <span className="text-xs text-slate-500 font-normal"> /mês</span>
                  </p>
                  <p className="text-[11.5px] text-emerald-600 font-semibold flex items-center gap-1">
                    <Zap className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    Comece hoje com 7 Dias Grátis
                  </p>
                </div>
                <p className="text-xs text-slate-500">Completo para alfaiatarias em crescimento com assistentes ou equipas.</p>
                
                <ul className="space-y-2.5 pt-2 text-xs text-slate-650">
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-atelier-600 shrink-0 animate-pulse" />
                    <span className="font-semibold text-slate-900">Segurança Cloud Automática</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-atelier-600 shrink-0" />
                    <span>Cobrança Pronta via WhatsApp</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-atelier-600 shrink-0" />
                    <span>Lembretes de Entrega</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-atelier-600 shrink-0" />
                    <span>Dispositivos Ilimitados</span>
                  </li>
                </ul>
              </div>

              <button
                onClick={() => onStartTrial(pais)}
                className="w-full py-3.5 bg-atelier-600 hover:bg-atelier-700 text-white font-bold text-xs rounded-xl transition-all shadow-md hover:scale-[1.01] cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-200" />
                Começar Teste Pro Grátis
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Accordion Section */}
      <section id="landing-faq" className="py-20 bg-atelier-50/20 border-t border-atelier-200/40">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="text-center space-y-3 max-w-2xl mx-auto">
            <div className="w-12 h-12 rounded-2xl bg-atelier-100 text-atelier-700 mx-auto flex items-center justify-center shadow-xs border border-atelier-200">
              <HelpCircle className="w-6 h-6 text-atelier-700" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-display font-black text-atelier-950 tracking-tight">
              Perguntas Frequentes
            </h2>
            <p className="text-xs sm:text-sm text-slate-550">
              {texts.faqDesc}
            </p>
          </div>

          <div className="space-y-4 max-w-3xl mx-auto">
            {faqItems.map((item, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div 
                  key={idx} 
                  className="bg-white rounded-2xl border border-slate-200/85 shadow-xs overflow-hidden transition-all duration-300 hover:border-atelier-300"
                >
                  <button
                    onClick={() => setOpenFaq(isOpen ? null : idx)}
                    className="w-full text-left px-6 py-4.5 flex items-center justify-between gap-4 font-sans font-bold text-xs sm:text-sm text-slate-900 hover:text-atelier-900 transition-colors cursor-pointer select-none"
                  >
                    <span className="flex items-center gap-2.5">
                      <HelpCircle className="w-4 h-4 text-atelier-500 shrink-0" />
                      <span>{item.question}</span>
                    </span>
                    {isOpen ? (
                      <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                    )}
                  </button>

                  <div 
                    className={`transition-all duration-300 overflow-hidden ${
                      isOpen ? 'max-h-[300px] border-t border-slate-100' : 'max-h-0'
                    }`}
                  >
                    <div className="px-6 py-4 text-xs sm:text-[13px] text-slate-600 leading-relaxed bg-slate-50/45">
                      {item.answer}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Final Action CTA Footer */}
      <section id="landing-footer-cta" className="py-20 bg-slate-900 text-white relative">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
          <h2 className="text-3xl font-display font-black tracking-tight text-white m-0 leading-tight">
            Pronto para revolucionar as costuras e prazos do seu ateliê?
          </h2>
          <p className="text-slate-400 text-xs sm:text-sm max-w-xl mx-auto leading-relaxed">
            Nenhuma informação de pagamento ou comprovativo financeiro é exigido no primeiro registo. Registe-se agora e use sem restrições por 1 semana no seu negócio.
          </p>

          <button
            onClick={() => onStartTrial(pais)}
            className="px-8 py-3.5 bg-atelier-500 hover:bg-atelier-600 text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-all hover:scale-[1.02] cursor-pointer inline-flex items-center gap-2 shadow-lg shadow-atelier-500/25"
          >
            <span>Quero Testar 7 Dias Grátis</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          <div className="pt-10 border-t border-slate-800 text-[11px] text-slate-500 space-y-1">
            <p>{texts.footerText1}</p>
            <p>{texts.footerText2}</p>
          </div>
        </div>
      </section>
    </div>
  );
}
