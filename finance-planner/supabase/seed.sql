-- After the first deploy, add yourself as admin (replace the email):
insert into public.admin_emails (email) values ('srikanthnittala15@gmail.com') on conflict do nothing;
