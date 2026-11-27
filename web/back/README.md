# MedSync — API (Node.js + Express + MongoDB)

```bash
cp .env.example .env     # preencha (veja docs/GUIA-DE-DEPLOY.md)
npm install
npm run gerar-vapid      # chaves do Web Push → cole no .env
npm run dev              # http://localhost:3001/api/health
npm test                 # 11 testes de integração (precisa de MongoDB em 127.0.0.1:27017)
```

## O que a API faz
| Área | Rotas principais |
|---|---|
| Conta | `POST /api/auth/registrar` → `verificar-email` (código de 6 dígitos por e-mail) → `login`; `esqueci-senha` / `redefinir-senha`; `GET/PUT/DELETE /api/auth/eu`; `alterar-senha` |
| Medicamentos | `GET/POST /api/medicamentos`, `PUT/DELETE /:id`, `PATCH /:id/alternar` |
| Doses | `POST /api/registros` (aceita `tomada/TOMADO/taken…`), `GET /registros`, `/hoje`, `/adesao` |
| Cuidadores | `/api/cuidadores/*` (convidar, aceitar, permissões, resumo do paciente). Cabeçalho `X-Paciente-Id` faz o cuidador agir sobre os dados do paciente |
| Notificações | `/api/notificacoes/*` (inscrição push, teste, status) |
| Lembretes | agendador interno + `GET/POST /api/interno/lembretes` (gatilho externo protegido por `CRON_SECRET`) |

## Como os lembretes funcionam
A cada minuto, para cada dose agendada e **ainda não registrada**: lembrete (0–14 min) → repetição (15–29 min) → alerta ao(s) cuidador(es) (≥30 min) → marcada como *perdida* (≥120 min). Cada aviso tem chave única, então **nunca é enviado em duplicidade**, mesmo com reinícios ou várias instâncias, e é tolerante a atrasos (se o servidor "dormiu" e acordou, o aviso ainda sai). Todo o cálculo de data/hora usa o **fuso do usuário** (antes usava UTC e errava depois das 21h no Brasil).

## Segurança (resumo)
`helmet`, CORS restrito a `FRONTEND_URL`, `trust proxy`, limites por rota, códigos guardados só como HMAC, no máximo 5 tentativas no código de e-mail, JWT ≥ 32 caracteres, nenhuma resposta devolve código/token, `GET /usuarios/:id` só para o próprio usuário ou cuidador vinculado, exclusão de conta (LGPD).
