// Relais WebSocket pour le mode double écran sur deux appareils.
// Usage : npm run sync-server   puis ?mode=chef&ws=ws://IP:8787 et ?mode=carte&ws=ws://IP:8787
import { WebSocketServer } from 'ws';

const port = Number(process.env.PORT ?? 8787);
const wss = new WebSocketServer({ port });
let dernierEtat = null;

wss.on('connection', (ws) => {
  ws.on('message', (data) => {
    const texte = String(data);
    let msg;
    try {
      msg = JSON.parse(texte);
    } catch {
      return;
    }
    if (msg.kind === 'state') dernierEtat = texte;
    // Une carte qui se connecte demande l'état : on répond avec le dernier connu, et on relaie au chef.
    if (msg.kind === 'hello' && dernierEtat) ws.send(dernierEtat);
    for (const c of wss.clients) if (c !== ws && c.readyState === 1) c.send(texte);
  });
});

console.log(`Relais de synchronisation sur ws://0.0.0.0:${port}`);
