-- Oct 1, 2026: public read policies call is_staff(); signed-out visitors need EXECUTE on it (returns false for them).
-- Without this, every listing showed "404 page not found" to anyone not signed in.
grant execute on function public.is_staff() to anon;
