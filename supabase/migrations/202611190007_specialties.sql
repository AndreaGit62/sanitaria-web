-- Expand the specialty catalog, preserving appointment IDs and related documents.
begin;
alter table public.appointments drop constraint if exists appointments_specialty_check;
update public.appointments set specialty=case specialty
  when 'Laboratorio' then 'Analisi'
  when 'Altra visita' then 'Altra visita / prestazione'
  end, version=version+1
where specialty in ('Laboratorio','Altra visita');
alter table public.appointments add constraint appointments_specialty_check check(specialty in (
    'Allergologia',
    'Analisi',
    'Angiologia',
    'Cardiologia',
    'Chirurgia generale',
    'Dermatologia',
    'Diabetologia',
    'Dietologia e nutrizione',
    'Endocrinologia',
    'Fisiatria',
    'Gastroenterologia',
    'Ginecologia e ostetricia',
    'Medicina interna',
    'Nefrologia',
    'Neurologia',
    'Oculistica',
    'Odontoiatria',
    'Oncologia',
    'Ortopedia',
    'Otorinolaringoiatria',
    'Pneumologia',
    'Radiologia e diagnostica per immagini',
    'Reumatologia',
    'Urologia',
    'Altra visita / prestazione'
));
commit;
