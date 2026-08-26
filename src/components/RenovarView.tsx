import React, { useState, useEffect } from 'react';
import { localDb, customAuth } from '../firebase';
import { SolicitacaoPagamento, Atelie } from '../types';
import { CreditCard, Send, Lock, HelpCircle, LogOut, CheckCircle, Smartphone } from 'lucide-react';

interface RenovarViewProps {
  atelie: Atelie;
  onLogout: () => void;
  onRefresh: () => void;
}

export default function RenovarView({ atelie, onLogout, onRefresh }: RenovarViewProps) {
  const [metodo, setMetodo] = useState<'multicaixa' | 'transferencia'>('multicaixa');
  const [comprovativo, setComprovativo] = useState('');
  const [loading, setLoading] = useState(false);
  const [sucesso, setSucesso] = useState(false);
  const [solicitacaoPendente, setSolicitacaoPendente] = useState<any>(null);

  const configs = localDb.getConfigs();

  useEffect(() => {
    // Check if there is an existing pending request for this ateliê
    const pended = localDb.getSolicitacoes().find(
      s => s.atelieId === atelie.id && s.status === 'pendente'
    );
    if (pended) {
      setSolicitacaoPendente(pended);
    } else {
      setSolicitacaoPendente(null);
    }
  }, [atelie.id, sucesso]);

  const handleSubmitDeclaracao = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    setTimeout(() => {
      const novaSolicitacao: SolicitacaoPagamento = {
        id: 'sol_' + Math.random().toString(36).substr(2, 9),
        atelieId: atelie.id,
        atelieNome: atelie.nome,
        emailOwner: atelie.emailOwner,
        telefoneOwner: atelie.telefone,
        plano: atelie.plano,
        metodoPagamento: metodo,
        comprovativoUrl: comprovativo || 'https://images.unsplash.com/photo-1554415707-6e8cfc93fe23?auto=format&fit=crop&q=80&w=400',
        status: 'pendente',
        solicitadoEm: new Date().toISOString(),
        resolvidoEm: null
      };

      localDb.saveSolicitacao(novaSolicitacao);
      setLoading(false);
      setSucesso(true);
    }, 1200);
  };

  // Pre-formatted messages for WhatsApp recipient
  const waMessage = encodeURIComponent(
    `Olá Administrador do FlowTailor! Gostaria de enviar o comprovativo de ativação da minha conta.\n\nAteliê: ${atelie.nome}\nE-mail cadastrado: ${atelie.emailOwner}\nPlano solicitado: ${atelie.plano.toUpperCase()}`
  );

  return (
    <div className="min-h-screen bg-atelier-50/50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-white rounded-3xl border border-atelier-200/80 shadow-xl shadow-atelier-950/5 overflow-hidden">
        
        {/* Banner */}
        <div className="bg-atelier-900 text-white p-6 relative">
          <div className="absolute top-4 right-4 text-atelier-200/20 bg-white/5 p-2 rounded-full">
            <Lock className="w-6 h-6 text-atelier-300" />
          </div>
          <p className="text-[11px] font-mono tracking-widest uppercase text-atelier-300">Acesso Restrito</p>
          <h2 className="text-2xl font-bold font-display mt-1">Conta Inactiva ou Expirada</h2>
          <p className="text-sm text-atelier-200 mt-2">
            Caro(a) alfaiate ou costureiro(a), active a sua mensalidade na plataforma para continuar a gerir as suas peças e clientes.
          </p>
        </div>

        {solicitacaoPendente ? (
          <div className="p-8 text-center space-y-5">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto animate-pulse">
              <CheckCircle className="w-9 h-9" />
            </div>
            <div className="max-w-md mx-auto space-y-2">
              <h3 className="text-xl font-bold text-gray-950 font-display">Aguardando Confirmação</h3>
              <p className="text-sm text-gray-600">
                Obrigado! Já recebemos a sua declaração de envio de comprovativo com data de{' '}
                <strong className="text-gray-900">
                  {new Date(solicitacaoPendente.solicitadoEm).toLocaleString('pt-AO')}
                </strong>
                .
              </p>
              <div className="bg-atelier-50 p-4 rounded-2xl border border-atelier-100 text-xs text-left text-atelier-800 space-y-1 mt-4">
                <p>📌 <strong>Plano indicado:</strong> {solicitacaoPendente.plano === 'pro' ? 'Pro' : 'Básico'}</p>
                <p>📌 <strong>Modo de pagamento:</strong> {solicitacaoPendente.metodoPagamento === 'multicaixa' ? 'Multicaixa Express' : 'Transferência Bancária'}</p>
              </div>
              <p className="text-sm text-gray-500 pt-2">
                Assim que confirmarmos o recebimento no WhatsApp, a sua conta será activada. Normalmente demoramos até <span className="font-semibold text-gray-800">24 horas</span>.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-4 justify-center">
              <a
                href={`https://wa.me/${configs.whatsappAdmin}?text=${waMessage}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm transition-all shadow-sm"
              >
                <Smartphone className="w-4 h-4" /> Enviar Comprovativo no WhatsApp
              </a>
              <button
                onClick={onRefresh}
                className="px-5 py-3 rounded-xl bg-atelier-100 hover:bg-atelier-200 text-atelier-900 font-medium text-sm transition-all"
              >
                Actualizar Estado
              </button>
            </div>

            <div className="pt-6 border-t border-gray-100 flex justify-between items-center max-w-md mx-auto">
              <span className="text-xs text-slate-400">Dúvidas? Fale com o suporte.</span>
              <button
                onClick={onLogout}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-600 hover:text-red-800"
              >
                <LogOut className="w-3.5 h-3.5" /> Terminar sessão
              </button>
            </div>
          </div>
        ) : (
          <div className="p-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
              {/* Payment Info panel */}
              <div className="space-y-4">
                <h3 className="text-base font-bold text-gray-950 font-display border-b border-atelier-100 pb-2">
                  🏦 Passo 1: Informações de Pagamento
                </h3>
                
                <div className="bg-atelier-50 p-4 rounded-2xl border border-atelier-100 text-sm space-y-3.5">
                  <div>
                    <span className="text-xs text-atelier-600 block uppercase font-mono tracking-wider">Multicaixa Express</span>
                    <strong className="text-base text-atelier-950 font-mono tracking-wide">{configs.numeroExpress}</strong>
                  </div>
                  
                  <div className="border-t border-atelier-200/50 pt-3">
                    <span className="text-xs text-atelier-600 block uppercase font-mono tracking-wider">Transferência Bancária</span>
                    <p className="text-[13px] text-gray-800 font-medium">Banco: <strong>{configs.banco}</strong></p>
                    <p className="text-[13px] text-gray-800 font-medium">Titular: <strong>{configs.titular}</strong></p>
                    <div className="mt-1 bg-white px-2 py-1.5 rounded border border-atelier-100 select-all font-mono text-xs text-atelier-950 cursor-pointer" title="Clique para copiar">
                      {configs.iban}
                    </div>
                  </div>

                  <div className="border-t border-atelier-200/50 pt-2 text-xs text-atelier-700">
                    💡 <strong>Referência:</strong> Use o seu e-mail cadastrado (<span className="font-mono text-gray-900">{atelie.emailOwner}</span>) como referência do pagamento.
                  </div>
                </div>

                <div className="bg-amber-50 rounded-2xl p-4 border border-amber-200 text-xs text-amber-900 leading-relaxed">
                  ⚠️ <strong>Atenção:</strong> Após pagar na sua app de banco ou Multicaixa, carregue o comprovativo ou tire um screenshot e envie para o suporte no WhatsApp.
                </div>
              </div>

              {/* Form Declaration panel */}
              <div>
                <h3 className="text-base font-bold text-gray-950 font-display border-b border-atelier-100 pb-2 mb-4">
                  📝 Passo 2: Declarar Pagamento
                </h3>

                <form onSubmit={handleSubmitDeclaracao} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">Método usado</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setMetodo('multicaixa')}
                        className={`py-2.5 px-3 rounded-xl text-xs font-medium border transition-all flex items-center justify-center gap-1.5 ${
                          metodo === 'multicaixa'
                            ? 'bg-atelier-800 text-white border-atelier-800'
                            : 'bg-white text-gray-700 border-gray-200 hover:bg-slate-50'
                        }`}
                      >
                        <Smartphone className="w-3.5 h-3.5" /> Express
                      </button>
                      <button
                        type="button"
                        onClick={() => setMetodo('transferencia')}
                        className={`py-2.5 px-3 rounded-xl text-xs font-medium border transition-all flex items-center justify-center gap-1.5 ${
                          metodo === 'transferencia'
                            ? 'bg-atelier-800 text-white border-atelier-800'
                            : 'bg-white text-gray-700 border-gray-200 hover:bg-slate-50'
                        }`}
                      >
                        <CreditCard className="w-3.5 h-3.5" /> IBAN / Transf.
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                      Indique uma referência ou Link do Comprovativo (Opcional)
                    </label>
                    <input
                      type="text"
                      className="w-full px-3.5 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-atelier-500 bg-slate-50"
                      placeholder="Ex: Ref 48392 / Nome da conta"
                      value={comprovativo}
                      onChange={(e) => setComprovativo(e.target.value)}
                    />
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-atelier-700 hover:bg-atelier-800 text-white font-medium text-sm transition-all disabled:opacity-50 shadow-sm shadow-atelier-800/20"
                    >
                      {loading ? 'Processando envio...' : 'Já enviei o comprovativo pelo WhatsApp'}
                    </button>
                  </div>
                </form>

                <div className="mt-6 pt-5 border-t border-atelier-100 flex justify-between items-center">
                  <span className="text-xs text-atelier-700">Plano escolhido: <strong>{atelie.plano === 'pro' ? 'Pro (Ilimitado)' : 'Básico (30 Clientes)'}</strong></span>
                  <a
                    href={`https://wa.me/${configs.whatsappAdmin}?text=${waMessage}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 hover:text-emerald-800"
                  >
                    Falar com Admin
                  </a>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-gray-100 flex justify-between items-center text-xs text-slate-400">
              <button
                onClick={onLogout}
                className="inline-flex items-center gap-1.5 text-xs text-red-600 hover:text-red-800 font-semibold"
              >
                <LogOut className="w-3.5 h-3.5" /> Terminar sessão
              </button>
              <span>Seus dados continuam guardados em segurança.</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
