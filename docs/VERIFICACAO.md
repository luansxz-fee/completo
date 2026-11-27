# O que foi verificado (e o que NÃO foi)

Transparência sobre o estado real deste pacote.

## ✅ Verificado de verdade
| Item | Como |
|---|---|
| API: cadastro → código por e-mail → verificação → login; bloqueio após 5 códigos errados; recuperação de senha de uso único; sem vazamento de código; rate limit não bloqueia `/auth/eu` | 11 testes de integração (`cd web/back && npm test`), rodados 6× seguidas sem falha |
| Doses: status em qualquer grafia, estoque descontado/devolvido no servidor sem duplicar, adesão, isolamento entre usuários | idem |
| Cuidadores: convite, aceite só pelo e-mail dono, leitura × escrita por permissão, revogação | idem |
| Lembretes: não envia antes da hora, envia na hora, repete aos 15 min, alerta cuidador aos 30 (uma vez), nunca duplica, marca "perdida" no servidor, não sobrescreve dose registrada | idem (relógio simulado) |
| Fuso horário (às 22h de Brasília o "hoje" continua hoje) | teste dedicado |
| Site: compila (`tsc` + `vite build`) sem erros | `npm run build` |
| **Campos de data**: sem sobreposição | Chromium real, medindo as caixas: celular (390 px) → colunas cheias em linhas diferentes; desktop (1280 px) → lado a lado, sem interseção |
| Níveis de visão, daltonismo grau 3, Braille na tela, painel de acessibilidade | capturas de tela em Chromium contra a API real |
| Flutter: sintaxe de todos os `.dart` | parser tree-sitter (o arquivo original também passa) |

Os testes rodaram contra **FerretDB** (emulador compatível com MongoDB, sem índices TTL), não contra um MongoDB real. O `ci.yml` do site roda a mesma suíte contra `mongo:7` no GitHub Actions: confira o resultado na primeira execução.

## ⚠️ NÃO verificado — faça você
| Item | Por quê / o que fazer |
|---|---|
| **Compilar o app Flutter e gerar o APK** | O ambiente onde trabalhei não alcança o SDK do Flutter nem o pub.dev. O código passa na checagem de sintaxe, mas **erros de tipo/API só aparecem no compilador**. Rode `flutter pub get && flutter analyze` ou o workflow *Gerar APK*; se algo acusar erro, me envie a mensagem. Versões dos pacotes (`flutter_local_notifications ^19`, `flutter_tts ^4`, `timezone ^0.10`) usam caret e podem exigir ajuste fino. |
| Scaffold Android (Gradle/AGP 8.7.3/Gradle 8.10.2) | Reescrito seguindo o template atual do Flutter, mas **não executado**. |
| Envio real de e-mail (Brevo) | Sem credenciais aqui. Teste conforme `GUIA-DE-DEPLOY.md` §1. |
| Web Push ponta a ponta | Precisa de navegador real + chaves VAPID + HTTPS. |
| Alarmes do Android com app fechado / reinício / economia de bateria | Só em aparelho. Use *Perfil → Notificações → Agendar em 15 s*. Alguns fabricantes (Xiaomi, Samsung…) matam alarmes: libere "Sem restrições" de bateria. |
| Push remoto no app para o **cuidador** | Exigiria Firebase (FCM), cuja conta/`google-services.json` só você pode criar. Hoje o cuidador recebe alerta por **e-mail** e **push web**; no app, ao abrir. |
| Fuso horário de quem usa só o app | O app não envia o fuso (padrão `America/Sao_Paulo`); o site envia o do navegador. Fora do horário de Brasília, abra o site uma vez para ajustar. |
| Transcrição Braille | Revisão por transcritor recomendada (`ACESSIBILIDADE.md`). |
| Paletas de daltonismo | Baseadas em literatura; sem validação com pessoas daltônicas. |
| iOS | O projeto não tem pasta `ios/`; foco em Android. |

## 🐞 Bugs do projeto original encontrados e corrigidos
1. **Registrar dose nunca gravava no banco**: o site enviava `TOMADO/PERDIDO/PULADO` e a API só aceitava `tomada/perdida/pulada` (erro 422).
2. A API devolvia `dataDose`, o site lia `data`: datas e histórico erravam.
3. Estoque descontado dentro de um `setState` no navegador (duplicava em modo estrito e não persistia). Agora é atômico no servidor.
4. "Hoje" calculado em UTC: depois das 21h (Brasília) doses iam para o dia seguinte.
5. Dose marcada como **perdida** 1 minuto após o horário, só com o site aberto; agora o servidor decide após a tolerância e o usuário ainda pode registrar dose atrasada (no app também).
6. `GET /auth/eu` dividia o limite de 20 req/15 min com o login: recarregar a página ~20× bloqueava o usuário.
7. `NODE_ENV=development` devolvia o código de recuperação na resposta (tomada de conta). `Math.random()` para gerar códigos; códigos em texto puro; TLS sem validação (`rejectUnauthorized:false`).
8. `GET /usuarios/:id` expunha nome e e-mail de qualquer usuário a qualquer logado.
9. CORS `*`, sem `helmet`, sem `trust proxy` (todo mundo dividia o mesmo IP no rate limit).
10. `.env` com segredos versionado no GitHub.
11. Android do app sem o plugin do Flutter no Gradle, sem Gradle wrapper e com 1,5 GB de memória (estoura no release).
12. Sobreposição dos campos de data (a causa: `flex-wrap` + `min-width:140px` + largura intrínseca do `<input type="date">`).
