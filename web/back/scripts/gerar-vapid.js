// Gera o par de chaves VAPID usado pelo Web Push.
// Uso:  npm run gerar-vapid   → copie as duas linhas para o .env do servidor.
const webpush = require('web-push');
const chaves = webpush.generateVAPIDKeys();
console.log('\nCole no .env (e nas variáveis de ambiente do Render):\n');
console.log(`VAPID_PUBLIC_KEY=${chaves.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${chaves.privateKey}`);
console.log('VAPID_SUBJECT=mailto:seu-email@exemplo.com\n');
console.log('A chave PRIVADA é secreta: nunca envie para o GitHub.\n');
