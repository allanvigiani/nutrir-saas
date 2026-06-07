# Cloudflare Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Colocar o Nutrir SaaS em produção num VPS Hostinger com Cloudflare como proxy/CDN/WAF na frente, garantindo DDoS mitigation, WAF, SSL e cache de assets estáticos.

**Architecture:** Cloudflare Edge → Nginx (VPS) → Express :3000. O ufw bloqueia tráfego direto — apenas IPs do Cloudflare chegam ao Nginx. Express já tem `trust proxy: true`, então `req.ip` retorna o IP real do cliente via `X-Forwarded-For`.

**Tech Stack:** Node.js 20 LTS, PM2, Nginx, certbot (Let's Encrypt), ufw, Cloudflare Free

---

> **Observação:** O `app.set("trust proxy", true)` já está configurado em `server.ts`. Não há mudança de código necessária — o plano é 100% infraestrutura.

---

### Task 1: Provisionar VPS na Hostinger

**Files:** nenhum arquivo do repositório é modificado nesta task.

- [ ] **Step 1: Criar VPS na Hostinger**

  No painel da Hostinger, criar um VPS com:
  - SO: Ubuntu 24.04 LTS
  - Mínimo: 2 vCPU, 4 GB RAM (plano KVM 2 ou equivalente)
  - Região: América do Sul (São Paulo, se disponível)
  - Anotar o IP público do VPS (será usado nas próximas tasks)

- [ ] **Step 2: Acessar o VPS via SSH**

  ```bash
  ssh root@<IP_DO_VPS>
  ```

  Esperado: prompt do Ubuntu.

- [ ] **Step 3: Atualizar o sistema**

  ```bash
  apt update && apt upgrade -y
  ```

  Esperado: pacotes atualizados sem erros.

- [ ] **Step 4: Instalar Node.js 20 LTS via NodeSource**

  ```bash
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt install -y nodejs
  node --version
  npm --version
  ```

  Esperado: `v20.x.x` e `10.x.x` (ou superiores).

- [ ] **Step 5: Instalar PM2 e tsx globalmente**

  ```bash
  npm install -g pm2 tsx
  pm2 --version
  tsx --version
  ```

  Esperado: versões do PM2 e tsx impressas. tsx é necessário para rodar `server.ts` diretamente em produção.

- [ ] **Step 6: Criar usuário não-root para a aplicação**

  ```bash
  adduser --disabled-password --gecos "" nutrir
  usermod -aG sudo nutrir
  ```

  Esperado: usuário `nutrir` criado sem senha (usará SSH keys do root por ora).

---

### Task 2: Deploy da aplicação no VPS

**Files:** nenhum arquivo do repositório é modificado — apenas o servidor.

- [ ] **Step 1: Clonar o repositório (como usuário nutrir)**

  ```bash
  su - nutrir
  git clone https://github.com/<SEU_ORG>/nutrir-saas.git /home/nutrir/app
  cd /home/nutrir/app
  ```

  Substituir `<SEU_ORG>` pelo org/usuário real do GitHub.

- [ ] **Step 2: Instalar dependências**

  ```bash
  npm install
  ```

  Esperado: `node_modules/` criado sem erros.

- [ ] **Step 3: Criar o arquivo `.env` de produção**

  ```bash
  cp .env.example .env
  nano .env
  ```

  Preencher todas as variáveis obrigatórias:
  ```env
  NODE_ENV=production
  APP_URL=https://seudominio.com.br

  # Firebase Admin SDK
  FIREBASE_SERVICE_ACCOUNT={"type":"service_account","project_id":"..."}

  # PostgreSQL Neon
  DATABASE_URL=postgresql://user:pass@host/db?sslmode=require

  # Asaas
  ASAAS_API_KEY=...
  ASAAS_API_URL=https://api.asaas.com/api/v3
  ASAAS_WEBHOOK_TOKEN=...

  # Gemini
  GEMINI_API_KEY=...

  # SMTP (Brevo)
  SMTP_HOST=smtp-relay.brevo.com
  SMTP_PORT=587
  SMTP_USER=...
  SMTP_PASS=...
  SMTP_FROM=noreply@seudominio.com.br

  # Google Calendar
  GOOGLE_CALENDAR_CLIENT_ID=...
  GOOGLE_CALENDAR_CLIENT_SECRET=...

  # Segurança (LGPD)
  ENCRYPTION_KEY=<gere com: openssl rand -hex 32>

  # Super admin
  SUPER_ADMIN_EMAILS=vigianiallan@gmail.com
  ```

- [ ] **Step 4: Build do frontend**

  ```bash
  npm run build
  ```

  Esperado: diretório `dist/` criado com `index.html` e assets.

- [ ] **Step 5: Criar arquivo de ecossistema PM2**

  Criar `/home/nutrir/app/ecosystem.config.cjs`:

  ```javascript
  module.exports = {
    apps: [{
      name: 'nutrir-saas',
      script: 'server.ts',
      interpreter: 'tsx',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
    }],
  };
  ```

- [ ] **Step 6: Iniciar a aplicação com PM2**

  ```bash
  pm2 start ecosystem.config.cjs
  pm2 save
  pm2 startup
  ```

  Copiar e executar o comando gerado pelo `pm2 startup` (ex: `sudo env PATH=...`).

- [ ] **Step 7: Verificar que o app está respondendo localmente**

  ```bash
  curl -s http://localhost:3000/api/health || curl -s -o /dev/null -w "%{http_code}" http://localhost:3000
  ```

  Esperado: código HTTP 200 ou resposta JSON.

---

### Task 3: Configurar Nginx como reverse proxy

**Files:** `/etc/nginx/sites-available/nutrir-saas` (novo, no servidor)

- [ ] **Step 1: Instalar Nginx**

  ```bash
  sudo apt install -y nginx
  nginx -v
  ```

  Esperado: `nginx version: nginx/1.xx.x`.

- [ ] **Step 2: Criar o arquivo de configuração do site**

  ```bash
  sudo nano /etc/nginx/sites-available/nutrir-saas
  ```

  Conteúdo:

  ```nginx
  server {
      listen 80;
      server_name seudominio.com.br www.seudominio.com.br;

      # Tamanho máximo de upload (para exportação de dados, PDFs)
      client_max_body_size 20M;

      location / {
          proxy_pass http://localhost:3000;
          proxy_http_version 1.1;
          proxy_set_header Upgrade $http_upgrade;
          proxy_set_header Connection 'upgrade';
          proxy_set_header Host $host;
          # Repassa o IP real do cliente enviado pelo Cloudflare
          proxy_set_header X-Real-IP $http_cf_connecting_ip;
          proxy_set_header X-Forwarded-For $http_cf_connecting_ip;
          proxy_set_header X-Forwarded-Proto $scheme;
          proxy_cache_bypass $http_upgrade;
          proxy_read_timeout 300s;
          proxy_connect_timeout 75s;
      }
  }
  ```

  Substituir `seudominio.com.br` pelo domínio real.

- [ ] **Step 3: Ativar o site e desativar o default**

  ```bash
  sudo ln -s /etc/nginx/sites-available/nutrir-saas /etc/nginx/sites-enabled/
  sudo rm -f /etc/nginx/sites-enabled/default
  ```

- [ ] **Step 4: Testar a configuração e reiniciar Nginx**

  ```bash
  sudo nginx -t
  sudo systemctl restart nginx
  sudo systemctl status nginx
  ```

  Esperado: `nginx -t` retorna `syntax is ok` e `test is successful`. Status: `active (running)`.

- [ ] **Step 5: Verificar acesso via Nginx**

  ```bash
  curl -s -o /dev/null -w "%{http_code}" http://localhost:80
  ```

  Esperado: `200` (ou `301`/`302` se já houver redirect).

---

### Task 4: Instalar SSL com certbot (Let's Encrypt)

> O certificado é necessário para o modo Cloudflare **Full (strict)**. Ele cobre a conexão Cloudflare → VPS, não o cliente → Cloudflare (esse é o certificado da própria Cloudflare).
>
> **Pré-requisito de ordem:** Execute os Steps 1-3 da Task 6 (adicionar domínio ao Cloudflare e configurar DNS com proxy **desativado** — ícone cinza) antes desta task. O certbot precisa que o domínio resolva diretamente para o IP do VPS para validar o desafio HTTP. Após a conclusão desta task, volte à Task 6 Step 4 para ativar o proxy (ícone laranja).

**Files:** configuração Nginx é modificada automaticamente pelo certbot.

- [ ] **Step 1: Instalar certbot**

  ```bash
  sudo apt install -y certbot python3-certbot-nginx
  certbot --version
  ```

  Esperado: versão do certbot impressa.

- [ ] **Step 2: Obter o certificado**

  > **Pré-requisito:** o DNS do domínio já deve apontar para o IP do VPS (pode ser temporariamente sem proxy Cloudflare — "modo cinza" — para que o certbot valide o domínio).

  ```bash
  sudo certbot --nginx -d seudominio.com.br -d www.seudominio.com.br \
    --non-interactive --agree-tos -m vigianiallan@gmail.com
  ```

  Esperado: `Successfully deployed certificate for seudominio.com.br`.

- [ ] **Step 3: Verificar renovação automática**

  ```bash
  sudo certbot renew --dry-run
  ```

  Esperado: `Simulating renewal of an existing certificate` sem erros.

- [ ] **Step 4: Testar HTTPS local**

  ```bash
  curl -s -o /dev/null -w "%{http_code}" https://seudominio.com.br
  ```

  Esperado: `200`.

---

### Task 5: Configurar firewall ufw (bloquear acesso direto ao VPS)

> Esta task garante que apenas IPs do Cloudflare chegam ao Nginx — impossibilitando bypass do WAF.

**Files:** nenhum arquivo do repositório é modificado.

- [ ] **Step 1: Instalar e habilitar ufw**

  ```bash
  sudo apt install -y ufw
  sudo ufw default deny incoming
  sudo ufw default allow outgoing
  sudo ufw allow ssh
  ```

- [ ] **Step 2: Adicionar IPs do Cloudflare (IPv4)**

  Executar o script abaixo para adicionar todos os CIDRs atuais do Cloudflare:

  ```bash
  for ip in \
    103.21.244.0/22 \
    103.22.200.0/22 \
    103.31.4.0/22 \
    104.16.0.0/13 \
    104.24.0.0/14 \
    108.162.192.0/18 \
    131.0.72.0/22 \
    141.101.64.0/18 \
    162.158.0.0/15 \
    172.64.0.0/13 \
    173.245.48.0/20 \
    188.114.96.0/20 \
    190.93.240.0/20 \
    197.234.240.0/22 \
    198.41.128.0/17; do
    sudo ufw allow from $ip to any port 80,443 proto tcp
  done
  ```

- [ ] **Step 3: Adicionar IPs do Cloudflare (IPv6)**

  ```bash
  for ip in \
    2400:cb00::/32 \
    2606:4700::/32 \
    2803:f800::/32 \
    2405:b500::/32 \
    2405:8100::/32 \
    2a06:98c0::/29 \
    2c0f:f248::/32; do
    sudo ufw allow from $ip to any port 80,443 proto tcp
  done
  ```

- [ ] **Step 4: Habilitar o firewall**

  ```bash
  sudo ufw enable
  sudo ufw status verbose
  ```

  Esperado: lista de regras com todos os CIDRs do Cloudflare e porta SSH aberta.

- [ ] **Step 5: Criar script de atualização automática dos IPs Cloudflare**

  Criar `/home/nutrir/update-cloudflare-ips.sh`:

  ```bash
  #!/bin/bash
  # Atualiza as regras ufw com os IPs mais recentes do Cloudflare
  # Executar via cron mensalmente: 0 0 1 * * /home/nutrir/update-cloudflare-ips.sh

  # Remove regras antigas dos CIDRs Cloudflare (portas 80 e 443)
  sudo ufw status numbered | grep -E '(80,443|80|443)' | awk '{print $2}' | \
    sort -rn | xargs -I{} sudo ufw delete {}

  # Adiciona IPs atuais (IPv4)
  for ip in $(curl -s https://www.cloudflare.com/ips-v4); do
    sudo ufw allow from $ip to any port 80,443 proto tcp
  done

  # Adiciona IPs atuais (IPv6)
  for ip in $(curl -s https://www.cloudflare.com/ips-v6); do
    sudo ufw allow from $ip to any port 80,443 proto tcp
  done

  sudo ufw reload
  echo "IPs Cloudflare atualizados em $(date)"
  ```

  ```bash
  chmod +x /home/nutrir/update-cloudflare-ips.sh
  # Adicionar ao cron (executa no dia 1 de cada mês)
  (crontab -l 2>/dev/null; echo "0 0 1 * * /home/nutrir/update-cloudflare-ips.sh >> /var/log/cf-ip-update.log 2>&1") | crontab -
  ```

---

### Task 6: Adicionar domínio ao Cloudflare e configurar DNS

> Todos os passos desta task são no painel web da Cloudflare (cloudflare.com).
>
> **Ordem especial:** Execute os Steps 1-3 desta task ANTES da Task 4 (certbot), com proxy **desativado** (ícone cinza). Após concluir a Task 4, execute o Step 4 para ativar o proxy.

- [ ] **Step 1: Criar conta e adicionar o domínio**

  1. Acesse cloudflare.com → "Add a site"
  2. Digite `seudominio.com.br` → selecione plano **Free**
  3. O Cloudflare vai escanear os registros DNS existentes automaticamente

- [ ] **Step 2: Configurar registros DNS**

  No painel DNS do Cloudflare, verificar/criar:

  | Tipo | Nome | Conteúdo | Proxy |
  |------|------|----------|-------|
  | Tipo | Nome | Conteúdo | Proxy inicial |
  |------|------|----------|--------------|
  | A | `@` | `<IP_DO_VPS>` | **Desativado (cinza)** por enquanto |
  | A | `www` | `<IP_DO_VPS>` | **Desativado (cinza)** por enquanto |
  | MX | `@` | registros do seu provedor de email | DNS only (cinza) |

  > Manter proxy **desativado** (cinza) até a conclusão da Task 4 (certbot).

- [ ] **Step 4: Ativar proxy Cloudflare (SOMENTE após Task 4 concluída)**

  Voltar ao painel DNS do Cloudflare e alterar os registros A para proxy **ativado** (laranja):

  | Tipo | Nome | Proxy |
  |------|------|-------|
  | A | `@` | Ativado (laranja) |
  | A | `www` | Ativado (laranja) |

  > **Importante:** Com proxy ativo, o IP do VPS fica oculto. Apenas IPs do Cloudflare aparecem no DNS.

- [ ] **Step 3: Atualizar os nameservers no registrador do domínio**

  O Cloudflare vai mostrar dois nameservers (ex: `aria.ns.cloudflare.com`, `bob.ns.cloudflare.com`).
  Acesse o painel do registrador do domínio (registro.br ou outro) e substitua os nameservers pelos do Cloudflare.

  Propagação pode levar até 24h. Verificar com:
  ```bash
  dig NS seudominio.com.br
  ```
  Esperado: os nameservers listados são os do Cloudflare.

---

### Task 7: Configurar SSL/TLS no Cloudflare

> Painel Cloudflare → SSL/TLS → Overview

- [ ] **Step 1: Definir modo de criptografia**

  Selecionar: **Full (strict)**

  > Nunca selecionar "Flexible" — com Flexible o Cloudflare aceita qualquer certificado no servidor, o que anula a segurança end-to-end.

- [ ] **Step 2: Ativar "Always Use HTTPS"**

  SSL/TLS → Edge Certificates → "Always Use HTTPS" → **On**

  Isso força redirect de HTTP para HTTPS na borda do Cloudflare.

- [ ] **Step 3: Ativar "Automatic HTTPS Rewrites"**

  SSL/TLS → Edge Certificates → "Automatic HTTPS Rewrites" → **On**

  Converte links `http://` em conteúdo da página para `https://` automaticamente.

- [ ] **Step 4: Verificar certificado ativo**

  SSL/TLS → Edge Certificates → verificar que o certificado da Cloudflare está com status **Active**.

---

### Task 8: Configurar Cache Rules no Cloudflare

> Painel Cloudflare → Caching → Cache Rules → "Create rule"

- [ ] **Step 1: Regra — cache de assets estáticos**

  Criar regra com nome `Static Assets`:

  ```
  Condição:
    File extension — equals — js, css, woff, woff2, ttf, eot, svg, png, jpg, jpeg, gif, ico, webp

  Ação:
    Eligible for cache: ON
    Edge TTL: Ignore cache-control header and use this TTL → 30 days
    Browser TTL: Respect existing headers
  ```

- [ ] **Step 2: Regra — bypass de cache para API**

  Criar regra com nome `API No Cache` (com prioridade maior que a anterior):

  ```
  Condição:
    URI Path — starts with — /api/

  Ação:
    Eligible for cache: OFF (Bypass)
  ```

- [ ] **Step 3: Regra — bypass de cache para rotas autenticadas**

  Criar regra com nome `Auth No Cache`:

  ```
  Condição:
    Request Header — Authorization — exists
    OR
    Cookie — exists

  Ação:
    Eligible for cache: OFF (Bypass)
  ```

  > **Ordem das regras** (mais específica primeiro): API No Cache → Auth No Cache → Static Assets.

---

### Task 9: Configurar WAF e segurança no Cloudflare

> Painel Cloudflare → Security

- [ ] **Step 1: Ativar ruleset gerenciado do Cloudflare Free**

  Security → WAF → Managed Rules → ativar **Cloudflare Free Managed Ruleset**

  Isso habilita proteção contra SQLi, XSS, path traversal, e outros ataques do OWASP Top 10.

- [ ] **Step 2: Criar regra de bypass do WAF para o webhook do Asaas**

  Security → WAF → Custom Rules → "Create rule":

  ```
  Nome: Asaas Webhook Bypass
  
  Condição:
    URI Path — equals — /api/asaas-webhook
  
  Ação:
    Skip → Skip all remaining custom rules
    Also skip: Managed rules (WAF)
  ```

  > O `ASAAS_WEBHOOK_TOKEN` já valida a autenticidade do webhook na camada da aplicação — o WAF não precisa inspecionar esse endpoint.

- [ ] **Step 3: Ativar Bot Fight Mode**

  Security → Bots → Bot Fight Mode → **On**

  Bloqueia scrapers e crawlers maliciosos automaticamente.

- [ ] **Step 4: Configurar Security Level**

  Security → Settings → Security Level → **Medium**

  (Balanceia proteção sem bloquear usuários legítimos.)

- [ ] **Step 5: Ativar "Browser Integrity Check"**

  Security → Settings → Browser Integrity Check → **On**

---

### Task 10: Verificação end-to-end

- [ ] **Step 1: Verificar que o site carrega via Cloudflare**

  ```bash
  curl -s -I https://seudominio.com.br | grep -E "server:|cf-ray:|x-cache:"
  ```

  Esperado: cabeçalho `cf-ray:` presente (confirma que passou pelo Cloudflare).

- [ ] **Step 2: Verificar que o IP do VPS não está exposto**

  ```bash
  curl -s https://ifconfig.me  # execute do seu computador
  # Compare com o IP do VPS — deve ser diferente do que resolve o domínio
  dig +short seudominio.com.br
  ```

  Esperado: o IP retornado pelo DNS é um IP do Cloudflare, não o IP do VPS.

- [ ] **Step 3: Verificar que acesso direto ao VPS está bloqueado**

  ```bash
  curl -v http://<IP_DO_VPS>
  ```

  Esperado: conexão recusada (`Connection refused` ou timeout) — o ufw bloqueia acesso direto.

- [ ] **Step 4: Verificar que req.ip retorna IP real do cliente**

  Adicionar temporariamente uma rota de debug (remover após verificação):

  ```bash
  # No VPS, editar server.ts e adicionar antes de registerApiRoutes:
  # app.get('/api/debug-ip', (req, res) => res.json({ ip: req.ip, ips: req.ips }));
  # Reiniciar: pm2 restart nutrir-saas

  curl https://seudominio.com.br/api/debug-ip
  ```

  Esperado: `req.ip` retorna seu IP real (não um IP do Cloudflare como `104.x.x.x`).

  Remover a rota de debug após verificação:
  ```bash
  pm2 restart nutrir-saas
  ```

- [ ] **Step 5: Verificar assets estáticos com cache**

  ```bash
  curl -s -I https://seudominio.com.br/assets/index-XXXXX.js | grep -i "cf-cache-status"
  ```

  Esperado: `cf-cache-status: HIT` ou `MISS` na primeira requisição, `HIT` nas subsequentes.

- [ ] **Step 6: Verificar webhook Asaas (se disponível)**

  No painel Asaas, acionar um evento de teste de webhook apontando para `https://seudominio.com.br/api/asaas-webhook`.

  Esperado: webhook processado com sucesso (status 200 nos logs do PM2).

  Verificar logs:
  ```bash
  pm2 logs nutrir-saas --lines 50
  ```

- [ ] **Step 7: Verificar que o WAF está ativo**

  Tentar uma requisição maliciosa simples:

  ```bash
  curl -s -o /dev/null -w "%{http_code}" \
    "https://seudominio.com.br/api/patients?id=1;DROP TABLE users--"
  ```

  Esperado: `403` (bloqueado pelo WAF).

- [ ] **Step 8: Commit da documentação de infraestrutura**

  ```bash
  git add docs/superpowers/specs/2026-05-24-cloudflare-integration-design.md
  git add docs/superpowers/plans/2026-05-24-cloudflare-integration.md
  git commit -m "docs: add Cloudflare + VPS infrastructure spec and implementation plan"
  ```

---

## Referências

- [IPs do Cloudflare (IPv4)](https://www.cloudflare.com/ips-v4)
- [IPs do Cloudflare (IPv6)](https://www.cloudflare.com/ips-v6)
- [Cloudflare Full (strict) SSL mode](https://developers.cloudflare.com/ssl/origin-configuration/ssl-modes/full-strict/)
- [PM2 Ecosystem File](https://pm2.keymetrics.io/docs/usage/application-declaration/)
- [certbot Nginx plugin](https://certbot.eff.org/instructions?os=ubuntufocal&certbot-nginx)
