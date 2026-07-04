create table if not exists public.nickname_progress (
  nickname text primary key check (char_length(nickname) between 2 and 30),
  secret_hash text not null check (char_length(secret_hash) = 64),
  progress jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.nickname_progress enable row level security;
revoke all on table public.nickname_progress from anon, authenticated;

drop function if exists public.load_nickname_progress(text, text);
create function public.load_nickname_progress(p_nickname text, p_secret_hash text)
returns table(progress jsonb, updated_at timestamptz, is_new boolean)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  stored_hash text;
begin
  select np.secret_hash into stored_hash
  from public.nickname_progress np
  where np.nickname = p_nickname;

  if not found then
    return query select null::jsonb, null::timestamptz, true;
    return;
  end if;

  if stored_hash <> p_secret_hash then
    raise exception '昵称或同步码错误';
  end if;

  return query
  select np.progress, np.updated_at, false
  from public.nickname_progress np
  where np.nickname = p_nickname;
end;
$$;

drop function if exists public.save_nickname_progress(text, text, jsonb, timestamptz);
create function public.save_nickname_progress(
  p_nickname text,
  p_secret_hash text,
  p_progress jsonb,
  p_updated_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if char_length(p_nickname) not between 2 and 30 or char_length(p_secret_hash) <> 64 then
    raise exception '昵称或同步码格式错误';
  end if;

  insert into public.nickname_progress (nickname, secret_hash, progress, updated_at)
  values (p_nickname, p_secret_hash, p_progress, p_updated_at)
  on conflict (nickname) do nothing;

  if found then return; end if;

  update public.nickname_progress
  set progress = p_progress, updated_at = p_updated_at
  where nickname = p_nickname and secret_hash = p_secret_hash;

  if not found then
    raise exception '昵称或同步码错误';
  end if;
end;
$$;

revoke all on function public.load_nickname_progress(text, text) from public;
revoke all on function public.save_nickname_progress(text, text, jsonb, timestamptz) from public;
grant execute on function public.load_nickname_progress(text, text) to anon, authenticated;
grant execute on function public.save_nickname_progress(text, text, jsonb, timestamptz) to anon, authenticated;
