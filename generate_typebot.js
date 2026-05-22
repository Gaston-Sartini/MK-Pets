/**
 * Genera el JSON del flow Typebot "mk-pets-vendedor" listo para insertarlo
 * en la BD del container typebot-db.
 *
 * Diseño del flow:
 *
 *   Start (event)
 *      ↓
 *   Group "Welcome"   →  bubble: ¡Hola! 🐾 ¿Qué buscás para tu mascota?
 *      ↓
 *   Group "Ask"       →  Text Input → guarda en {{userMessage}}
 *      ↓
 *   Group "Call n8n"  →  Webhook POST a n8n → guarda body en {{chatResponse}}
 *      ↓
 *   Group "Reply"     →  bubble: {{chatResponse.reply}}
 *      ↓
 *   Group "Render"    →  Custom Code (HTML/JS) → renderiza cards + suggestions
 *      ↓ (loop)
 *   Group "Ask"
 *
 * Output: docs/chat/_typebot-flow.json   (un solo JSON con groups, edges, variables, events)
 */
const fs   = require('fs');
const path = require('path');

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
// IDs sin guiones — Typebot inyecta variables al Code block usando el id como
// identifier de JS. Con guión queda `mkp-var-x` → syntax error.
const ID = {
  groupWelcome: 'mkpgrpwelcome001',
  groupAsk:     'mkpgrpask002',
  groupCall:    'mkpgrpcall003',
  groupReply:   'mkpgrpreply004',
  groupRender:  'mkpgrprender005',

  blkWelcome:   'mkpblkwelcomebubble',
  blkInput:     'mkpblktextinput',
  blkWebhook:   'mkpblkwebhook',
  blkReply:     'mkpblkreplybubble',
  blkRender:    'mkpblkrendercode',

  edgeStart:    'mkpedgestart',
  edgeW2A:      'mkpedgewelcometoask',
  edgeA2C:      'mkpedgeasktocall',
  edgeC2R:      'mkpedgecalltoreply',
  edgeR2D:      'mkpedgereplytorender',
  edgeD2A:      'mkpedgerendertoask',

  eventStart:   'mkpeventstart',

  varMessage:      'userMessage',
  varChatResponse: 'chatResponse',
  varReplyText:    'replyText',
  varSessionId:    'sessionId',
};

// Custom code para renderizar las cards (lo leemos del archivo del repo).
const customCode = fs.readFileSync(
  path.join(__dirname, 'docs', 'chat', 'typebot-custom-code.html'),
  'utf8'
);

