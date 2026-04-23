# Gestor Financeiro

PWA mobile-first em Next.js 15 para controlar receitas, despesas, orçamentos mensais e transações recorrentes no dia a dia.

## Stack

- **Next.js 15** (App Router, Server Actions) + **TypeScript**
- **Tailwind CSS** + componentes shadcn-style + **Recharts**
- **Drizzle ORM** + **Turso** (libSQL / SQLite na nuvem)
- **Auth.js v5** (NextAuth 5) com Credentials (e-mail + senha, bcrypt)
- PWA com manifest + service worker (instalável no celular, cache offline)

## Funcionalidades

- Cadastro e login por e-mail/senha
- Lançamentos de receita e despesa com categorias coloridas
- Orçamento mensal por categoria (com alerta visual em 80%/100%)
- Transações recorrentes (mensal ou semanal) — geradas automaticamente
- Dashboard com saldo do mês, evolução dos últimos 6 meses e gastos por categoria
- Navegação em bottom-tab, pronta para instalação como app no celular

## Configuração local

1. **Instalar dependências**
   ```bash
   npm install
   ```

2. **Criar `.env.local`** copiando `.env.example`:
   ```bash
   cp .env.example .env.local
   # Gere um segredo:
   openssl rand -base64 32
   # Cole em AUTH_SECRET no .env.local
   ```

3. **Criar schema no banco local** (arquivo `local.db`):
   ```bash
   npm run db:push
   ```

4. **Rodar em desenvolvimento**:
   ```bash
   npm run dev
   ```
   Abra http://localhost:3000 e clique em "Criar conta".

## Deploy

### Banco — Turso

```bash
turso db create gestor-financeiro
turso db show gestor-financeiro --url
turso db tokens create gestor-financeiro
```

Salve a URL em `TURSO_DATABASE_URL` e o token em `TURSO_AUTH_TOKEN`.

Aplique o schema:
```bash
TURSO_DATABASE_URL=libsql://... TURSO_AUTH_TOKEN=... npm run db:push
```

### Hospedagem — Vercel

1. Push do repositório para o GitHub e importe na Vercel.
2. Adicione as variáveis de ambiente: `AUTH_SECRET`, `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, `RECURRING_CRON_SECRET`.
3. O arquivo `vercel.json` agenda o cron diário em `/api/recurring/run` às 06:00 UTC.
4. Configure o cron para enviar o header `x-cron-secret: <RECURRING_CRON_SECRET>` (Vercel Cron autentica automaticamente pela URL do projeto; se preferir validar extra, ajuste o handler).

## Scripts

| Comando              | Descrição                                      |
| -------------------- | ----------------------------------------------- |
| `npm run dev`        | Servidor de desenvolvimento                     |
| `npm run build`      | Build de produção                               |
| `npm run start`      | Rodar build de produção                         |
| `npm run typecheck`  | `tsc --noEmit`                                  |
| `npm run db:generate`| Gera migration SQL do schema Drizzle            |
| `npm run db:push`    | Aplica o schema direto no banco                 |
| `npm run db:studio`  | Abre o Drizzle Studio para inspecionar dados    |

## Estrutura

```
src/
├─ app/
│  ├─ (auth)/              # /login, /signup
│  ├─ (app)/               # rotas protegidas: dashboard, transactions, budgets, recurring, categories
│  └─ api/                 # auth + cron de recorrências
├─ components/             # UI, gráficos, navegação
├─ db/                     # schema Drizzle + migrations
├─ lib/                    # auth, money, dates, recurring
└─ server/actions/         # Server Actions (CRUD)
```

## Licença

MIT
