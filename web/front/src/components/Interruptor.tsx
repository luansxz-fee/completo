import React from 'react';

interface Props {
  ligado: boolean;
  onChange: (v: boolean) => void;
  rotulo: string;
  desabilitado?: boolean;
}

/** Interruptor acessível (role="switch"): estado anunciado como "ligado/desligado". */
export default function Interruptor({ ligado, onChange, rotulo, desabilitado }: Props) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={ligado}
      aria-label={rotulo}
      disabled={desabilitado}
      className={`toggle ${ligado ? 'toggle--on' : ''}`}
      onClick={() => onChange(!ligado)}
    >
      <span aria-hidden="true" />
    </button>
  );
}
