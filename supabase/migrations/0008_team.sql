-- =========================================================================
-- Tactic Corpus Builder — team page
--
-- Idempotent. Safe to re-run. Apply in the Supabase SQL editor after 0007.
--
-- The Supabase project is shared with the mobile app, so profiles holds
-- every learner. admin_list_members() returns all of them (capped by the
-- client); the Team page needs only the staff, plus a search to find an
-- existing account to promote.
--
--   1. admin_list_staff(p_search, p_limit, p_offset)
--        p_search null or blank → profiles whose role is not 'learner'
--        p_search set           → any profile whose e-mail or name contains
--                                 the text (case-insensitive), staff first
--      Every row carries total_count, the number of matches before paging.
--   2. Partial index for the staff list.
-- =========================================================================

-- ─── 1. Staff list and account search ─────────────────────────────────────
create or replace function public.admin_list_staff(
  p_search text default null,
  p_limit  int  default 50,
  p_offset int  default 0
)
returns table (
  id          uuid,
  email       text,
  full_name   text,
  role        text,
  created_at  timestamptz,
  total_count bigint
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_search  text := nullif(btrim(left(coalesce(p_search, ''), 100)), '');
  v_pattern text;
  v_limit   int  := least(greatest(coalesce(p_limit, 50), 1), 100);
  v_offset  int  := least(greatest(coalesce(p_offset, 0), 0), 100000);
begin
  if not public.is_admin() then
    raise exception 'Admin role required' using errcode = '42501';
  end if;

  if v_search is not null then
    -- Match the text literally: escape the LIKE wildcards.
    v_pattern := '%' || replace(replace(replace(v_search, '\', '\\'), '%', '\%'), '_', '\_') || '%';
  end if;

  return query
    select p.id, p.email, p.full_name, p.role, p.created_at,
           count(*) over () as total_count
    from public.profiles p
    where case
            when v_pattern is null then p.role <> 'learner'
            else p.email ilike v_pattern escape '\'
              or p.full_name ilike v_pattern escape '\'
          end
    order by
      case p.role when 'admin' then 0 when 'ped' then 1 when 'ux' then 2
                  when 'data' then 3 else 4 end,
      lower(coalesce(nullif(p.full_name, ''), p.email, '')),
      p.id
    limit v_limit offset v_offset;
end;
$$;

revoke all on function public.admin_list_staff(text, int, int) from public, anon;
grant execute on function public.admin_list_staff(text, int, int) to authenticated;

-- ─── 2. Index for the staff list (few rows out of many learners) ──────────
create index if not exists profiles_staff_role_idx
  on public.profiles (role)
  where role <> 'learner';
