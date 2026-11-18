-- Les montants sont désormais en centimes d'euro (100 = 1 EUR)
comment on column public.contributions.montant is 'Montant en centimes d''euro';
alter table public.contributions add column moyen text
  check (moyen is null or moyen in ('carte','appli','orange_money','autre'));

drop function public.declarer_contribution(text, boolean, integer, text, text);
create function public.declarer_contribution(
  p_nom text, p_anonyme boolean, p_montant integer, p_message text, p_reference text, p_moyen text default null)
returns uuid language plpgsql volatile security definer set search_path = '' as $$
declare v_id uuid;
begin
  if (select count(*) from public.contributions
      where statut = 'en_attente' and cree_le > now() - interval '10 minutes') > 30 then
    raise exception 'Trop d''inscriptions en ce moment, réessayez dans quelques minutes.';
  end if;
  insert into public.contributions (nom, anonyme, montant, message, reference, moyen)
  values (btrim(p_nom), coalesce(p_anonyme, false), p_montant,
          nullif(btrim(coalesce(p_message, '')), ''), nullif(btrim(coalesce(p_reference, '')), ''),
          nullif(p_moyen, ''))
  returning id into v_id;
  return v_id;
end $$;
revoke all on function public.declarer_contribution(text, boolean, integer, text, text, text) from public;
grant execute on function public.declarer_contribution(text, boolean, integer, text, text, text) to anon, authenticated;

-- Suppression des données de test
delete from public.contributions where nom like 'TEST%';
delete from public.admin_tentatives;
