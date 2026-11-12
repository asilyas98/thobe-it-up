-- =========================================================
-- Thobe It Up — Supabase schema
-- Run this whole file once in Supabase → SQL Editor.
-- =========================================================

-- ---------- PROFILES ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  avatar_url text,
  phone text,
  is_seller boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
create policy "profiles readable by all" on public.profiles for select using (true);
create policy "users insert own profile" on public.profiles for insert with check (auth.uid() = id);
create policy "users update own profile" on public.profiles for update using (auth.uid() = id);

-- Auto-create a profile for every new user (email, Google or Facebook)
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, avatar_url, is_seller)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url',
    coalesce((new.raw_user_meta_data->>'is_seller')::boolean, false)
  )
  on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

-- ---------- SHOPS ----------
create table if not exists public.shops (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  description text,
  logo_url text,
  phone text,
  whatsapp text,
  email text,
  address text,
  city text,
  lat double precision,
  lng double precision,
  has_storefront boolean not null default true,   -- physical shop vs online-only seller
  ships boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists shops_owner_idx on public.shops(owner_id);
create index if not exists shops_latlng_idx on public.shops(lat, lng);

alter table public.shops enable row level security;
create policy "active shops readable" on public.shops for select using (is_active or owner_id = auth.uid());
create policy "owner creates shop" on public.shops for insert with check (owner_id = auth.uid());
create policy "owner updates shop" on public.shops for update using (owner_id = auth.uid());
create policy "owner deletes shop" on public.shops for delete using (owner_id = auth.uid());

-- ---------- PRODUCTS ----------
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  title text not null,
  description text,
  price numeric(10,2),
  currency text not null default 'USD',
  category text not null,          -- fragrance | clothing | books | prayer | home | food | accessories
  product_type text,               -- e.g. attar, thobe, abaya, quran, tafsir ...
  book_language text,              -- books only: Arabic, English, Arabic-English, Urdu ...
  gender text,                     -- clothing: men | women | kids | unisex
  images text[] not null default '{}',
  in_stock boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists products_shop_idx on public.products(shop_id);
create index if not exists products_cat_idx on public.products(category, product_type);
create index if not exists products_search_idx on public.products
  using gin (to_tsvector('simple', coalesce(title,'') || ' ' || coalesce(description,'')));

alter table public.products enable row level security;
create policy "products readable" on public.products for select using (true);
create policy "shop owner inserts products" on public.products for insert
  with check (exists (select 1 from public.shops s where s.id = shop_id and s.owner_id = auth.uid()));
create policy "shop owner updates products" on public.products for update
  using (exists (select 1 from public.shops s where s.id = shop_id and s.owner_id = auth.uid()));
create policy "shop owner deletes products" on public.products for delete
  using (exists (select 1 from public.shops s where s.id = shop_id and s.owner_id = auth.uid()));

-- ---------- FAVORITES ----------
create table if not exists public.favorites (
  user_id uuid not null references public.profiles(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, product_id)
);
alter table public.favorites enable row level security;
create policy "own favorites" on public.favorites for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------- CONVERSATIONS & MESSAGES (contact seller) ----------
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references public.profiles(id) on delete cascade,
  shop_id uuid not null references public.shops(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (buyer_id, shop_id)
);
alter table public.conversations enable row level security;

create or replace function public.is_conversation_member(conv uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.conversations c
    join public.shops s on s.id = c.shop_id
    where c.id = conv and (c.buyer_id = auth.uid() or s.owner_id = auth.uid())
  );
$$;

create policy "members read conversations" on public.conversations for select using (public.is_conversation_member(id));
create policy "buyer starts conversation" on public.conversations for insert with check (buyer_id = auth.uid());
create policy "members update conversation" on public.conversations for update using (public.is_conversation_member(id));

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists messages_conv_idx on public.messages(conversation_id, created_at);
alter table public.messages enable row level security;
create policy "members read messages" on public.messages for select using (public.is_conversation_member(conversation_id));
create policy "members send messages" on public.messages for insert
  with check (sender_id = auth.uid() and public.is_conversation_member(conversation_id));
create policy "members mark read" on public.messages for update using (public.is_conversation_member(conversation_id));

create or replace function public.bump_conversation()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.conversations set last_message_at = new.created_at where id = new.conversation_id;
  return new;
end; $$;
drop trigger if exists on_message_sent on public.messages;
create trigger on_message_sent after insert on public.messages
for each row execute function public.bump_conversation();

-- Realtime for live chat
alter publication supabase_realtime add table public.messages;

-- ---------- NEARBY SHOPS (distance search, no PostGIS needed) ----------
create or replace function public.nearby_shops(user_lat double precision, user_lng double precision, radius_km double precision default 25)
returns table (
  id uuid, name text, description text, logo_url text, phone text, whatsapp text,
  address text, city text, lat double precision, lng double precision,
  has_storefront boolean, ships boolean, distance_km double precision
)
language sql stable as $$
  select * from (
    select s.id, s.name, s.description, s.logo_url, s.phone, s.whatsapp,
           s.address, s.city, s.lat, s.lng, s.has_storefront, s.ships,
           6371 * 2 * asin(sqrt(
             power(sin(radians(s.lat - user_lat) / 2), 2) +
             cos(radians(user_lat)) * cos(radians(s.lat)) *
             power(sin(radians(s.lng - user_lng) / 2), 2)
           )) as distance_km
    from public.shops s
    where s.is_active and s.lat is not null and s.lng is not null
  ) t
  where t.distance_km <= radius_km
  order by t.distance_km;
$$;

-- ---------- STORAGE: product & shop images ----------
insert into storage.buckets (id, name, public) values ('images', 'images', true)
on conflict (id) do nothing;

create policy "public read images" on storage.objects for select using (bucket_id = 'images');
create policy "users upload to own folder" on storage.objects for insert to authenticated
  with check (bucket_id = 'images' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "users delete own images" on storage.objects for delete to authenticated
  using (bucket_id = 'images' and (storage.foldername(name))[1] = auth.uid()::text);

-- =========================================================
-- SUPPORT: AI assistant tickets + admin inbox
-- =========================================================

-- Admin flag (only settable from the SQL editor / service role)
alter table public.profiles add column if not exists is_admin boolean not null default false;

create or replace function public.protect_profile_flags()
returns trigger language plpgsql as $$
begin
  if current_user in ('anon', 'authenticated') then
    if tg_op = 'INSERT' then
      new.is_admin := false;
    elsif new.is_admin is distinct from old.is_admin then
      new.is_admin := old.is_admin;
    end if;
  end if;
  return new;
end; $$;

drop trigger if exists protect_profile_flags on public.profiles;
create trigger protect_profile_flags before insert or update on public.profiles
for each row execute function public.protect_profile_flags();

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

-- ---------- TICKETS ----------
create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  ticket_number bigint generated always as identity (start with 1001) unique,
  user_id uuid references public.profiles(id) on delete set null,
  contact_name text,
  contact_email text,
  category text not null default 'other'
    check (category in ('account','report_seller','report_listing','buying','selling','technical','feedback','other')),
  priority text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  status text not null default 'open' check (status in ('open','pending','resolved','closed')),
  subject text not null,
  summary text not null,
  related_url text,
  transcript jsonb not null default '[]',
  source text not null default 'chatbot',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists tickets_user_idx on public.support_tickets(user_id, created_at desc);
create index if not exists tickets_status_idx on public.support_tickets(status, updated_at desc);

alter table public.support_tickets enable row level security;
create policy "owner or admin reads tickets" on public.support_tickets for select
  using (user_id = auth.uid() or public.is_admin());
create policy "admin updates tickets" on public.support_tickets for update
  using (public.is_admin());
-- (inserts only go through create_support_ticket below)

-- Secure ticket creation for logged-in users AND guests (guests must give an email)
create or replace function public.create_support_ticket(
  p_subject text,
  p_summary text,
  p_category text default 'other',
  p_priority text default 'normal',
  p_contact_email text default null,
  p_contact_name text default null,
  p_related_url text default null,
  p_transcript jsonb default '[]',
  p_source text default 'chatbot'
)
returns table (id uuid, ticket_number bigint)
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  v_email text := nullif(trim(p_contact_email), '');
  v_name text := nullif(trim(p_contact_name), '');
  recent int;
begin
  if coalesce(trim(p_subject), '') = '' or coalesce(trim(p_summary), '') = '' then
    raise exception 'Subject and summary are required';
  end if;

  if uid is not null then
    v_email := coalesce(v_email, (select email from auth.users where auth.users.id = uid));
    v_name := coalesce(v_name, (select full_name from public.profiles where profiles.id = uid));
  elsif v_email is null or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'A valid contact email is required for guests';
  end if;

  select count(*) into recent from public.support_tickets t
  where t.created_at > now() - interval '1 hour'
    and ((uid is not null and t.user_id = uid) or (uid is null and t.contact_email = v_email));
  if recent >= 5 then
    raise exception 'Too many tickets in the last hour. Please wait a bit.';
  end if;

  return query
  insert into public.support_tickets
    (user_id, contact_name, contact_email, category, priority, subject, summary, related_url, transcript, source)
  values (
    uid, left(v_name, 120), left(v_email, 200),
    case when p_category in ('account','report_seller','report_listing','buying','selling','technical','feedback','other') then p_category else 'other' end,
    case when p_priority in ('low','normal','high','urgent') then p_priority else 'normal' end,
    left(trim(p_subject), 160), left(trim(p_summary), 4000), left(p_related_url, 500),
    coalesce(p_transcript, '[]'), case when p_source in ('chatbot','form') then p_source else 'chatbot' end
  )
  returning support_tickets.id, support_tickets.ticket_number;
end; $$;
grant execute on function public.create_support_ticket(text,text,text,text,text,text,text,jsonb,text) to anon, authenticated;

-- ---------- TICKET REPLIES ----------
create table if not exists public.ticket_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  sender_id uuid references public.profiles(id) on delete set null,
  is_staff boolean not null default false,
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);
create index if not exists ticket_messages_idx on public.ticket_messages(ticket_id, created_at);
alter table public.ticket_messages enable row level security;

create policy "owner or admin reads replies" on public.ticket_messages for select using (
  exists (select 1 from public.support_tickets t where t.id = ticket_id and (t.user_id = auth.uid() or public.is_admin()))
);
create policy "owner or admin replies" on public.ticket_messages for insert with check (
  sender_id = auth.uid() and (
    (is_staff = false and exists (select 1 from public.support_tickets t where t.id = ticket_id and t.user_id = auth.uid()))
    or (is_staff = true and public.is_admin())
  )
);

-- Replies move the ticket status along automatically
create or replace function public.on_ticket_reply()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.support_tickets set
    updated_at = now(),
    status = case
      when new.is_staff and status = 'open' then 'pending'          -- waiting on customer
      when not new.is_staff and status in ('pending','resolved') then 'open'
      else status end
  where id = new.ticket_id;
  return new;
end; $$;
drop trigger if exists on_ticket_reply on public.ticket_messages;
create trigger on_ticket_reply after insert on public.ticket_messages
for each row execute function public.on_ticket_reply();

-- ---------- CHATBOT RATE LIMIT (used only by the Edge Function) ----------
create table if not exists public.chat_rate (
  key text not null,
  window_start timestamptz not null,
  count int not null default 0,
  primary key (key, window_start)
);
alter table public.chat_rate enable row level security;   -- no policies: service role only

create or replace function public.bump_chat_rate(p_key text)
returns int language plpgsql security definer set search_path = public as $$
declare c int;
begin
  insert into public.chat_rate (key, window_start, count)
  values (p_key, date_trunc('hour', now()), 1)
  on conflict (key, window_start) do update set count = chat_rate.count + 1
  returning count into c;
  delete from public.chat_rate where window_start < now() - interval '1 day';
  return c;
end; $$;
revoke execute on function public.bump_chat_rate(text) from public, anon, authenticated;

-- After you sign up, make yourself an admin (replace the email):
-- update public.profiles set is_admin = true
--   where id = (select id from auth.users where email = 'YOUR-EMAIL@example.com');

-- =========================================================
-- AI AGENTS: seller assistant, shopping agent, admin agent
-- =========================================================

-- Global switches (edit in the app at /admin/agent)
create table if not exists public.agent_settings (
  id int primary key default 1 check (id = 1),
  auto_resolve_tickets boolean not null default false,   -- AI answers simple how-to tickets itself
  auto_hide_flagged boolean not null default true,       -- hide listings the AI blocks until an admin reviews
  shopper_enabled boolean not null default true,         -- buyer shopping agent on/off
  seller_auto_reply_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);
insert into public.agent_settings (id) values (1) on conflict (id) do nothing;
alter table public.agent_settings enable row level security;
create policy "settings readable" on public.agent_settings for select using (true);
create policy "admin edits settings" on public.agent_settings for update using (public.is_admin());

-- Seller auto-reply
alter table public.shops add column if not exists ai_auto_reply boolean not null default false;
alter table public.shops add column if not exists ai_instructions text;

-- Mark AI-written messages (only the server can set this)
alter table public.messages add column if not exists is_ai boolean not null default false;
drop policy if exists "members send messages" on public.messages;
create policy "members send messages" on public.messages for insert
  with check (sender_id = auth.uid() and is_ai = false and public.is_conversation_member(conversation_id));

alter table public.ticket_messages add column if not exists is_ai boolean not null default false;
drop policy if exists "owner or admin replies" on public.ticket_messages;
create policy "owner or admin replies" on public.ticket_messages for insert with check (
  sender_id = auth.uid() and is_ai = false and (
    (is_staff = false and exists (select 1 from public.support_tickets t where t.id = ticket_id and t.user_id = auth.uid()))
    or (is_staff = true and public.is_admin())
  )
);

-- Ticket triage results
alter table public.support_tickets add column if not exists ai_triage jsonb;
alter table public.support_tickets add column if not exists ai_triaged_at timestamptz;

-- Listing moderation
alter table public.products add column if not exists moderation_status text not null default 'pending'
  check (moderation_status in ('pending','approved','flagged','removed'));
alter table public.products add column if not exists moderation_notes text;
alter table public.products add column if not exists moderated_at timestamptz;
alter table public.products add column if not exists is_hidden boolean not null default false;
create index if not exists products_moderation_idx on public.products(moderation_status, created_at);

-- Hidden listings are only visible to their seller and admins
drop policy if exists "products readable" on public.products;
create policy "products readable" on public.products for select using (
  not is_hidden
  or exists (select 1 from public.shops s where s.id = shop_id and s.owner_id = auth.uid())
  or public.is_admin()
);
create policy "admin updates products" on public.products for update using (public.is_admin());

-- Sellers can't change moderation fields; editing a listing sends it back for a re-scan
create or replace function public.protect_product_moderation()
returns trigger language plpgsql as $$
begin
  if current_user in ('anon', 'authenticated') and not public.is_admin() then
    if tg_op = 'INSERT' then
      new.moderation_status := 'pending';
      new.moderation_notes := null;
      new.moderated_at := null;
      new.is_hidden := false;
    else
      new.is_hidden := old.is_hidden;
      new.moderation_notes := old.moderation_notes;
      new.moderated_at := old.moderated_at;
      new.moderation_status := old.moderation_status;
      if old.moderation_status <> 'removed' and (
        new.title is distinct from old.title or new.description is distinct from old.description
        or new.images is distinct from old.images or new.price is distinct from old.price) then
        new.moderation_status := 'pending';
      end if;
    end if;
  end if;
  return new;
end; $$;
drop trigger if exists protect_product_moderation on public.products;
create trigger protect_product_moderation before insert or update on public.products
for each row execute function public.protect_product_moderation();
