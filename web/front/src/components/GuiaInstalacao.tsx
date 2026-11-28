import React from 'react';
import Modal from './Modal';

/** Passo a passo ilustrado para instalar o MedSync na tela inicial (necessário no iPhone/iPad). */
export default function GuiaInstalacao({ onClose }: { onClose: () => void }) {
  return (
    <Modal
      titulo="Instalar o MedSync no iPhone"
      subtitulo="A Apple só libera notificações para sites instalados. Leva 20 segundos."
      icone={<div className="modal__header-icon" aria-hidden="true">📲</div>}
      tamanho="sm"
      onClose={onClose}
      rodape={<button type="button" className="btn btn--primary" onClick={onClose}>Entendi</button>}
    >
      <ol className="guia-passos">
        <li>
          <span className="guia-passos__num" aria-hidden="true">1</span>
          <div>
            <strong>Abra este site no Safari</strong>
            <p>Se estiver em outro navegador (Chrome, Instagram…), copie o endereço e cole no Safari.</p>
          </div>
        </li>
        <li>
          <span className="guia-passos__num" aria-hidden="true">2</span>
          <div>
            <strong>Toque em Compartilhar <span className="guia-icone" aria-hidden="true">⬆︎</span></strong>
            <p>É o quadrado com uma seta para cima, na barra de baixo do Safari.</p>
          </div>
        </li>
        <li>
          <span className="guia-passos__num" aria-hidden="true">3</span>
          <div>
            <strong>Escolha “Adicionar à Tela de Início”</strong>
            <p>Role a lista para baixo, se precisar, e toque em <em>Adicionar</em>.</p>
          </div>
        </li>
        <li>
          <span className="guia-passos__num" aria-hidden="true">4</span>
          <div>
            <strong>Abra o MedSync pelo novo ícone</strong>
            <p>Entre na sua conta e toque em <em>Ativar notificações</em> no Perfil. Pronto!</p>
          </div>
        </li>
      </ol>
      <p className="form-hint">Enquanto isso, os lembretes por e-mail já funcionam normalmente.</p>
    </Modal>
  );
}
