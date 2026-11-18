create extension if not exists pgcrypto with schema extensions;

create table public.contributions (
  id uuid primary key default gen_random_uuid(),
  nom text not null check (char_length(btrim(nom)) between 2 and 40),
  anonyme boolean not null default false,
  montant integer not null check (montant between 100 and 2000000),
  message text check (message is null or char_length(message) <= 240),
  reference text check (reference is null or char_length(reference) <= 40),
  source text not null default 'site' check (source in ('site','admin')),
  statut text not null default 'en_attente' check (statut in ('en_attente','validee','rejetee')),
  cree_le timestamptz not null default now(),
  statue_le timestamptz
);
create index contributions_statut_idx on public.contributions (statut, cree_le desc);

create table public.admin_secret (
  id int primary key default 1 check (id = 1),
  hash text not null
);

create table public.admin_tentatives (
  id bigint generated always as identity primary key,
  le timestamptz not null default now()
);

alter table public.contributions enable row level security;
alter table public.admin_secret enable row level security;
alter table public.admin_tentatives enable row level security;
revoke all on public.contributions, public.admin_secret, public.admin_tentatives from anon, authenticated;

-- Etat public de la cagnotte
create or replace function public.etat_cagnotte()
returns json language sql stable security definer set search_path = '' as $$
  select json_build_object(
    'total', coalesce(sum(montant) filter (where statut = 'validee'), 0),
    'contributions', count(*) filter (where statut = 'validee'),
    'en_attente', count(*) filter (where statut = 'en_attente')
  ) from public.contributions;
$$;

-- Tableau d'honneur public (contributions validées)
create or replace function public.tableau_honneur(p_limite int default 60)
returns table (id uuid, nom text, montant integer, message text, le timestamptz)
language sql stable security definer set search_path = '' as $$
  select c.id,
         case when c.anonyme then 'Anonyme' else c.nom end,
         c.montant, c.message, coalesce(c.statue_le, c.cree_le)
  from public.contributions c
  where c.statut = 'validee'
  order by coalesce(c.statue_le, c.cree_le) desc
  limit least(greatest(p_limite, 1), 200);
$$;

-- Déclaration publique d'une contribution (en attente de vérification)
create or replace function public.declarer_contribution(
  p_nom text, p_anonyme boolean, p_montant integer, p_message text, p_reference text)
returns uuid language plpgsql volatile security definer set search_path = '' as $$
declare v_id uuid;
begin
  if (select count(*) from public.contributions
      where statut = 'en_attente' and cree_le > now() - interval '10 minutes') > 30 then
    raise exception 'Trop de déclarations en ce moment, réessayez dans quelques minutes.';
  end if;
  insert into public.contributions (nom, anonyme, montant, message, reference)
  values (btrim(p_nom), coalesce(p_anonyme, false), p_montant,
          nullif(btrim(coalesce(p_message, '')), ''), nullif(btrim(coalesce(p_reference, '')), ''))
  returning id into v_id;
  return v_id;
end $$;

-- Vérification du code admin, avec blocage après trop d'échecs
create or replace function public._admin_ok(p_code text)
returns boolean language plpgsql volatile security definer set search_path = '' as $$
declare v_hash text;
begin
  if (select count(*) from public.admin_tentatives where le > now() - interval '15 minutes') >= 8 then
    raise exception 'Trop d''essais. Réessayez dans 15 minutes.';
  end if;
  select hash into v_hash from public.admin_secret where id = 1;
  if v_hash is not null and p_code is not null and v_hash = extensions.crypt(p_code, v_hash) then
    return true;
  end if;
  insert into public.admin_tentatives default values;
  return false;
end $$;
revoke all on function public._admin_ok(text) from public, anon, authenticated;

create or replace function public.admin_connexion(p_code text)
returns boolean language plpgsql volatile security definer set search_path = '' as $$
begin
  return public._admin_ok(p_code);
end $$;

create or replace function public.admin_lister(p_code text)
returns setof public.contributions language plpgsql volatile security definer set search_path = '' as $$
begin
  if not public._admin_ok(p_code) then raise exception 'Code admin incorrect.'; end if;
  return query select * from public.contributions order by
    (statut = 'en_attente') desc, cree_le desc limit 500;
end $$;

create or replace function public.admin_statuer(p_code text, p_id uuid, p_statut text)
returns void language plpgsql volatile security definer set search_path = '' as $$
begin
  if not public._admin_ok(p_code) then raise exception 'Code admin incorrect.'; end if;
  if p_statut not in ('en_attente','validee','rejetee') then raise exception 'Statut inconnu.'; end if;
  update public.contributions set statut = p_statut,
    statue_le = case when p_statut = 'en_attente' then null else now() end
  where id = p_id;
end $$;

create or replace function public.admin_ajouter(p_code text, p_nom text, p_anonyme boolean, p_montant integer, p_message text)
returns uuid language plpgsql volatile security definer set search_path = '' as $$
declare v_id uuid;
begin
  if not public._admin_ok(p_code) then raise exception 'Code admin incorrect.'; end if;
  insert into public.contributions (nom, anonyme, montant, message, source, statut, statue_le)
  values (btrim(p_nom), coalesce(p_anonyme, false), p_montant,
          nullif(btrim(coalesce(p_message, '')), ''), 'admin', 'validee', now())
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.admin_supprimer(p_code text, p_id uuid)
returns void language plpgsql volatile security definer set search_path = '' as $$
begin
  if not public._admin_ok(p_code) then raise exception 'Code admin incorrect.'; end if;
  delete from public.contributions where id = p_id;
end $$;

create or replace function public.admin_changer_code(p_code text, p_nouveau text)
returns void language plpgsql volatile security definer set search_path = '' as $$
begin
  if not public._admin_ok(p_code) then raise exception 'Code admin incorrect.'; end if;
  if char_length(coalesce(p_nouveau, '')) < 8 then raise exception 'Le nouveau code doit faire au moins 8 caractères.'; end if;
  update public.admin_secret set hash = extensions.crypt(p_nouveau, extensions.gen_salt('bf', 10)) where id = 1;
end $$;

revoke all on function public.etat_cagnotte(), public.tableau_honneur(int),
  public.declarer_contribution(text, boolean, integer, text, text),
  public.admin_connexion(text), public.admin_lister(text), public.admin_statuer(text, uuid, text),
  public.admin_ajouter(text, text, boolean, integer, text), public.admin_supprimer(text, uuid),
  public.admin_changer_code(text, text) from public;
grant execute on function public.etat_cagnotte(), public.tableau_honneur(int),
  public.declarer_contribution(text, boolean, integer, text, text),
  public.admin_connexion(text), public.admin_lister(text), public.admin_statuer(text, uuid, text),
  public.admin_ajouter(text, text, boolean, integer, text), public.admin_supprimer(text, uuid),
  public.admin_changer_code(text, text) to anon, authenticated;
