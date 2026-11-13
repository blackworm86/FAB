/** The players' chat: the button in the top bar, the panel, and a banner for a new message while it is closed. */
import { online, sendChat, setChatListener, DEV_FAKE, TABLE, type ChatMsg } from './online';
import { ico } from './icons';
import { esc, nm } from './util';
import { reg } from './ui-kit';

let say: (t: string) => void = () => {},
  render: () => void = () => {};
const chatOn = () => online.mode === 'remote' || DEV_FAKE;
let chatOpen = false,
  chatDraft = '',
  chatSeen = (() => {
    try {
      return Number(localStorage.getItem('fab-chat-seen-' + TABLE) ?? 0);
    } catch {
      return 0;
    }
  })();
const QUICK = ['Your turn', 'Ready', 'One moment', 'Nice move', 'Good game'];
const unread = () => online.chat.filter((m) => m.t > chatSeen && m.uid !== online.uid).length;
const markSeen = () => {
  const last = online.chat.at(-1)?.t ?? 0;
  if (last > chatSeen) {
    chatSeen = last;
    try {
      localStorage.setItem('fab-chat-seen-' + TABLE, String(last));
    } catch {
      /* private mode */
    }
  }
};
let chatKnown = -1;
/** Start listening: a short banner for a new message while the chat is closed. */
export function initChat(sayFn: (t: string) => void, renderFn: () => void) {
  say = sayFn;
  render = renderFn;
  setChatListener((m: ChatMsg[]) => {
    // a short banner for a new message while the chat is closed
    const fresh = chatKnown < 0 ? [] : m.filter((x) => x.t > chatKnown && x.uid !== online.uid);
    chatKnown = Math.max(chatKnown, m.at(-1)?.t ?? 0);
    if (chatOpen) {
      markSeen();
      const l = document.getElementById('chat-list');
      if (l) {
        l.innerHTML = chatRows();
        l.scrollTop = l.scrollHeight;
      }
    } else if (fresh.length) {
      const x = fresh.at(-1)!;
      say(`${nm(x.side)}: ${x.text}`);
    }
  });
}
async function chatSend(text: string) {
  const e = await sendChat(text);
  if (e) {
    say(/permission/i.test(e) ? "Chat not allowed by the database: the game's security rules need publishing (Admin > Update rules)." : e);
    render();
  } else {
    chatDraft = '';
    const i = document.getElementById('chat-in') as HTMLInputElement | null;
    if (i) i.value = '';
  }
}
export function chatBtn() {
  if (!chatOn()) return '';
  const n = unread();
  return `<button class="ico chatbtn ${chatOpen ? 'on' : ''}" data-ui="${reg(() => {
    chatOpen = !chatOpen;
    if (chatOpen) markSeen();
  })}" title="Chat" aria-label="Chat${n ? `, ${n} new` : ''}">${ico('chat')}${n ? `<i class="unread">${n > 9 ? '9+' : n}</i>` : ''}<span class="bl">Chat</span></button>`;
}
function chatRows() {
  const time = (t: number) => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return (
    online.chat
      .map(
        (m) =>
          `<div class="cm ${m.side} ${m.uid === online.uid ? 'me' : ''}"><small>${m.name && m.name.toLowerCase() !== m.side ? `<b>${esc(m.name)}</b> · ` : ''}<span class="sd">${nm(m.side)}</span> · ${time(m.t)}</small><p>${esc(m.text)}</p></div>`,
      )
      .join('') || '<p class="hint">No messages yet.</p>'
  );
}
export function chatHtml() {
  if (!chatOn() || !chatOpen) return '';
  const me = online.mySide(),
    rows = chatRows();
  return `<aside class="chat" aria-label="Chat"><div class="chead"><b>${ico('chat')} Chat</b><button class="ico" data-ui="${reg(() => {
    chatOpen = false;
  })}" aria-label="Close chat">${ico('close')}</button></div>
    <div class="clist" id="chat-list">${rows}</div>
    ${
      me
        ? `<div class="cquick">${QUICK.map(
            (q) =>
              `<button data-ui="${reg(() => {
                void chatSend(q);
              })}">${q}</button>`,
          ).join('')}</div>
    <div class="cin authform"><input id="chat-in" maxlength="300" placeholder="Message to your opponent" value="${esc(chatDraft)}" autocomplete="off" enterkeyhint="send"><button class="primary" id="chat-send" aria-label="Send">${ico('next')}</button></div>`
        : '<p class="hint cwatch">You are watching: only the two players can write.</p>'
    }</aside>`;
}
/** Wire the chat panel after a redraw. */
export function bindChat(ui: HTMLElement) {
  const i = ui.querySelector<HTMLInputElement>('#chat-in'),
    b = ui.querySelector<HTMLElement>('#chat-send'),
    l = ui.querySelector<HTMLElement>('#chat-list');
  if (l) l.scrollTop = l.scrollHeight;
  if (i) {
    i.oninput = () => {
      chatDraft = i.value;
    };
    i.onkeydown = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        void chatSend(i.value);
      }
    };
  }
  if (b && i)
    b.onclick = () => {
      void chatSend(i.value);
    };
}