// ─────────────────────────────────────────────────────────────────────────────
// Flow JSON (compatible con el schema 3.x de Typebot)
// ─────────────────────────────────────────────────────────────────────────────
const flow = {
  groups: [
    {
      id: ID.groupWelcome,
      title: 'Welcome',
      graphCoordinates: { x: 300, y: 50 },
      blocks: [
        {
          id: ID.blkWelcome,
          type: 'text',
          content: {
            richText: [
              {
                id: 'mkp-rich-welcome',
                type: 'p',
                children: [{ text: '¡Hola! 🐾 ¿Qué buscás para tu mascota?' }],
              },
            ],
          },
          outgoingEdgeId: ID.edgeW2A,
        },
      ],
    },
    {
      id: ID.groupAsk,
      title: 'Ask',
      graphCoordinates: { x: 300, y: 260 },
      blocks: [
        {
          id: ID.blkInput,
          type: 'text input',
          options: {
            variableId: ID.varMessage,
            labels: {
              placeholder: 'Escribí tu mensaje...',
              button: 'Enviar',
            },
            isLong: false,
          },
          outgoingEdgeId: ID.edgeA2C,
        },
      ],
    },
    {
      id: ID.groupCall,
      title: 'Call n8n',
      graphCoordinates: { x: 300, y: 480 },
      blocks: [
        {
          id: ID.blkWebhook,
          // Code (logic) block ejecutado server-side dentro del viewer.
          // Hace fetch a n8n y setea chatResponse + replyText.
          // Esto reemplaza al bloque "Webhook" que en Typebot 3.x emite
          // listenForWebhook (push pattern) en vez de hacer un GET/POST saliente.
          type: 'Code',
          options: {
            name: 'Call MK-Pets agent',
            // server-side ⇒ corre dentro del viewer Node.js (no en el browser),
            // ergo host.docker.internal:5678 resuelve y no hay CORS.
            isExecutedOnClient: false,
            content: [
              "// DEBUG: assignments al scope (Typebot puede capturar var names)",
              "chatResponse = { reply: 'TEST SERVER ✅', cards: [], suggestions: ['ok1','ok2'] };",
              "replyText = 'TEST SERVER ✅';",
            ].join('\n'),
            outputVariables: [
              { id: 'mkpoutchatResponse', name: 'chatResponse', variableId: ID.varChatResponse },
              { id: 'mkpoutreplyText',    name: 'replyText',    variableId: ID.varReplyText    },
            ],
          },
          outgoingEdgeId: ID.edgeC2R,
        },
      ],
    },
    {
      id: ID.groupReply,
      title: 'Reply',
      graphCoordinates: { x: 300, y: 700 },
      blocks: [
        {
          id: ID.blkReply,
          type: 'text',
          content: {
            richText: [
              {
                id: 'mkp-rich-reply',
                type: 'p',
                children: [{ text: '{{replyText}}' }],
              },
            ],
          },
          outgoingEdgeId: ID.edgeR2D,
        },
      ],
    },
    {
      id: ID.groupRender,
      title: 'Render cards',
      graphCoordinates: { x: 300, y: 900 },
      blocks: [
        {
          id: ID.blkRender,
          // Typebot 3.x: el block "Script" (logic) acepta "Code" (legacy) o "script"
          // según el sub-discriminator. "Code" es el que está históricamente
          // aceptado por el builder y el viewer 3.15.x.
          type: 'Code',
          options: {
            content: customCode,
          },
          outgoingEdgeId: ID.edgeD2A,
        },
      ],
    },
  ],

  edges: [
    {
      id: ID.edgeStart,
      from: { eventId: ID.eventStart },
      to:   { groupId: ID.groupWelcome, blockId: ID.blkWelcome },
    },
    {
      id: ID.edgeW2A,
      from: { blockId: ID.blkWelcome },
      to:   { groupId: ID.groupAsk, blockId: ID.blkInput },
    },
    {
      id: ID.edgeA2C,
      from: { blockId: ID.blkInput },
      to:   { groupId: ID.groupCall, blockId: ID.blkWebhook },
    },
    {
      id: ID.edgeC2R,
      from: { blockId: ID.blkWebhook },
      to:   { groupId: ID.groupReply, blockId: ID.blkReply },
    },
    {
      id: ID.edgeR2D,
      from: { blockId: ID.blkReply },
      to:   { groupId: ID.groupRender, blockId: ID.blkRender },
    },
    {
      id: ID.edgeD2A,
      from: { blockId: ID.blkRender },
      to:   { groupId: ID.groupAsk, blockId: ID.blkInput },
    },
  ],

  variables: [
    { id: ID.varMessage,      name: 'userMessage',  isSessionVariable: false },
    { id: ID.varChatResponse, name: 'chatResponse', isSessionVariable: true  },
    { id: ID.varReplyText,    name: 'replyText',    isSessionVariable: true  },
    { id: ID.varSessionId,    name: 'sessionId',    isSessionVariable: true  },
  ],

  events: [
    {
      id: ID.eventStart,
      type: 'start',
      outgoingEdgeId: ID.edgeStart,
      graphCoordinates: { x: 0, y: 0 },
    },
  ],
};

const outFile = path.join(__dirname, 'docs', 'chat', '_typebot-flow.json');
fs.writeFileSync(outFile, JSON.stringify(flow, null, 2));
console.log('Typebot flow JSON: ' + outFile);
console.log('Groups:', flow.groups.map(g => g.title).join(' → '));
