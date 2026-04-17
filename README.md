# Nutrir SaaS

Plataforma de gestao para nutricionistas com foco em atendimento de pacientes, agenda, financeiro e operacao de assinatura premium.

## O que o projeto faz

- Autenticacao de nutricionistas e area administrativa.
- Cadastro e acompanhamento de pacientes.
- Agenda de consultas com integracao ao Google Calendar.
- Modulo financeiro com registro de pagamentos e emissao de recibos em PDF.
- Envio de e-mails transacionais (boas-vindas, plano alimentar e recuperacao de senha).
- Assinatura premium com Asaas (checkout, validacao, cancelamento e webhook).

## Stack principal

- Frontend: React + TypeScript + Vite + Tailwind.
- Backend: Node.js + Express (mesmo repositorio, via `server.ts`).
- Banco e autenticacao: Firebase (Firestore, Auth, Storage).
- Integracoes: Asaas, Google Calendar e SMTP (Brevo/Nodemailer).

## Requisitos

- Node.js 20+ (recomendado).
- Conta/configuracao no Firebase.
- Credenciais para Asaas (se usar assinaturas).
- Credenciais Google OAuth (se usar Google Calendar).
- SMTP configurado (se usar envio de e-mail).

## Configuracao local

1. Instale as dependencias:

```bash
npm install
```

2. Crie um arquivo `.env` na raiz com as variaveis necessarias:

```env
GEMINI_API_KEY=

ASAAS_API_KEY=
ASAAS_API_URL=https://sandbox.asaas.com/api/v3
ASAAS_WEBHOOK_TOKEN=defina-um-token-forte
SUPER_ADMIN_EMAILS=admin@seudominio.com

GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM="Nutrir <seu-email@dominio.com>"

APP_URL=http://localhost:3000
```

3. Garanta que o arquivo `firebase-applet-config.json` esteja valido para seu projeto Firebase.

4. Rode a aplicacao:

```bash
npm run dev
```

A aplicacao sobe em `http://localhost:3000`.

## Scripts

- `npm run dev`: inicia servidor Express + Vite em modo desenvolvimento.
- `npm run build`: gera build de producao do frontend.
- `npm run preview`: serve o build do Vite para validacao local.
- `npm run start`: executa o servidor em modo runtime.
- `npm run lint`: verificacao de tipos com TypeScript.

## Estrutura resumida

- `src/pages`: telas da aplicacao (dashboard, pacientes, agenda, financeiro, etc).
- `src/components`: componentes de UI e layout.
- `src/contexts`: contexto de autenticacao e configuracoes.
- `src/lib`: clientes Firebase, utilitarios, e-mail e suporte.
- `server.ts`: API backend, webhooks e integracoes externas.
- `firestore.rules`: regras de seguranca do Firestore.
