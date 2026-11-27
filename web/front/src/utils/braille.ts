/**
 * Transcrição de texto em português para Braille Unicode (grau 1, letra a letra),
 * seguindo o alfabeto da Grafia Braille para a Língua Portuguesa.
 *
 * Observação importante: é uma transcrição visual de apoio. Pessoas que usam
 * linha Braille (display) com leitor de tela (NVDA, JAWS, VoiceOver, TalkBack)
 * recebem o TEXTO normal e a própria linha Braille faz a conversão — por isso o
 * Braille Unicode exibido na tela é marcado com aria-hidden.
 */
const LETRAS: Record<string, string> = {
  a: '⠁', b: '⠃', c: '⠉', d: '⠙', e: '⠑', f: '⠋', g: '⠛', h: '⠓', i: '⠊', j: '⠚',
  k: '⠅', l: '⠇', m: '⠍', n: '⠝', o: '⠕', p: '⠏', q: '⠟', r: '⠗', s: '⠎', t: '⠞',
  u: '⠥', v: '⠧', w: '⠺', x: '⠭', y: '⠽', z: '⠵',
  ç: '⠯', á: '⠷', à: '⠫', â: '⠡', ã: '⠜', é: '⠿', ê: '⠣', í: '⠌', ó: '⠬', ô: '⠩', õ: '⠪', ú: '⠾', ü: '⠳',
};

const DIGITOS: Record<string, string> = {
  '1': '⠁', '2': '⠃', '3': '⠉', '4': '⠙', '5': '⠑', '6': '⠋', '7': '⠛', '8': '⠓', '9': '⠊', '0': '⠚',
};

const PONTUACAO: Record<string, string> = {
  '.': '⠲', ',': '⠂', ';': '⠆', ':': '⠒', '?': '⠢', '!': '⠖', '-': '⠤', '–': '⠤', '—': '⠤',
  '(': '⠶', ')': '⠶', '"': '⠦', '“': '⠦', '”': '⠴', "'": '⠄', '/': '⠸⠌', '%': '⠨⠴', '+': '⠐⠖', '=': '⠐⠶', '×': '⠐⠦',
};

const SINAL_NUMERO = '⠼';
const SINAL_MAIUSCULA = '⠠';
const SINAL_MAIUSCULA_PALAVRA = '⠠⠠';

export function paraBraille(texto: string): string {
  if (!texto) return '';
  const saida: string[] = [];
  const palavras = texto.normalize('NFC').split(/(\s+)/);

  for (const palavra of palavras) {
    if (/^\s+$/.test(palavra) || palavra === '') {
      saida.push(' ');
      continue;
    }
    const letras = [...palavra].filter((c) => /\p{L}/u.test(c));
    const tudoMaiusculo = letras.length > 1 && letras.every((c) => c === c.toUpperCase() && c !== c.toLowerCase());
    if (tudoMaiusculo) saida.push(SINAL_MAIUSCULA_PALAVRA);

    let emNumero = false;
    for (const c of palavra) {
      if (DIGITOS[c]) {
        if (!emNumero) { saida.push(SINAL_NUMERO); emNumero = true; }
        saida.push(DIGITOS[c]);
        continue;
      }
      if ((c === ',' || c === '.') && emNumero) { saida.push(PONTUACAO[c === '.' ? ',' : ',']); continue; } // 2,5 / 2.5
      emNumero = false;

      const minuscula = c.toLowerCase();
      if (LETRAS[minuscula]) {
        const maiuscula = c !== minuscula;
        if (maiuscula && !tudoMaiusculo) saida.push(SINAL_MAIUSCULA);
        saida.push(LETRAS[minuscula]);
      } else if (PONTUACAO[c]) {
        saida.push(PONTUACAO[c]);
      }
      // demais símbolos (emojis etc.) são ignorados
    }
  }
  return saida.join('').replace(/ +/g, ' ').trim();
}
