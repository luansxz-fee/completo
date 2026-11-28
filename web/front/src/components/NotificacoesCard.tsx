import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useAcessibilidade } from '../context/AcessibilidadeContext';
import { useNotificacoes } from '../hooks/useNotificacoes';
import { usePwa } from '../hooks/usePwa';
import { api } from '../services/api';
import Interruptor from './Interruptor';
import GuiaInstalacao from './GuiaInstalacao';

type Tom = 'ok' | 'aviso' | 'neutro';

function Selo({ tom, children }: { tom: Tom; children: React.ReactNode }) {
  return <span className={`selo selo--${tom}`}>{children}</span>;
}

export default function NotificacoesCard() {
  const { usuario, atualizarUsuario } = useAuth();
  const { avisar } = useAcessibilidade();
  const n = useNotificacoes();
  const pwa = usePwa();
  const [testando, setTestando] = useState(false);
  const [guia, setGuia] = useState(false);
  const prefs = usuario?.notificacoes || { push: true, emailLembretes: true, emailCuidador: true };

  const mudar = async (campo: 'push' | 'emailLembretes' | 'emailCuidador', valor: boolean) => {
    try {
      await atualizarUsuario({ notificacoes: { [campo]: valor } });
      avisar('Preferência salva.', 'sucesso');
    } catch {
      avisar('Não foi possível salvar a preferência.', 'erro');
    }
  };

  const ativar = async () => {
    const problema = await n.ativar();
    if (problema) avisar(problema, 'erro');
    else avisar('Pronto! Você vai receber os lembretes neste aparelho.', 'sucesso');
  };

  const testar = async () => {
    setTestando(true);
    try {
      const r = await api.notificacoes.teste(true);
      if (r.push > 0 || r.email) {
        avisar(`Teste enviado${r.push ? ' (notificação)' : ''}${r.email ? ` e e-mail para ${usuario?.email}` : ''}. Confira!`, 'sucesso');
      } else {
        avisar('Nada foi entregue ainda. Ative as notificações neste aparelho e confira a caixa de e-mail.', 'erro');
      }
    } catch (e: any) {
      avisar(e?.message || 'Falha no teste.', 'erro');
    } finally {
      setTestando(false);
    }
  };

  // Situação das notificações NESTE aparelho
  const precisaInstalarNoIphone = n.ios && !pwa.instalado && !n.suportado;
  let estado: { tom: Tom; titulo: string; texto: string };
  if (precisaInstalarNoIphone) {
    estado = { tom: 'aviso', titulo: 'Precisa instalar', texto: 'No iPhone/iPad as notificações só funcionam com o MedSync instalado na Tela de Início.' };
  } else if (!n.suportado) {
    estado = { tom: 'neutro', titulo: 'Indisponível neste navegador', texto: 'Este navegador não permite notificações. Os lembretes por e-mail continuam funcionando.' };
  } else if (n.permissao === 'denied') {
    estado = { tom: 'aviso', titulo: 'Bloqueadas', texto: 'As notificações foram bloqueadas. Toque no cadeado ao lado do endereço do site e permita “Notificações”.' };
  } else if (n.inscritoAqui) {
    estado = { tom: 'ok', titulo: 'Ativas neste aparelho', texto: 'Você receberá o aviso na hora de cada dose, mesmo com o site fechado.' };
  } else {
    estado = { tom: 'neutro', titulo: 'Ainda não ativadas', texto: 'Toque em “Ativar” para receber o aviso na hora de cada dose. Leva um segundo.' };
  }

  return (
    <section className="card notif-card" aria-labelledby="titulo-notif">
      <header className="notif-card__topo">
        <div className="notif-card__icone" aria-hidden="true">🔔</div>
        <div>
          <h2 className="card-section-title" id="titulo-notif">Lembretes e notificações</h2>
          <p className="form-hint">Avisamos na hora de cada dose, repetimos se você esquecer e, se houver cuidadores, eles são avisados quando atrasar.</p>
        </div>
      </header>

      <div className="notif-bloco">
        <div className="notif-bloco__linha">
          <div className="notif-bloco__texto">
            <div className="notif-bloco__titulo"><span aria-hidden="true">📱</span> Neste aparelho <Selo tom={estado.tom}>{estado.titulo}</Selo></div>
            <p>{estado.texto}</p>
          </div>
          <div className="notif-bloco__acoes">
            {precisaInstalarNoIphone && <button type="button" className="btn btn--primary btn--sm" onClick={() => setGuia(true)}>Como instalar</button>}
            {n.suportado && !n.inscritoAqui && n.permissao !== 'denied' && (
              <button type="button" className="btn btn--primary btn--sm" onClick={() => void ativar()} disabled={n.ocupado}>{n.ocupado ? 'Ativando…' : 'Ativar'}</button>
            )}
            {n.suportado && n.inscritoAqui && (
              <button type="button" className="btn btn--outline btn--sm" onClick={() => void n.desativar()} disabled={n.ocupado}>Desativar</button>
            )}
            {pwa.podeInstalar && !pwa.ios && (
              <button type="button" className="btn btn--outline btn--sm" onClick={() => void pwa.instalar()}>Instalar como app</button>
            )}
          </div>
        </div>

        {n.servidorHabilitado === false && (
          <p className="notif-bloco__nota">As notificações do navegador estão temporariamente indisponíveis. Você continua recebendo por e-mail.</p>
        )}
      </div>

      <div className="notif-bloco">
        <div className="notif-bloco__linha">
          <div className="notif-bloco__texto">
            <div className="notif-bloco__titulo"><span aria-hidden="true">✉️</span> E-mail da sua conta {prefs.emailLembretes ? <Selo tom="ok">Ativo</Selo> : <Selo tom="neutro">Desligado</Selo>}</div>
            <p>Os lembretes vão para <strong>{usuario?.email}</strong>.</p>
          </div>
          <Interruptor ligado={prefs.emailLembretes} onChange={(v) => void mudar('emailLembretes', v)} rotulo="Receber lembretes por e-mail" />
        </div>
      </div>

      <div className="notif-bloco">
        <div className="notif-bloco__linha">
          <div className="notif-bloco__texto">
            <div className="notif-bloco__titulo"><span aria-hidden="true">📲</span> Notificações no navegador</div>
            <p>Liga ou desliga em todos os seus aparelhos.</p>
          </div>
          <Interruptor ligado={prefs.push} onChange={(v) => void mudar('push', v)} rotulo="Receber notificações no navegador" />
        </div>
        <div className="notif-bloco__linha">
          <div className="notif-bloco__texto">
            <div className="notif-bloco__titulo"><span aria-hidden="true">🤝</span> Alertas de quem eu ajudo</div>
            <p>E-mail quando um paciente seu atrasar uma dose.</p>
          </div>
          <Interruptor ligado={prefs.emailCuidador} onChange={(v) => void mudar('emailCuidador', v)} rotulo="Receber alertas de pacientes por e-mail" />
        </div>
      </div>

      <button type="button" className="btn btn--outline btn--block" onClick={() => void testar()} disabled={testando}>
        <span aria-hidden="true">🧪</span> {testando ? 'Enviando…' : 'Enviar um teste agora'}
      </button>

      {guia && <GuiaInstalacao onClose={() => setGuia(false)} />}
    </section>
  );
}
