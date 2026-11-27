# MedSync — Site (React + Vite + TypeScript)

```bash
cp .env.example .env     # VITE_API_URL
npm install
npm run dev              # http://localhost:5173
npm run build            # tsc + vite build  (deploy: Vercel, veja vercel.json)
```

Acessibilidade (3 trilhas com graus): veja `../../docs/ACESSIBILIDADE.md`.
Rotas por hash (`#dashboard`, `#medications`…): o clique numa notificação abre a tela certa e o refresh não perde a página.
O service worker (`public/sw.js`) recebe os pushes e mantém o app abrindo offline; `manifest.webmanifest` permite instalar o site como app (PWA).
