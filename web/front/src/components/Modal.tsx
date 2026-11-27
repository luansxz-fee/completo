import React, { useEffect, useId, useRef } from 'react';

interface ModalProps {
  titulo: string;
  onClose: () => void;
  children: React.ReactNode;
  rodape?: React.ReactNode;
  tamanho?: 'sm' | 'lg';
  /** conteúdo visual à esquerda do título (ícone, miniatura) */
  icone?: React.ReactNode;
  subtitulo?: string;
  /** passos/abas exibidos entre o cabeçalho e o corpo */
  topo?: React.ReactNode;
}

const FOCAVEIS =
  'a[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

/**
 * Modal acessível: role="dialog", aria-modal, título associado, foco preso dentro do
 * diálogo, fecha com ESC, trava a rolagem do fundo e devolve o foco ao elemento de origem.
 */
export default function Modal({ titulo, onClose, children, rodape, tamanho = 'lg', icone, subtitulo, topo }: ModalProps) {
  const idTitulo = useId();
  const caixa = useRef<HTMLDivElement>(null);
  const aoFechar = useRef(onClose);
  aoFechar.current = onClose;

  useEffect(() => {
    const origem = document.activeElement as HTMLElement | null;
    const rolagem = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const primeiro =
      caixa.current?.querySelector<HTMLElement>('[data-autofocus]') ||
      caixa.current?.querySelector<HTMLElement>('.modal__body input, .modal__body textarea, .modal__body select, .modal__body button');
    (primeiro || caixa.current)?.focus();

    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        aoFechar.current();
        return;
      }
      if (e.key !== 'Tab' || !caixa.current) return;
      const itens = [...caixa.current.querySelectorAll<HTMLElement>(FOCAVEIS)].filter((el) => el.offsetParent !== null);
      if (itens.length === 0) { e.preventDefault(); return; }
      const ini = itens[0];
      const fim = itens[itens.length - 1];
      if (e.shiftKey && document.activeElement === ini) { e.preventDefault(); fim.focus(); }
      else if (!e.shiftKey && document.activeElement === fim) { e.preventDefault(); ini.focus(); }
    };
    document.addEventListener('keydown', aoTeclar, true);

    return () => {
      document.removeEventListener('keydown', aoTeclar, true);
      document.body.style.overflow = rolagem;
      origem?.focus?.();
    };
  }, []);

  return (
    <div
      className="modal-overlay"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        ref={caixa}
        className={`modal modal--${tamanho}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitulo}
        tabIndex={-1}
      >
        <div className="modal__header">
          <div className="modal__header-inner">
            {icone}
            <div>
              <h2 id={idTitulo}>{titulo}</h2>
              {subtitulo && <p className="modal__subtitle">{subtitulo}</p>}
            </div>
          </div>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Fechar janela">
            <span aria-hidden="true">✕</span>
          </button>
        </div>
        {topo}
        <div className="modal__body">{children}</div>
        {rodape && <div className="modal__footer">{rodape}</div>}
      </div>
    </div>
  );
}
