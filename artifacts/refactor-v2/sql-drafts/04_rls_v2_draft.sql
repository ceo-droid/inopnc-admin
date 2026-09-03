-- M5 DRAFT ONLY. Do not apply until authenticated clients and membership coverage pass.
-- Existing permissive policies remain during shadow testing; removal is a separately approved cutover.
create policy app_user_roles_read_own_v2 on public.app_user_roles for select to authenticated
using (user_id=(select auth.uid()));
create policy site_access_read_own_v2 on public.site_access for select to authenticated
using (user_id=(select auth.uid()));
create policy customer_aliases_admin_write_v2 on public.customer_aliases for all to authenticated
using ((select role from public.app_user_roles where user_id=(select auth.uid()) and is_active)='admin')
with check ((select role from public.app_user_roles where user_id=(select auth.uid()) and is_active)='admin');
create policy allocations_scoped_read_v2 on public.expense_allocations for select to authenticated
using (exists(select 1 from public.site_access sa where sa.user_id=(select auth.uid()) and sa.site_id=expense_allocations.site_id)
 or (select role from public.app_user_roles where user_id=(select auth.uid()) and is_active)='admin');
create policy allocations_scoped_insert_v2 on public.expense_allocations for insert to authenticated
with check (exists(select 1 from public.site_access sa where sa.user_id=(select auth.uid()) and sa.site_id=expense_allocations.site_id and sa.access_level in ('WRITE','ADMIN'))
 or (select role from public.app_user_roles where user_id=(select auth.uid()) and is_active)='admin');
create policy allocations_scoped_update_v2 on public.expense_allocations for update to authenticated
using (exists(select 1 from public.site_access sa where sa.user_id=(select auth.uid()) and sa.site_id=expense_allocations.site_id and sa.access_level in ('WRITE','ADMIN'))
 or (select role from public.app_user_roles where user_id=(select auth.uid()) and is_active)='admin')
with check (exists(select 1 from public.site_access sa where sa.user_id=(select auth.uid()) and sa.site_id=expense_allocations.site_id and sa.access_level in ('WRITE','ADMIN'))
 or (select role from public.app_user_roles where user_id=(select auth.uid()) and is_active)='admin');
create policy import_batches_owner_read_v2 on public.import_batches for select to authenticated
using (created_by=(select auth.uid()) or (select role from public.app_user_roles where user_id=(select auth.uid()) and is_active)='admin');
create policy audit_read_scoped_v2 on public.audit_logs for select to authenticated
using (actor_id=(select auth.uid()) or (select role from public.app_user_roles where user_id=(select auth.uid()) and is_active)='admin');
-- No direct client write policy for audit_logs. Trusted server workflow appends audit events.
-- production_manager access additionally requires app_user_roles.company_scope='NPC-1000'.
-- Every future production_manager predicate must reject any other company_scope; NPC-3000Q is admin-only.
