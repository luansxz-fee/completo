import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useAcessibilidade } from '../context/AcessibilidadeContext';
import { useNotificacoes } from '../hooks/useNotificacoes';
import { usePwa } from '../hooks/usePwa';
import GuiaInstalacao from './GuiaInstalacao';

const CHAVE = 'medsync_banner_notif_ate';

/** Convite de um toque para ativar os lembretes (aparece só quando falta ativar; pode ser dispensado por 7 dias). */
export default function BannerNotificacoes() {
  const { usuario } = useAuth();
  const { avisar } = useAcessibilidade();
  const n = useNotificacoes();
  const pwa = usePwa();
  const [guia, setGuia] = useState(false);
  const [oculto, setOculto] = useState(() => Number(localStorage.getItem(CHAVE) || 0) > Date.now());

  const precisaInstalar = n.ios && !pwa.instalado && !n.suportado;
  const podeAtivar = n.suportado && !n.inscritoAqui && n.permissao === 'default';
  if (oculto || usuario?.notificacoes?.push === false || (!precisaInstalar && !podeAtivar)) return null;

  const dispensar = () => {
    localStorage.setItem(CHAVE, String(Date.now() + 7 * 86400000));
    setOculto(true);
  };

  const ativar = async () => {
    const problema = await n.ativar();
    if (problema) avisar(problema, 'erro');
    else avisar('Pronto! Você vai receber os lembretes neste aparelho.', 'sucesso');
  };

  return (
    <div className="banner-notif" role="region" aria-label="Ativar lembretes">
      <div className="banner-notif__icone" aria-hidden="true">🔔</div>
      <div className="banner-notif__texto">
        <strong>Não esqueça nenhuma dose</strong>
        <span>{precisaInstalar ? 'Instale o MedSync na Tela de Início para receber os lembretes no iPhone.' : 'Ative os lembretes e receba um aviso na hora de cada remédio.'}</span>
      </div>
      <div className="banner-notif__acoes">
        {precisaInstalar ? (
          <button type="button" className="btn btn--primary btn--sm" onClick={() => setGuia(true)}>Como instalar</button>
        ) : (
          <button type="button" className="btn btn--primary btn--sm" onClick={() => void ativar()} disabled={n.ocupado}>{n.ocupado ? 'Ativando…' : 'Ativar lembretes'}</button>
        )}
        <button type="button" className="btn btn--ghost btn--sm" onClick={dispensar}>Agora não</button>
      </div>
      {guia && <GuiaInstalacao onClose={() => setGuia(false)} />}
    </div>
  );
}
