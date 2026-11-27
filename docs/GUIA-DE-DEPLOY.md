# Guia de deploy — passo a passo

Ordem recomendada. Tempo total: ~40 minutos.

## 0. ⚠️ FAÇA ISTO PRIMEIRO: troque as credenciais que vazaram
O arquivo `back/.env` (com a senha do MongoDB, a senha de app do Gmail e o `JWT_SECRET`) **estava versionado no GitHub** (`luansxz-fee/web`). Considere todas comprometidas, mesmo que o repositório seja privado hoje:

1. **MongoDB Atlas** → Database Access → edite o usuário e **gere nova senha**; atualize a `MONGODB_URI`.
2. **Gmail** → myaccount.google.com/apppasswords → **revogue** a senha de app antiga (não precisamos mais dela: o e-mail agora sai pelo Brevo).
3. **JWT_SECRET** → gere um novo (invalida as sessões antigas, o que é o desejado):
   `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`
4. Tire os `.env` do Git (este pacote já traz o `.gitignore` e **sem** os `.env`):
   ```bash
   git rm --cached back/.env front/.env
   git add .gitignore && git commit -m "remove .env do versionamento"
   ```
   O histórico antigo ainda contém os segredos: por isso o passo 1–3 é obrigatório. (Opcional: limpar o histórico com `git filter-repo --path back/.env --invert-paths`.)
5. `NODE_ENV=development` no ambiente de produção fazia a recuperação de senha devolver o código na resposta (qualquer pessoa conseguiria tomar uma conta). **Isso foi corrigido no código**, e mesmo assim use `NODE_ENV=production` no Render.

## 1. E-mail real (verificação de conta, recuperação, lembretes) — Brevo
O plano gratuito do Render **bloqueia SMTP** (portas 25/465/587), então o envio via Gmail/SMTP não funciona lá. O MedSync usa a **API HTTPS do Brevo** (grátis: 300 e-mails/dia).

1. Crie a conta em brevo.com → **SMTP & API → API Keys → Generate** → copie a chave.
2. **Senders, Domains & Dedicated IPs → Senders → Add a sender**: cadastre o e-mail que será o remetente (pode ser um Gmail) e confirme o e-mail que o Brevo enviar.
3. No Render, defina `BREVO_API_KEY` e `EMAIL_REMETENTE="MedSync <esse-email@gmail.com>"`.
4. Teste: crie uma conta no site → o código de 6 dígitos deve chegar (veja o spam na primeira vez).

## 2. Notificações push (navegador / PWA)
```bash
cd web/back && npm install && npm run gerar-vapid
```
Copie `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` e `VAPID_SUBJECT` para o Render. No site: **Perfil → Notificações → Ativar → Testar**.
No iPhone/iPad as notificações web só funcionam com o site instalado (Compartilhar → *Adicionar à Tela de Início*).

## 3. Back-end no Render (variáveis de ambiente)
`MONGODB_URI`, `JWT_SECRET`, `NODE_ENV=production`, `FRONTEND_URL=https://SEU-SITE.vercel.app`, `BREVO_API_KEY`, `EMAIL_REMETENTE`, `VAPID_*`, `CRON_SECRET` (qualquer texto longo). Modelo completo: `web/back/.env.example`.
Build: `npm install` · Start: `npm start`. Confira `https://SEU-BACKEND/api/health`.
Depois do primeiro deploy rode uma vez `npm run setup-db` (consolida doses duplicadas antigas e cria os índices; o servidor também faz isso ao iniciar).

> Contas já existentes ficam como "e-mail não confirmado": no próximo login recebem um código por e-mail. É o comportamento esperado da verificação real.

## 4. Lembretes pontuais mesmo com o Render "dormindo"
O plano gratuito suspende o serviço após ~15 min sem acesso; enquanto dorme, o agendador interno não roda. Solução gratuita: um "cron" externo chamando o servidor **a cada minuto** (isso também o mantém acordado):

1. cron-job.org → **Create cronjob**
2. URL: `https://SEU-BACKEND/api/interno/lembretes?segredo=SEU_CRON_SECRET` · intervalo: **a cada 1 minuto**.

O processamento é tolerante a atraso e nunca duplica avisos. (Em plano pago o agendador interno basta.)

## 5. Site na Vercel
Settings → Environment Variables: `VITE_API_URL=https://SEU-BACKEND/api`. O `vercel.json` já cuida do SPA, cache e cabeçalhos de segurança. Faça o redeploy.

## 6. App Android (APK para baixar)
O repositório do app traz `.github/workflows/build-apk.yml`.
1. Suba a pasta `app/` para um repositório no GitHub.
2. Aba **Actions** → *Gerar APK do MedSync* → **Run workflow** (ou faça um push).
3. Ao terminar (~10 min): **Releases → MedSync (build N) → MedSync.apk**. Esse é o link para compartilhar. No celular: abrir o arquivo e permitir "instalar apps desconhecidos".

**Assinatura própria (recomendado se for distribuir):** gere uma chave uma única vez e guarde-a com segurança
```bash
keytool -genkey -v -keystore upload-keystore.jks -keyalg RSA -keysize 2048 -validity 10000 -alias upload
base64 -w0 upload-keystore.jks     # copie a saída
```
Em *Settings → Secrets → Actions* cadastre: `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`. Sem eles o APK sai com a chave de debug (instala, mas atualizações futuras só funcionam se vierem assinadas com a mesma chave).

Rodar localmente: `flutter pub get && flutter run` (ou `flutter build apk --release`).
Primeira abertura: **Perfil → Notificações e lembretes → Ativar lembretes** (permite notificações e alarmes) e use **Agendar em 15 s** com o app fechado para comprovar.
