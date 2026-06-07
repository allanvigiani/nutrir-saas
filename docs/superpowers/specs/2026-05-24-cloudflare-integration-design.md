# Cloudflare Integration Design

**Data:** 2026-05-24  
**Status:** Aprovado  
**Motivação:** Segurança (DDoS, WAF, bots) e domínio/SSL profissional

---

## Contexto

O Nutrir SaaS é um monorepo Express + React SPA com backend em Node.js, banco PostgreSQL (Neon), autenticação via Firebase, e integração de pagamentos com Asaas (webhooks). O app será hospedado em VPS na Hostinger.

A adição do Cloudflare não requer mudanças nas rotas, serviços ou integrações existentes — apenas configuração de infraestrutura e um ajuste mínimo no Express.

---

## Arquitetura

```
Internet
    │
    ▼
Cloudflare Edge
  ├── DDoS mitigation (automático, plano Free)
  ├── WAF — ruleset gerenciado (OWASP Top 10, bots)
  ├── Cache — assets estáticos React (JS/CSS/fonts/imagens)
  └── SSL/TLS terminação (certificado Cloudflare)
    │
    ▼ (tráfego limpo — só IPs Cloudflare chegam ao VPS)
Hostinger VPS — Linux
  ├── ufw — firewall: aceita 80/443 apenas de IPs Cloudflare
  ├── Nginx — reverse proxy :80/:443 → Express :3000
  └── PM2 — gerenciador de processos Node.js
    │
    ▼
Express App (src/server/)
  ├── trust proxy configurado para IPs Cloudflare
  ├── express-rate-limit usando IP real (CF-Connecting-IP)
  └── Asaas webhooks validados pelo ASAAS_WEBHOOK_TOKEN (sem mudança)
    │
    ├── Neon (PostgreSQL) — não muda
    └── Firebase Auth — não muda
```

---

## Cloudflare — Configuração

### DNS
- Registros A para `@` (apex) e `www` apontando para o IP do VPS
- Proxy ativado (ícone laranja) em ambos os registros

### SSL/TLS
- Modo: **Full (strict)** — Cloudflare valida o certificado no VPS
- VPS: instalar certificado Let's Encrypt via `certbot` para a conexão Cloudflare → Nginx
- Ativar redirecionamento HTTP → HTTPS no painel Cloudflare

### Cache Rules
| Padrão | Comportamento | TTL |
|--------|--------------|-----|
| `*.js`, `*.css`, `*.woff2`, `*.png`, `*.jpg`, `*.svg` | Cache na borda | 30 dias |
| `/api/*` | Bypass cache | — |
| Qualquer rota com header `Authorization` | Bypass cache | — |
| Qualquer rota com cookie de sessão | Bypass cache | — |

### WAF
- Ativar ruleset gerenciado Cloudflare Free (cobre SQLi, XSS, path traversal)
- Regra customizada: bypass do WAF para o path `/api/payments/webhook` (o token `ASAAS_WEBHOOK_TOKEN` já garante autenticidade — o WAF não precisa inspecionar esse endpoint)
- Opcional: bloquear países fora do Brasil se o app for exclusivamente BR

### DDoS e Bots
- DDoS: ativado por padrão no plano Free, sem configuração adicional
- Bot Fight Mode: ativar no painel (bloqueia scrapers e crawlers maliciosos)

---

## VPS — Setup

### Stack de infraestrutura
```
Node.js 20 LTS
PM2 (gerenciador de processos: restart automático, logs, cluster mode)
Nginx (reverse proxy)
ufw (firewall)
certbot + Let's Encrypt
```

### Nginx — configuração essencial
```nginx
server {
    listen 80;
    server_name seudominio.com.br www.seudominio.com.br;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $http_cf_connecting_ip;
        proxy_set_header X-Forwarded-For $http_cf_connecting_ip;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

O header `CF-Connecting-IP` (enviado pelo Cloudflare) é repassado como `X-Forwarded-For`, garantindo que o Express receba o IP real do cliente.

### Firewall (ufw)
Bloquear todo tráfego direto — aceitar 80/443 apenas de IPs do Cloudflare:

```bash
ufw default deny incoming
ufw allow ssh
# IPs Cloudflare IPv4 (lista completa em https://www.cloudflare.com/ips-v4)
ufw allow from 103.21.244.0/22 to any port 80,443
ufw allow from 103.22.200.0/22 to any port 80,443
ufw allow from 103.31.4.0/22 to any port 80,443
ufw allow from 104.16.0.0/13 to any port 80,443
ufw allow from 104.24.0.0/14 to any port 80,443
ufw allow from 108.162.192.0/18 to any port 80,443
ufw allow from 131.0.72.0/22 to any port 80,443
ufw allow from 141.101.64.0/18 to any port 80,443
ufw allow from 162.158.0.0/15 to any port 80,443
ufw allow from 172.64.0.0/13 to any port 80,443
ufw allow from 173.245.48.0/20 to any port 80,443
ufw allow from 188.114.96.0/20 to any port 80,443
ufw allow from 190.93.240.0/20 to any port 80,443
ufw allow from 197.234.240.0/22 to any port 80,443
ufw allow from 198.41.128.0/17 to any port 80,443
ufw enable
```

---

## Código — Mudanças no Express

### `server.ts` — trust proxy

Adicionar antes do registro de rotas:

```typescript
// Confiar nos headers de IP repassados pelo Cloudflare via Nginx
app.set('trust proxy', 1);
```

Isso garante que `express-rate-limit` use o IP real do cliente (`req.ip` = `X-Forwarded-For`) e não o IP do Cloudflare.

### `.env` — nenhuma variável nova obrigatória

A validação dos webhooks do Asaas já usa `ASAAS_WEBHOOK_TOKEN` — não é necessário adicionar lógica de validação de IP do Cloudflare. O token é suficiente.

---

## O que não muda

| Componente | Status |
|-----------|--------|
| Rotas Express (`src/server/routes/`) | Sem mudança |
| Controllers e Services | Sem mudança |
| Firebase Auth (frontend + backend) | Funciona transparentemente pelo proxy |
| Asaas webhooks | Passam pelo Cloudflare normalmente; token já valida autenticidade |
| Neon (PostgreSQL) | Conexão direta do VPS, sem impacto |
| Vite build (`npm run build`) | Assets compilados servidos pelo Express, cacheados no Cloudflare |

---

## Benefícios esperados

| Benefício | Descrição |
|-----------|-----------|
| DDoS | Mitigação automática na borda, antes de chegar ao VPS |
| WAF | Bloqueia SQLi, XSS, path traversal e outros ataques comuns |
| Bot protection | Bot Fight Mode bloqueia scrapers e crawlers maliciosos |
| CDN | Assets React cacheados globalmente — carregamento mais rápido |
| SSL gratuito | Certificado Cloudflare sem custo, renovação automática |
| Proteção de IP | IP real do VPS fica oculto — ataques diretos impossibilitados |
| LGPD | Tráfego criptografado end-to-end; logs de acesso consolidados |

---

## Riscos e mitigações

| Risco | Mitigação |
|-------|-----------|
| WAF bloqueando webhooks Asaas | Criar regra de bypass por path `/api/payments/webhook`; token já valida autenticidade |
| IPs do Cloudflare desatualizados no ufw | Criar script de atualização automática via cron usando API `https://www.cloudflare.com/ips-v4` |
| `trust proxy` incorreto → rate limit por IP Cloudflare | Testar `req.ip` após deploy; deve retornar IP real do cliente |
| Modo SSL "Flexible" (erro comum) | Configurar explicitamente como "Full (strict)" — nunca "Flexible" |
