-- Les inscriptions du site comptent tout de suite ; Dovyl supprime les fausses a posteriori.
alter table public.contributions alter column statut set default 'validee';

create or replace function public.declarer_contribution(p_nom text, p_anonyme boolean, p_montant integer, p_message text, p_reference text, p_moyen text default null::text)
 returns uuid
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare v_id uuid;
begin
  -- Anti-abus : au plus 30 inscriptions venues du site en 10 minutes
  if (select count(*) from public.contributions
      where source = 'site' and cree_le > now() - interval '10 minutes') > 30 then
    raise exception 'Trop d''inscriptions en ce moment, réessayez dans quelques minutes.';
  end if;
  insert into public.contributions (nom, anonyme, montant, message, reference, moyen, statut, statue_le)
  values (btrim(p_nom), coalesce(p_anonyme, false), p_montant,
          nullif(btrim(coalesce(p_message, '')), ''), nullif(btrim(coalesce(p_reference, '')), ''),
          nullif(p_moyen, ''), 'validee', now())
  returning id into v_id;
  return v_id;
end $function$;
