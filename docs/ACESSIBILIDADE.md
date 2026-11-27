# Acessibilidade do MedSync

Três trilhas independentes, **cada uma com graus**, no site e no app. As escolhas ficam salvas na conta (vale a versão mais recente entre aparelho e servidor) e há um botão ♿ em todas as telas, inclusive login (atalho no site: `Alt+Shift+0`).

| Trilha | Grau | O que muda |
|---|---|---|
| **Visão** (baixa visão / idosos) | 1 Conforto | letras e botões maiores (o antigo *Modo Idoso*, que foi mantido e migrado automaticamente) |
| | 2 Ampliado | + alto contraste, tela 15% maior (site) / texto 35% maior e negrito (app) |
| | 3 Máximo | tela 35% maior (texto 60% no app), contraste máximo, foco grosso, menos elementos decorativos |
| **Daltonismo** | tipo | protanopia, deuteranopia, tritanopia, acromatopsia |
| | 1 Paleta segura | status deixam de depender de vermelho×verde (paletas baseadas em Okabe & Ito) |
| | 2 + Símbolos | ✓ ✕ — ! junto de toda cor de status |
| | 3 + Padrões/rótulos | listras e texturas em barras, rótulos escritos por extenso |
| **Leitor de tela / Braille** | 1 | rótulos completos, `aria-live`, foco gerenciado, "pular para o conteúdo", atalhos `Alt+Shift+1..5`; compatível com NVDA, JAWS, VoiceOver, TalkBack e linhas Braille ligadas a eles |
| | 2 + Voz | leitura em voz alta (pt-BR) de avisos, lembretes e resumo do dia; velocidade ajustável |
| | 3 + Braille na tela | nome, dose e horário também em Braille Unicode (grau 1) |

## Sobre o Braille — leia
* Quem usa **linha Braille (display)** recebe o **texto normal** através do leitor de tela e a própria linha faz a conversão. Por isso o nível 1 é o que realmente atende esse público: todo o site usa HTML semântico, rótulos, regiões vivas e foco previsível.
* O **Braille na tela** (nível 3) é uma transcrição Unicode, letra a letra (grau 1), segundo o alfabeto da Grafia Braille para a Língua Portuguesa. Serve para conferir/aprender e para pessoas com baixa visão que leem Braille impresso. Está marcado `aria-hidden`/`ExcludeSemantics` para não duplicar a leitura.
* **Recomendação para o TCC:** peça a revisão de um transcritor Braille (ex.: Instituto Benjamin Constant) — a transcrição de horários e abreviações (`08:00`, `mg`) tem regras específicas que não foram validadas por especialista.

## Sobre o daltonismo
As paletas são aproximações baseadas em literatura (Okabe & Ito); **nenhuma cor é a única portadora de significado** (todo status tem texto e, nos graus 2–3, símbolo/padrão). Não foi feita validação clínica com pessoas daltônicas.

## Outras melhorias de acessibilidade feitas
Modal com `role="dialog"`, foco preso, `ESC` e devolução do foco · formulários com `label`/`aria-invalid`/`aria-describedby` · interruptores `role="switch"` · abas com `role="tablist"` · título da página e anúncio a cada troca de tela · campos de código com `autocomplete="one-time-code"` · respeito a `prefers-reduced-motion` ·
