/** Data local (do navegador) no formato YYYY-MM-DD. */
export function hojeLocal(d: Date = new Date()): string {
  const ano = d.getFullYear();
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

export function somarDias(data: string, dias: number): string {
  const d = new Date(`${data}T12:00:00`);
  d.setDate(d.getDate() + dias);
  return hojeLocal(d);
}

export function minutosDoDia(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

export function agoraEmMinutos(d: Date = new Date()): number {
  return d.getHours() * 60 + d.getMinutes();
}

export function formatarDataBR(data?: string): string {
  if (!data) return '';
  return new Date(`${data.slice(0, 10)}T12:00:00`).toLocaleDateString('pt-BR');
}

export function fusoDoNavegador(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Sao_Paulo';
  } catch {
    return 'America/Sao_Paulo';
  }
}
