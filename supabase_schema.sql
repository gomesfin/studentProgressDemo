-- Create Students Table
create table if not exists students (
  id text primary key,
  name text,
  grade text,
  homeroom text,
  x numeric,
  y numeric,
  manual_position boolean,
  enrolled_classes jsonb,
  progress jsonb
);

-- Create Assignments Table
create table if not exists assignments (
  id text primary key,
  student_id text references students(id),
  date text,
  activity_name text,
  score numeric,
  possible numeric,
  percentage numeric,
  status text,
  subject text
);

-- Enable Row Level Security (RLS) - Optional but recommended
alter table students enable row level security;
alter table assignments enable row level security;

-- Create Policies (Allow Public Read/Write for now - dev mode)
-- WARNING: For production, allow only authenticated users or specific roles.
create policy "Public Access Students" on students for all using (true) with check (true);
create policy "Public Access Assignments" on assignments for all using (true) with check (true);
