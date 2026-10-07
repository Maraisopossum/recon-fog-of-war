import type { Store } from '../game/store';
import type { GameState } from '../game/types';

export type Message = { kind: 'state'; state: GameState } | { kind: 'hello' };

/** Transport interchangeable : le reste du jeu ne connaît que cette interface. */
export interface Transport {
  send(msg: Message): void;
  onMessage(fn: (msg: Message) => void): void;
  /** appelé à chaque (re)connexion */
  onOpen(fn: () => void): void;
  close(): void;
}

export function transportBroadcast(canal = 'recon-fog-of-war'): Transport {
  const bc = new BroadcastChannel(canal);
  let ouvert: (() => void) | null = null;
  return {
    send: (m) => bc.postMessage(m),
    onMessage: (fn) => (bc.onmessage = (e) => fn(e.data as Message)),
    onOpen: (fn) => {
      ouvert = fn;
      queueMicrotask(() => ouvert?.());
    },
    close: () => bc.close(),
  };
}

export function transportWebSocket(url: string): Transport {
  let ws: WebSocket;
  let fermé = false;
  let onMsg: (m: Message) => void = () => {};
  let onOuv: () => void = () => {};
  const file: string[] = [];
  const connecter = () => {
    ws = new WebSocket(url);
    ws.onopen = () => {
      file.splice(0).forEach((m) => ws.send(m));
      onOuv();
    };
    ws.onmessage = (e) => onMsg(JSON.parse(String(e.data)) as Message);
    ws.onclose = () => {
      if (!fermé) setTimeout(connecter, 1500);
    };
  };
  connecter();
  return {
    send: (m) => {
      const t = JSON.stringify(m);
      if (ws.readyState === WebSocket.OPEN) ws.send(t);
      else if (m.kind === 'hello') file.push(t);
    },
    onMessage: (fn) => (onMsg = fn),
    onOpen: (fn) => (onOuv = fn),
    close: () => {
      fermé = true;
      ws.close();
    },
  };
}

export function choisirTransport(params: URLSearchParams): Transport {
  const ws = params.get('ws');
  return ws ? transportWebSocket(ws) : transportBroadcast();
}

/** Le chef est l'autorité : il publie l'état complet à chaque changement et sur demande. */
export function brancherChef(store: Store, t: Transport) {
  const publier = () => t.send({ kind: 'state', state: store.get() });
  store.subscribe(publier);
  t.onMessage((m) => m.kind === 'hello' && publier());
  t.onOpen(publier);
}

/** La carte est en lecture seule : elle remplace son état par celui du chef. */
export function brancherCarte(store: Store, t: Transport) {
  t.onMessage((m) => m.kind === 'state' && store.dispatch({ type: 'replace', state: m.state }));
  t.onOpen(() => t.send({ kind: 'hello' }));
}
