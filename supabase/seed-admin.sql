-- Execute isso no Supabase SQL Editor APÓS criar a conta em /produtor/cadastro
-- com o e-mail fabiolaneves71@gmail.com

insert into admins (user_id)
select id from auth.users
where email = 'fabiolaneves71@gmail.com'
on conflict do nothing;

-- Verificar se foi inserido:
select a.id, u.email, a.created_at
from admins a
join auth.users u on u.id = a.user_id;
