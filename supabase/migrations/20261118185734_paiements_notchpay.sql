-- Paiements Mobile Money via Notch Pay : la contribution n'est créée qu'une fois le paiement confirmé par l'API Notch Pay.
alter table public.contributions drop constraint contributions_source_check;
alter table public.contributions add constraint contributions_source_check check (source = any (array['site','admin','notchpay']));
alter table public.contributions drop constraint contributions_moyen_check;
alter table public.contributions add constraint contributions_moyen_check check (moyen is null or moyen = any (array['carte','appli','orange_money','mobile','autre']));

create table public.paiements_notchpay (
  id uuid primary key default gen_random_uuid(),
  nom text not null check (char_length(btrim(nom)) between 2 and 40),
  anonyme boolean not null default false,
  montant integer not null check (montant between 100 and 75000),   -- centimes d'euro (1 € à 750 €)
  message text check (message is null or char_length(message) <= 240),
  moyen text not null default 'mobile' check (moyen in ('mobile','carte')),
  reference_np text unique,                                          -- référence Notch Pay (trx.…)
  statut text not null default 'initie' check (statut in ('initie','complete','echoue')),
  contribution_id uuid references public.contributions(id) on delete set null,
  cree_le timestamptz not null default now(),
  termine_le timestamptz
);
alter table public.paiements_notchpay enable row level security;
revoke all on public.paiements_notchpay from anon, authenticated;

-- Création (anti-abus : 30 paiements initiés en 10 minutes au maximum)
create or replace function public.np_creer(p_nom text, p_anonyme boolean, p_montant integer, p_message text, p_moyen text)
returns uuid language plpgsql security definer set search_path to '' as $$
declare v_id uuid;
begin
  if (select count(*) from public.paiements_notchpay where cree_le > now() - interval '10 minutes') > 30 then
    raise exception 'Trop de paiements en ce moment, réessayez dans quelques minutes.';
  end if;
  insert into public.paiements_notchpay (nom, anonyme, montant, message, moyen)
  values (btrim(p_nom), coalesce(p_anonyme, false), p_montant,
          nullif(btrim(coalesce(p_message, '')), ''), coalesce(nullif(p_moyen, ''), 'mobile'))
  returning id into v_id;
  return v_id;
end $$;

-- Confirmation idempotente : un seul passage crée la contribution, même si webhook et retour arrivent ensemble
create or replace function public.np_confirmer(p_id uuid, p_reference text)
returns uuid language plpgsql security definer set search_path to '' as $$
declare p public.paiements_notchpay; v_contrib uuid;
begin
  update public.paiements_notchpay set statut = 'complete', termine_le = now(), reference_np = coalesce(reference_np, p_reference)
  where id = p_id and statut <> 'complete'
  returning * into p;
  if not found then
    select contribution_id into v_contrib from public.paiements_notchpay where id = p_id;
    return v_contrib;
  end if;
  insert into public.contributions (nom, anonyme, montant, message, reference, moyen, source, statut, statue_le)
  values (p.nom, p.anonyme, p.montant, p.message, left(p.reference_np, 40), p.moyen, 'notchpay', 'validee', now())
  returning id into v_contrib;
  update public.paiements_notchpay set contribution_id = v_contrib where id = p_id;
  return v_contrib;
end $$;

revoke all on function public.np_creer(text, boolean, integer, text, text) from public, anon, authenticated;
revoke all on function public.np_confirmer(uuid, text) from public, anon, authenticated;
grant execute on function public.np_creer(text, boolean, integer, text, text) to service_role;
grant execute on function public.np_confirmer(uuid, text) to service_role;
grant select, update on public.paiements_notchpay to service_role;
