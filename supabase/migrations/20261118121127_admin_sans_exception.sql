drop function public.admin_lister(text);
drop function public.admin_statuer(text, uuid, text);
drop function public.admin_ajouter(text, text, boolean, integer, text);
drop function public.admin_supprimer(text, uuid);
drop function public.admin_changer_code(text, text);

-- Renvoie null si le code est faux (pas d'exception : la tentative ratée reste enregistrée)
create function public.admin_lister(p_code text)
returns json language plpgsql volatile security definer set search_path = '' as $$
begin
  if not public._admin_ok(p_code) then return null; end if;
  return coalesce((select json_agg(t) from (
    select * from public.contributions
    order by (statut = 'en_attente') desc, cree_le desc limit 500) t), '[]'::json);
end $$;

create function public.admin_statuer(p_code text, p_id uuid, p_statut text)
returns boolean language plpgsql volatile security definer set search_path = '' as $$
begin
  if not public._admin_ok(p_code) then return false; end if;
  if p_statut not in ('en_attente','validee','rejetee') then raise exception 'Statut inconnu.'; end if;
  update public.contributions set statut = p_statut,
    statue_le = case when p_statut = 'en_attente' then null else now() end
  where id = p_id;
  return true;
end $$;

create function public.admin_ajouter(p_code text, p_nom text, p_anonyme boolean, p_montant integer, p_message text)
returns boolean language plpgsql volatile security definer set search_path = '' as $$
begin
  if not public._admin_ok(p_code) then return false; end if;
  insert into public.contributions (nom, anonyme, montant, message, source, statut, statue_le)
  values (btrim(p_nom), coalesce(p_anonyme, false), p_montant,
          nullif(btrim(coalesce(p_message, '')), ''), 'admin', 'validee', now());
  return true;
end $$;

create function public.admin_supprimer(p_code text, p_id uuid)
returns boolean language plpgsql volatile security definer set search_path = '' as $$
begin
  if not public._admin_ok(p_code) then return false; end if;
  delete from public.contributions where id = p_id;
  return true;
end $$;

create function public.admin_changer_code(p_code text, p_nouveau text)
returns boolean language plpgsql volatile security definer set search_path = '' as $$
begin
  if not public._admin_ok(p_code) then return false; end if;
  if char_length(coalesce(p_nouveau, '')) < 8 then raise exception 'Le nouveau code doit faire au moins 8 caractères.'; end if;
  update public.admin_secret set hash = extensions.crypt(p_nouveau, extensions.gen_salt('bf', 10)) where id = 1;
  return true;
end $$;

revoke all on function public.admin_lister(text), public.admin_statuer(text, uuid, text),
  public.admin_ajouter(text, text, boolean, integer, text), public.admin_supprimer(text, uuid),
  public.admin_changer_code(text, text) from public;
grant execute on function public.admin_lister(text), public.admin_statuer(text, uuid, text),
  public.admin_ajouter(text, text, boolean, integer, text), public.admin_supprimer(text, uuid),
  public.admin_changer_code(text, text) to anon, authenticated;

-- Purge des vieilles tentatives
delete from public.admin_tentatives where le < now() - interval '1 day';
