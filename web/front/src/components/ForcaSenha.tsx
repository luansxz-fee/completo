import React from 'react';

export const REGRAS_SENHA = [
  { id: 'tam', texto: 'Pelo menos 8 caracteres', ok: (s: string) => s.length >= 8 },
  { id: 'min', texto: 'Uma letra minúscula', ok: (s: string) => /[a-z]/.test(s) },
  { id: 'mai', texto: 'Uma letra maiúscula', ok: (s: string) => /[A-Z]/.test(s) },
  { id: 'num', texto: 'Um número', ok: (s: string) => /\d/.test(s) },
  { id: 'esp', texto: 'Um caractere especial (!@#$…)', ok: (s: string) => /[^A-Za-z0-9]/.test(s) },
];

export const senhaForte = (s: string) => REGRAS_SENHA.every((r) => r.ok(s));

/** Lista de requisitos: cada item diz "atendido" ou "falta" em texto (não só por cor). */
export default function ForcaSenha({ senha, id }: { senha: string; id: string }) {
  return (
    <ul className="regras-senha" id={id} aria-label="Requisitos da senha">
      {REGRAS_SENHA.map((r) => {
        const ok = r.ok(senha);
        return (
          <li key={r.id} className={ok ? 'regra regra--ok' : 'regra'}>
            <span aria-hidden="true">{ok ? '✓' : '○'}</span> {r.texto}
            <span className="sr-only">{ok ? ' — atendido' : ' — falta'}</span>
          </li>
        );
      })}
    </ul>
  );
}
