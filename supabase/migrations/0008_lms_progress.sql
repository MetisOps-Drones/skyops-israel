create table lms_progress (
  user_id uuid not null references profiles (id) on delete cascade,
  course_id lms_course_id not null,
  completed_lessons text[] not null default '{}',
  quiz_scores jsonb not null default '[]'::jsonb,
  passed_mock_exam boolean not null default false,
  subscription_active boolean not null default false,
  last_activity_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, course_id)
);

create trigger lms_progress_set_updated_at
  before update on lms_progress
  for each row execute function set_updated_at();
