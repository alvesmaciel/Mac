-- ═══════════════════════════════════════════════════════════════
--  ChatFinance — Supabase Schema
--  Execute este arquivo no SQL Editor do Supabase
--  Ordem: extensions → tables → indexes → RLS → triggers
-- ═══════════════════════════════════════════════════════════════

-- ── Extensions ──────────────────────────────────────────────────
create extension if not exists "uuid-ossp";


-- ═══════════════════════════════════════════════════════════════
--  TABELA: profiles
--  Dados extras do usuário (além do auth.users padrão do Supabase)
-- ═══════════════════════════════════════════════════════════════
create table public.profiles (
    id          uuid        primary key references auth.users(id) on delete cascade,
    name        text        not null default '',
    avatar_url  text,
    plan        text        not null default 'free' check (plan in ('free', 'pro')),
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now()
);

comment on table public.profiles is 'Dados extras do usuário ligados ao auth.users';


-- ═══════════════════════════════════════════════════════════════
--  TABELA: workspaces
--  Espaços financeiros do usuário (ex: Geral, Casa, Empresa)
-- ═══════════════════════════════════════════════════════════════
create table public.workspaces (
    id          uuid        primary key default uuid_generate_v4(),
    user_id     uuid        not null references public.profiles(id) on delete cascade,
    name        text        not null,
    icon        text        not null default '🏠',
    is_default  boolean     not null default false,
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now()
);

comment on table public.workspaces is 'Espaços financeiros por usuário';

-- Garante que cada usuário só tem 1 workspace marcado como padrão
create unique index workspaces_one_default_per_user
    on public.workspaces (user_id)
    where is_default = true;


-- ═══════════════════════════════════════════════════════════════
--  TABELA: transactions
--  Todas as transações financeiras
-- ═══════════════════════════════════════════════════════════════
create table public.transactions (
    id                  uuid        primary key default uuid_generate_v4(),
    workspace_id        uuid        not null references public.workspaces(id) on delete cascade,
    user_id             uuid        not null references public.profiles(id) on delete cascade,

    type                text        not null check (type in ('income', 'expense', 'debt', 'receivable')),
    value               numeric(12,2) not null check (value >= 0),
    category            text        not null default 'Geral',
    description         text        not null default '-',
    raw                 text,

    transaction_date    date        not null default current_date,

    is_recurring        boolean     not null default false,
    recurring_rule_id   uuid,

    created_at          timestamptz not null default now(),
    updated_at          timestamptz not null default now()
);

comment on table public.transactions is 'Transações financeiras por workspace';

-- Indexes para queries frequentes
create index transactions_workspace_id_idx  on public.transactions (workspace_id);
create index transactions_user_id_idx       on public.transactions (user_id);
create index transactions_type_idx          on public.transactions (type);
create index transactions_date_idx          on public.transactions (transaction_date desc);
create index transactions_category_idx      on public.transactions (category);


-- ═══════════════════════════════════════════════════════════════
--  TABELA: recurring_rules
--  Regras de lançamentos recorrentes detectados/criados
-- ═══════════════════════════════════════════════════════════════
create table public.recurring_rules (
    id              uuid        primary key default uuid_generate_v4(),
    workspace_id    uuid        not null references public.workspaces(id) on delete cascade,
    user_id         uuid        not null references public.profiles(id) on delete cascade,

    category        text        not null,
    type            text        not null check (type in ('income', 'expense', 'debt', 'receivable')),
    avg_value       numeric(12,2),
    pattern_type    text        check (pattern_type in ('daily', 'weekly', 'monthly', 'quarterly', 'yearly')),
    pattern_days    int,

    is_enabled      boolean     not null default false,
    last_executed   timestamptz,
    next_execution  timestamptz,

    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now()
);

comment on table public.recurring_rules is 'Regras de lançamentos recorrentes';

-- FK retroativa: transactions → recurring_rules
alter table public.transactions
    add constraint transactions_recurring_rule_fk
    foreign key (recurring_rule_id) references public.recurring_rules(id)
    on delete set null;


-- ═══════════════════════════════════════════════════════════════
--  TRIGGER: updated_at automático
-- ═══════════════════════════════════════════════════════════════
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

create trigger profiles_updated_at
    before update on public.profiles
    for each row execute function public.set_updated_at();

create trigger workspaces_updated_at
    before update on public.workspaces
    for each row execute function public.set_updated_at();

create trigger transactions_updated_at
    before update on public.transactions
    for each row execute function public.set_updated_at();

create trigger recurring_rules_updated_at
    before update on public.recurring_rules
    for each row execute function public.set_updated_at();


-- ═══════════════════════════════════════════════════════════════
--  TRIGGER: novo usuário → cria profile + workspace padrão
-- ═══════════════════════════════════════════════════════════════
create or replace function public.on_auth_user_created()
returns trigger language plpgsql security definer as $$
declare
    ws_id uuid;
begin
    -- 1. Cria o profile
    insert into public.profiles (id, name, avatar_url)
    values (
        new.id,
        coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
        new.raw_user_meta_data->>'avatar_url'
    );

    -- 2. Cria o workspace padrão "Geral"
    insert into public.workspaces (user_id, name, icon, is_default)
    values (new.id, 'Geral', '🏠', true)
    returning id into ws_id;

    return new;
end;
$$;

create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function public.on_auth_user_created();


-- ═══════════════════════════════════════════════════════════════
--  ROW LEVEL SECURITY (RLS)
--  Cada usuário só vê e altera seus próprios dados
-- ═══════════════════════════════════════════════════════════════

-- profiles
alter table public.profiles enable row level security;

create policy "profiles: leitura própria"
    on public.profiles for select
    using (auth.uid() = id);

create policy "profiles: atualização própria"
    on public.profiles for update
    using (auth.uid() = id)
    with check (auth.uid() = id);

-- workspaces
alter table public.workspaces enable row level security;

create policy "workspaces: leitura própria"
    on public.workspaces for select
    using (auth.uid() = user_id);

create policy "workspaces: inserção própria"
    on public.workspaces for insert
    with check (auth.uid() = user_id);

create policy "workspaces: atualização própria"
    on public.workspaces for update
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

create policy "workspaces: exclusão própria"
    on public.workspaces for delete
    using (auth.uid() = user_id);

-- transactions
alter table public.transactions enable row level security;

create policy "transactions: leitura própria"
    on public.transactions for select
    using (auth.uid() = user_id);

create policy "transactions: inserção própria"
    on public.transactions for insert
    with check (auth.uid() = user_id);

create policy "transactions: atualização própria"
    on public.transactions for update
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

create policy "transactions: exclusão própria"
    on public.transactions for delete
    using (auth.uid() = user_id);

-- recurring_rules
alter table public.recurring_rules enable row level security;

create policy "recurring_rules: leitura própria"
    on public.recurring_rules for select
    using (auth.uid() = user_id);

create policy "recurring_rules: inserção própria"
    on public.recurring_rules for insert
    with check (auth.uid() = user_id);

create policy "recurring_rules: atualização própria"
    on public.recurring_rules for update
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

create policy "recurring_rules: exclusão própria"
    on public.recurring_rules for delete
    using (auth.uid() = user_id);
