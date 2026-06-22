-- ============================================================
-- FULL DATABASE SCHEMA (public) — generated Mon Jun 15 11:23:19 UTC 2026
-- ============================================================

-- ============ TABLE: admin_notifications ============
CREATE TABLE public.admin_notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  recipient_user_id uuid NOT NULL,
  type text NOT NULL DEFAULT 'mention'::text,
  title text NOT NULL,
  body text,
  chef_profile_id uuid,
  metadata jsonb DEFAULT '{}'::jsonb,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- ============ TABLE: admin_onboarding_tasks ============
CREATE TABLE public.admin_onboarding_tasks (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  chef_profile_id uuid NOT NULL,
  step_id uuid,
  task_type text NOT NULL,
  task_name text NOT NULL,
  assigned_to uuid,
  admin_due_date timestamp with time zone NOT NULL,
  status text NOT NULL DEFAULT 'pending'::text,
  completed_at timestamp with time zone,
  notes text,
  reminder_sent boolean DEFAULT false,
  reminder_sent_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  is_pipeline_task boolean DEFAULT true
);

-- ============ TABLE: batch_email_campaigns ============
CREATE TABLE public.batch_email_campaigns (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  subject text NOT NULL,
  body text NOT NULL,
  template_name text,
  scheduled_for timestamp with time zone,
  status text NOT NULL DEFAULT 'pending'::text,
  segmentation jsonb DEFAULT '{}'::jsonb,
  recipient_count integer DEFAULT 0,
  sent_count integer DEFAULT 0,
  failed_count integer DEFAULT 0,
  recipients jsonb DEFAULT '[]'::jsonb,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  sent_at timestamp with time zone,
  completed_at timestamp with time zone,
  error_message text
);

-- ============ TABLE: brief_notifications_sent ============
CREATE TABLE public.brief_notifications_sent (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  chef_id uuid NOT NULL,
  kind text NOT NULL,
  sent_at timestamp with time zone NOT NULL DEFAULT now()
);

-- ============ TABLE: catering_leads ============
CREATE TABLE public.catering_leads (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  source_email_id text NOT NULL,
  received_at timestamp with time zone,
  raw_text text,
  customer_name text,
  phone text,
  city text,
  rating text,
  review_text text,
  platform text DEFAULT 'trustoo'::text,
  status text NOT NULL DEFAULT 'new'::text,
  assigned_admin_id uuid,
  admin_notes text,
  image_url text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  event_date timestamp with time zone,
  event_color text,
  event_confirmed boolean NOT NULL DEFAULT false,
  hidden_from_calendar boolean NOT NULL DEFAULT false,
  event_title text,
  event_notes text
);

-- ============ TABLE: chat_channel_members ============
CREATE TABLE public.chat_channel_members (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  channel_id uuid NOT NULL,
  user_id uuid NOT NULL,
  joined_at timestamp with time zone NOT NULL DEFAULT now()
);

-- ============ TABLE: chat_channels ============
CREATE TABLE public.chat_channels (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  type text NOT NULL DEFAULT 'team'::text,
  name text,
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- ============ TABLE: chat_messages ============
CREATE TABLE public.chat_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  channel_id uuid NOT NULL,
  sender_id uuid NOT NULL,
  sender_name text,
  content text NOT NULL,
  mentions jsonb DEFAULT '[]'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- ============ TABLE: chef_activities ============
CREATE TABLE public.chef_activities (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  chef_id uuid NOT NULL,
  activity_type text NOT NULL,
  description text,
  admin_user_id uuid,
  admin_name text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  sync_origin text NOT NULL DEFAULT 'local'::text
);

-- ============ TABLE: chef_admin_data ============
CREATE TABLE public.chef_admin_data (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  chef_profile_id uuid NOT NULL,
  admin_notes text,
  admin_status text DEFAULT 'new'::text,
  crm_last_contact_date timestamp with time zone,
  crm_follow_up_date timestamp with time zone,
  call_attempts integer DEFAULT 0,
  assigned_admin_id uuid,
  crm_updated_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  is_task_paused boolean DEFAULT false,
  paused_until timestamp with time zone,
  pause_reason text,
  is_priority_city boolean DEFAULT false,
  first_contact_due timestamp with time zone,
  first_contact_completed_at timestamp with time zone,
  reminder_count integer DEFAULT 0,
  escalated boolean DEFAULT false,
  escalated_at timestamp with time zone,
  assigned_admin_ids uuid[] DEFAULT '{}'::uuid[],
  sync_origin text NOT NULL DEFAULT 'local'::text
);

-- ============ TABLE: chef_admin_notes ============
CREATE TABLE public.chef_admin_notes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  chef_profile_id uuid NOT NULL,
  note text NOT NULL,
  admin_user_id uuid NOT NULL,
  admin_name text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  sync_origin text NOT NULL DEFAULT 'local'::text
);

-- ============ TABLE: chef_onboarding_steps ============
CREATE TABLE public.chef_onboarding_steps (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  chef_profile_id uuid NOT NULL,
  step_name text NOT NULL,
  step_order integer NOT NULL,
  chef_expected_end timestamp with time zone,
  admin_due_date timestamp with time zone,
  is_completed boolean DEFAULT false,
  completed_at timestamp with time zone,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  due_date_manually_set boolean DEFAULT false
);

-- ============ TABLE: chef_profiles ============
CREATE TABLE public.chef_profiles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  business_name text,
  chef_name text,
  city text,
  address text,
  cuisines text[] DEFAULT '{}'::text[],
  dish_types text[] DEFAULT '{}'::text[],
  service_type service_type DEFAULT 'unsure'::service_type,
  food_safety_status food_safety_status,
  kvk_status kvk_status,
  plan plan_type DEFAULT 'starter'::plan_type,
  availability text[] DEFAULT '{}'::text[],
  contact_email text,
  contact_phone text,
  logo_url text,
  onboarding_completed boolean DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  tos_signature text,
  tos_accepted_at timestamp with time zone,
  tos_plan_accepted text,
  hyperzod_merchant_id text,
  onboarding_reminder_sent_at timestamp with time zone,
  contract_signed boolean DEFAULT false,
  contract_signature text,
  contract_signed_at timestamp with time zone,
  premium_logo_requested boolean DEFAULT false,
  premium_logo_requested_at timestamp with time zone,
  opening_hours jsonb,
  premium_logo_status text DEFAULT 'todo'::text,
  onboarding_started_at timestamp with time zone,
  deleted_at timestamp with time zone,
  kvk_number text,
  billing_period text NOT NULL DEFAULT 'yearly'::text,
  drive_folder_id text,
  sync_origin text NOT NULL DEFAULT 'local'::text
);

-- ============ TABLE: chef_status_history ============
CREATE TABLE public.chef_status_history (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  chef_profile_id uuid NOT NULL,
  previous_status text,
  new_status text NOT NULL,
  note text,
  admin_user_id uuid,
  admin_name text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- ============ TABLE: chef_verification ============
CREATE TABLE public.chef_verification (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  chef_profile_id uuid NOT NULL,
  menu_reviewed boolean DEFAULT false,
  documents_uploaded boolean DEFAULT false,
  food_safety_viewed boolean DEFAULT false,
  kvk_document_url text,
  haccp_document_url text,
  nvwa_document_url text,
  verification_completed boolean DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  food_safety_skipped_at timestamp with time zone,
  food_safety_followup_sent boolean DEFAULT false,
  food_safety_quiz_completed boolean DEFAULT false,
  food_safety_quiz_score numeric,
  food_safety_quiz_passed boolean DEFAULT false,
  food_safety_quiz_completed_at timestamp with time zone,
  kitchen_photo_1_url text,
  kitchen_photo_2_url text,
  fridge_photo_url text,
  kitchen_score integer,
  kitchen_status text,
  kitchen_analysis jsonb,
  kitchen_verified_at timestamp with time zone,
  contract_signed boolean DEFAULT false,
  contract_signature text,
  contract_signed_at timestamp with time zone,
  logo_reviewed boolean DEFAULT false,
  id_document_url text,
  first_week_playbook_sent_at timestamp with time zone,
  chef_faq_sent_at timestamp with time zone,
  first_week_challenge_sent_at timestamp with time zone
);

-- ============ TABLE: city_expansion_requests ============
CREATE TABLE public.city_expansion_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  event_id text NOT NULL,
  first_name text,
  last_name text,
  phone_number text,
  email text,
  city text,
  submitted_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- ============ TABLE: dishes ============
CREATE TABLE public.dishes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  menu_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  price numeric(10,2) NOT NULL,
  estimated_cost numeric(10,2),
  margin numeric(5,2),
  category text,
  restaurant_comparison_price numeric(10,2),
  is_upsell boolean DEFAULT false,
  sort_order integer DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  image_url text
);

-- ============ TABLE: drive_city_folders ============
CREATE TABLE public.drive_city_folders (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  city text NOT NULL,
  drive_folder_id text NOT NULL,
  chefs_root_folder_id text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- ============ TABLE: drive_watch_state ============
CREATE TABLE public.drive_watch_state (
  id integer NOT NULL DEFAULT 1,
  channel_id text,
  resource_id text,
  page_token text,
  expiration timestamp with time zone,
  webhook_url text,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- ============ TABLE: email_logs ============
CREATE TABLE public.email_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  sg_message_id text NOT NULL,
  sg_event_id text,
  email text NOT NULL,
  chef_profile_id uuid,
  subject text,
  email_type text,
  event_type text NOT NULL,
  "timestamp" timestamp with time zone NOT NULL,
  url text,
  reason text,
  user_agent text,
  ip text,
  raw_event jsonb,
  created_at timestamp with time zone DEFAULT now()
);

-- ============ TABLE: employee_tasks ============
CREATE TABLE public.employee_tasks (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  chef_id uuid NOT NULL,
  assigned_to uuid NOT NULL,
  task_type text NOT NULL DEFAULT 'call'::text,
  task_date date NOT NULL DEFAULT CURRENT_DATE,
  status text NOT NULL DEFAULT 'pending'::text,
  completed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  notes text,
  updated_at timestamp with time zone DEFAULT now()
);

-- ============ TABLE: hyperzod_backfill_log ============
CREATE TABLE public.hyperzod_backfill_log (
  id bigint NOT NULL DEFAULT nextval('hyperzod_backfill_log_id_seq'::regclass),
  run_id uuid NOT NULL,
  chef_profile_id uuid NOT NULL,
  ok boolean NOT NULL,
  status integer,
  error text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- ============ TABLE: kitchen_check_selections ============
CREATE TABLE public.kitchen_check_selections (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL,
  merchant_name text,
  merchant_email text,
  selection_batch text NOT NULL,
  status text NOT NULL DEFAULT 'selected'::text,
  kitchen_photo_1_url text,
  kitchen_photo_2_url text,
  fridge_photo_url text,
  kitchen_score integer,
  kitchen_status text,
  kitchen_analysis jsonb,
  analyzed_at timestamp with time zone,
  photos_uploaded_at timestamp with time zone,
  email_sent_at timestamp with time zone,
  access_token uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- ============ TABLE: launch_posts ============
CREATE TABLE public.launch_posts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  chef_profile_id uuid NOT NULL,
  image_url text NOT NULL,
  style text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- ============ TABLE: lead_assignment_counter ============
CREATE TABLE public.lead_assignment_counter (
  id integer NOT NULL DEFAULT 1,
  last_assigned_index integer DEFAULT 0,
  updated_at timestamp with time zone DEFAULT now()
);

-- ============ TABLE: menus ============
CREATE TABLE public.menus (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  chef_profile_id uuid NOT NULL,
  average_margin numeric(5,2),
  summary text,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- ============ TABLE: merchant_setup_jobs ============
CREATE TABLE public.merchant_setup_jobs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  chef_profile_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending'::text,
  current_step text,
  merchant_id text,
  images_generated integer DEFAULT 0,
  dishes_imported integer DEFAULT 0,
  error_message text,
  ambience text,
  background_style text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  completed_at timestamp with time zone
);

-- ============ TABLE: merchants ============
CREATE TABLE public.merchants (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  hyperzod_merchant_id text NOT NULL,
  tenant_id text,
  merchant_id text,
  name text,
  slug text,
  email text,
  phone text,
  type text,
  country text,
  country_code text,
  city text,
  state text,
  address text,
  post_code text,
  merchant_address_location jsonb,
  merchant_location jsonb,
  delivery_by text,
  delivery_location_type text,
  delivery_radius numeric,
  delivery_radius_meters numeric,
  delivery_radius_unit text,
  delivery_amount numeric,
  min_order_amount numeric,
  accepted_order_types jsonb,
  status boolean DEFAULT false,
  is_accepting_orders boolean DEFAULT false,
  is_open boolean DEFAULT false,
  is_contactable boolean DEFAULT false,
  is_pos_managed boolean DEFAULT false,
  share_customer_details boolean DEFAULT false,
  commission numeric,
  tax_method text,
  currency text,
  merchant_category_ids jsonb DEFAULT '[]'::jsonb,
  merchant_categories jsonb DEFAULT '[]'::jsonb,
  average_rating numeric DEFAULT 0,
  images jsonb,
  cover_image_url text,
  logo_image_url text,
  scheduling_setting jsonb,
  language_translation jsonb,
  language_translate_columns jsonb,
  storefront_message jsonb,
  hyperzod_created_at text,
  hyperzod_updated_at text,
  synced_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- ============ TABLE: old_lead_notes ============
CREATE TABLE public.old_lead_notes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  old_lead_id uuid NOT NULL,
  admin_user_id uuid NOT NULL,
  admin_name text,
  note text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- ============ TABLE: old_leads ============
CREATE TABLE public.old_leads (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  email text,
  name text,
  phone text,
  city text,
  source text,
  status text NOT NULL DEFAULT 'new'::text,
  assigned_admin_id uuid,
  call_attempts integer DEFAULT 0,
  crm_last_contact_date timestamp with time zone,
  crm_follow_up_date timestamp with time zone,
  extra_data jsonb DEFAULT '{}'::jsonb,
  imported_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- ============ TABLE: pending_profiles ============
CREATE TABLE public.pending_profiles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  email text NOT NULL,
  phone text,
  chef_name text,
  business_name text,
  city text,
  address text,
  cuisines text[] DEFAULT '{}'::text[],
  dish_types text[] DEFAULT '{}'::text[],
  availability text[] DEFAULT '{}'::text[],
  service_type service_type DEFAULT 'unsure'::service_type,
  food_safety_status food_safety_status,
  kvk_status kvk_status,
  plan plan_type DEFAULT 'starter'::plan_type,
  logo_url text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  expires_at timestamp with time zone NOT NULL DEFAULT (now() + '7 days'::interval),
  current_step text DEFAULT 'contact'::text,
  session_token uuid DEFAULT gen_random_uuid(),
  onboarding_reminder_sent_at timestamp with time zone,
  admin_status text DEFAULT 'new'::text,
  call_attempts integer DEFAULT 0,
  assigned_admin_id uuid,
  crm_last_contact_date timestamp with time zone,
  crm_follow_up_date timestamp with time zone,
  admin_notes text,
  kvk_number text,
  billing_period text NOT NULL DEFAULT 'yearly'::text
);

-- ============ TABLE: processed_transcripts ============
CREATE TABLE public.processed_transcripts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  drive_file_id text NOT NULL,
  file_name text NOT NULL,
  chef_name_extracted text,
  chef_profile_id uuid,
  team_member text,
  promises_detected jsonb DEFAULT '[]'::jsonb,
  tasks_created integer DEFAULT 0,
  processed_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- ============ TABLE: signup_attempts ============
CREATE TABLE public.signup_attempts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  ip_address text,
  email text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- ============ TABLE: suppliers ============
CREATE TABLE public.suppliers (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  city text NOT NULL,
  name text NOT NULL,
  type text,
  url text,
  cached_at timestamp with time zone NOT NULL DEFAULT now()
);

-- ============ TABLE: sync_config ============
CREATE TABLE public.sync_config (
  key text NOT NULL,
  value text NOT NULL,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- ============ TABLE: sync_events ============
CREATE TABLE public.sync_events (
  event_id uuid NOT NULL,
  direction text NOT NULL,
  table_name text NOT NULL,
  op text NOT NULL,
  chef_id uuid,
  row_id uuid,
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending'::text,
  error text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- ============ TABLE: user_roles ============
CREATE TABLE public.user_roles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role app_role NOT NULL DEFAULT 'chef'::app_role,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  email text
);

-- ============ TABLE: whatsapp_posters ============
CREATE TABLE public.whatsapp_posters (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  chef_profile_id uuid NOT NULL,
  image_url text NOT NULL,
  style text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- ============ PRIMARY KEYS & UNIQUE & CHECK CONSTRAINTS ============
ALTER TABLE public.admin_notifications ADD CONSTRAINT admin_notifications_pkey PRIMARY KEY (id);
ALTER TABLE public.admin_notifications ADD CONSTRAINT admin_notifications_chef_profile_id_fkey FOREIGN KEY (chef_profile_id) REFERENCES chef_profiles(id) ON DELETE CASCADE;
ALTER TABLE public.admin_onboarding_tasks ADD CONSTRAINT admin_onboarding_tasks_pkey PRIMARY KEY (id);
ALTER TABLE public.admin_onboarding_tasks ADD CONSTRAINT admin_onboarding_tasks_step_id_fkey FOREIGN KEY (step_id) REFERENCES chef_onboarding_steps(id) ON DELETE CASCADE;
ALTER TABLE public.admin_onboarding_tasks ADD CONSTRAINT admin_onboarding_tasks_chef_profile_id_fkey FOREIGN KEY (chef_profile_id) REFERENCES chef_profiles(id) ON DELETE CASCADE;
ALTER TABLE public.batch_email_campaigns ADD CONSTRAINT batch_email_campaigns_pkey PRIMARY KEY (id);
ALTER TABLE public.batch_email_campaigns ADD CONSTRAINT batch_email_campaigns_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);
ALTER TABLE public.brief_notifications_sent ADD CONSTRAINT brief_notifications_sent_chef_id_kind_key UNIQUE (chef_id, kind);
ALTER TABLE public.brief_notifications_sent ADD CONSTRAINT brief_notifications_sent_pkey PRIMARY KEY (id);
ALTER TABLE public.catering_leads ADD CONSTRAINT catering_leads_source_email_id_key UNIQUE (source_email_id);
ALTER TABLE public.catering_leads ADD CONSTRAINT catering_leads_pkey PRIMARY KEY (id);
ALTER TABLE public.chat_channel_members ADD CONSTRAINT chat_channel_members_channel_id_user_id_key UNIQUE (channel_id, user_id);
ALTER TABLE public.chat_channel_members ADD CONSTRAINT chat_channel_members_pkey PRIMARY KEY (id);
ALTER TABLE public.chat_channel_members ADD CONSTRAINT chat_channel_members_channel_id_fkey FOREIGN KEY (channel_id) REFERENCES chat_channels(id) ON DELETE CASCADE;
ALTER TABLE public.chat_channels ADD CONSTRAINT chat_channels_pkey PRIMARY KEY (id);
ALTER TABLE public.chat_channels ADD CONSTRAINT chat_channels_type_check CHECK ((type = ANY (ARRAY['team'::text, 'dm'::text])));
ALTER TABLE public.chat_messages ADD CONSTRAINT chat_messages_pkey PRIMARY KEY (id);
ALTER TABLE public.chat_messages ADD CONSTRAINT chat_messages_channel_id_fkey FOREIGN KEY (channel_id) REFERENCES chat_channels(id) ON DELETE CASCADE;
ALTER TABLE public.chef_activities ADD CONSTRAINT chef_activities_pkey PRIMARY KEY (id);
ALTER TABLE public.chef_activities ADD CONSTRAINT chef_activities_admin_user_id_fkey FOREIGN KEY (admin_user_id) REFERENCES auth.users(id);
ALTER TABLE public.chef_activities ADD CONSTRAINT chef_activities_chef_id_fkey FOREIGN KEY (chef_id) REFERENCES chef_profiles(id) ON DELETE CASCADE;
ALTER TABLE public.chef_admin_data ADD CONSTRAINT chef_admin_data_chef_profile_id_key UNIQUE (chef_profile_id);
ALTER TABLE public.chef_admin_data ADD CONSTRAINT chef_admin_data_pkey PRIMARY KEY (id);
ALTER TABLE public.chef_admin_data ADD CONSTRAINT chef_admin_data_chef_profile_id_fkey FOREIGN KEY (chef_profile_id) REFERENCES chef_profiles(id) ON DELETE CASCADE;
ALTER TABLE public.chef_admin_notes ADD CONSTRAINT chef_admin_notes_pkey PRIMARY KEY (id);
ALTER TABLE public.chef_admin_notes ADD CONSTRAINT chef_admin_notes_chef_profile_id_fkey FOREIGN KEY (chef_profile_id) REFERENCES chef_profiles(id) ON DELETE CASCADE;
ALTER TABLE public.chef_onboarding_steps ADD CONSTRAINT chef_onboarding_steps_chef_profile_id_step_name_key UNIQUE (chef_profile_id, step_name);
ALTER TABLE public.chef_onboarding_steps ADD CONSTRAINT chef_onboarding_steps_pkey PRIMARY KEY (id);
ALTER TABLE public.chef_onboarding_steps ADD CONSTRAINT chef_onboarding_steps_chef_profile_id_fkey FOREIGN KEY (chef_profile_id) REFERENCES chef_profiles(id) ON DELETE CASCADE;
ALTER TABLE public.chef_profiles ADD CONSTRAINT chef_profiles_user_id_key UNIQUE (user_id);
ALTER TABLE public.chef_profiles ADD CONSTRAINT chef_profiles_pkey PRIMARY KEY (id);
ALTER TABLE public.chef_profiles ADD CONSTRAINT chef_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.chef_status_history ADD CONSTRAINT chef_status_history_pkey PRIMARY KEY (id);
ALTER TABLE public.chef_status_history ADD CONSTRAINT chef_status_history_chef_profile_id_fkey FOREIGN KEY (chef_profile_id) REFERENCES chef_profiles(id) ON DELETE CASCADE;
ALTER TABLE public.chef_verification ADD CONSTRAINT chef_verification_chef_profile_id_key UNIQUE (chef_profile_id);
ALTER TABLE public.chef_verification ADD CONSTRAINT chef_verification_pkey PRIMARY KEY (id);
ALTER TABLE public.chef_verification ADD CONSTRAINT chef_verification_chef_profile_id_fkey FOREIGN KEY (chef_profile_id) REFERENCES chef_profiles(id) ON DELETE CASCADE;
ALTER TABLE public.chef_verification ADD CONSTRAINT chef_verification_kitchen_status_check CHECK ((kitchen_status = ANY (ARRAY['pass'::text, 'conditional'::text, 'fail'::text])));
ALTER TABLE public.city_expansion_requests ADD CONSTRAINT city_expansion_requests_event_id_key UNIQUE (event_id);
ALTER TABLE public.city_expansion_requests ADD CONSTRAINT city_expansion_requests_pkey PRIMARY KEY (id);
ALTER TABLE public.dishes ADD CONSTRAINT dishes_pkey PRIMARY KEY (id);
ALTER TABLE public.dishes ADD CONSTRAINT dishes_menu_id_fkey FOREIGN KEY (menu_id) REFERENCES menus(id) ON DELETE CASCADE;
ALTER TABLE public.drive_city_folders ADD CONSTRAINT drive_city_folders_city_key UNIQUE (city);
ALTER TABLE public.drive_city_folders ADD CONSTRAINT drive_city_folders_pkey PRIMARY KEY (id);
ALTER TABLE public.drive_watch_state ADD CONSTRAINT drive_watch_state_pkey PRIMARY KEY (id);
ALTER TABLE public.email_logs ADD CONSTRAINT email_logs_sg_event_id_key UNIQUE (sg_event_id);
ALTER TABLE public.email_logs ADD CONSTRAINT email_logs_pkey PRIMARY KEY (id);
ALTER TABLE public.email_logs ADD CONSTRAINT email_logs_chef_profile_id_fkey FOREIGN KEY (chef_profile_id) REFERENCES chef_profiles(id) ON DELETE CASCADE;
ALTER TABLE public.employee_tasks ADD CONSTRAINT employee_tasks_chef_id_task_date_task_type_key UNIQUE (chef_id, task_date, task_type);
ALTER TABLE public.employee_tasks ADD CONSTRAINT employee_tasks_pkey PRIMARY KEY (id);
ALTER TABLE public.employee_tasks ADD CONSTRAINT employee_tasks_chef_id_fkey FOREIGN KEY (chef_id) REFERENCES chef_profiles(id) ON DELETE CASCADE;
ALTER TABLE public.hyperzod_backfill_log ADD CONSTRAINT hyperzod_backfill_log_pkey PRIMARY KEY (id);
ALTER TABLE public.kitchen_check_selections ADD CONSTRAINT kitchen_check_selections_pkey PRIMARY KEY (id);
ALTER TABLE public.kitchen_check_selections ADD CONSTRAINT kitchen_check_selections_merchant_id_fkey FOREIGN KEY (merchant_id) REFERENCES merchants(id) ON DELETE CASCADE;
ALTER TABLE public.launch_posts ADD CONSTRAINT launch_posts_pkey PRIMARY KEY (id);
ALTER TABLE public.launch_posts ADD CONSTRAINT launch_posts_chef_profile_id_fkey FOREIGN KEY (chef_profile_id) REFERENCES chef_profiles(id) ON DELETE CASCADE;
ALTER TABLE public.lead_assignment_counter ADD CONSTRAINT lead_assignment_counter_pkey PRIMARY KEY (id);
ALTER TABLE public.menus ADD CONSTRAINT menus_pkey PRIMARY KEY (id);
ALTER TABLE public.menus ADD CONSTRAINT menus_chef_profile_id_fkey FOREIGN KEY (chef_profile_id) REFERENCES chef_profiles(id) ON DELETE CASCADE;
ALTER TABLE public.merchant_setup_jobs ADD CONSTRAINT merchant_setup_jobs_pkey PRIMARY KEY (id);
ALTER TABLE public.merchant_setup_jobs ADD CONSTRAINT merchant_setup_jobs_chef_profile_id_fkey FOREIGN KEY (chef_profile_id) REFERENCES chef_profiles(id) ON DELETE CASCADE;
ALTER TABLE public.merchants ADD CONSTRAINT merchants_hyperzod_merchant_id_key UNIQUE (hyperzod_merchant_id);
ALTER TABLE public.merchants ADD CONSTRAINT merchants_pkey PRIMARY KEY (id);
ALTER TABLE public.old_lead_notes ADD CONSTRAINT old_lead_notes_pkey PRIMARY KEY (id);
ALTER TABLE public.old_lead_notes ADD CONSTRAINT old_lead_notes_old_lead_id_fkey FOREIGN KEY (old_lead_id) REFERENCES old_leads(id) ON DELETE CASCADE;
ALTER TABLE public.old_leads ADD CONSTRAINT old_leads_pkey PRIMARY KEY (id);
ALTER TABLE public.pending_profiles ADD CONSTRAINT pending_profiles_session_token_unique UNIQUE (session_token);
ALTER TABLE public.pending_profiles ADD CONSTRAINT pending_profiles_email_key UNIQUE (email);
ALTER TABLE public.pending_profiles ADD CONSTRAINT pending_profiles_pkey PRIMARY KEY (id);
ALTER TABLE public.processed_transcripts ADD CONSTRAINT processed_transcripts_drive_file_id_key UNIQUE (drive_file_id);
ALTER TABLE public.processed_transcripts ADD CONSTRAINT processed_transcripts_pkey PRIMARY KEY (id);
ALTER TABLE public.processed_transcripts ADD CONSTRAINT processed_transcripts_chef_profile_id_fkey FOREIGN KEY (chef_profile_id) REFERENCES chef_profiles(id);
ALTER TABLE public.signup_attempts ADD CONSTRAINT signup_attempts_pkey PRIMARY KEY (id);
ALTER TABLE public.suppliers ADD CONSTRAINT suppliers_pkey PRIMARY KEY (id);
ALTER TABLE public.sync_config ADD CONSTRAINT sync_config_pkey PRIMARY KEY (key);
ALTER TABLE public.sync_events ADD CONSTRAINT sync_events_pkey PRIMARY KEY (event_id);
ALTER TABLE public.sync_events ADD CONSTRAINT sync_events_direction_check CHECK ((direction = ANY (ARRAY['outbound'::text, 'inbound'::text])));
ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role);
ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);
ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.whatsapp_posters ADD CONSTRAINT whatsapp_posters_pkey PRIMARY KEY (id);
ALTER TABLE public.whatsapp_posters ADD CONSTRAINT whatsapp_posters_chef_profile_id_fkey FOREIGN KEY (chef_profile_id) REFERENCES chef_profiles(id) ON DELETE CASCADE;

-- ============ INDEXES ============
CREATE INDEX idx_admin_notifications_recipient ON public.admin_notifications USING btree (recipient_user_id, is_read, created_at DESC);
CREATE UNIQUE INDEX admin_notifications_pkey ON public.admin_notifications USING btree (id);
CREATE INDEX idx_admin_onboarding_tasks_due_date ON public.admin_onboarding_tasks USING btree (admin_due_date);
CREATE INDEX idx_admin_onboarding_tasks_assigned ON public.admin_onboarding_tasks USING btree (assigned_to);
CREATE INDEX idx_admin_onboarding_tasks_chef_id ON public.admin_onboarding_tasks USING btree (chef_profile_id);
CREATE INDEX idx_admin_onboarding_tasks_status ON public.admin_onboarding_tasks USING btree (status);
CREATE UNIQUE INDEX admin_onboarding_tasks_pkey ON public.admin_onboarding_tasks USING btree (id);
CREATE UNIQUE INDEX batch_email_campaigns_pkey ON public.batch_email_campaigns USING btree (id);
CREATE INDEX idx_batch_email_campaigns_scheduled ON public.batch_email_campaigns USING btree (scheduled_for, status) WHERE (status = 'scheduled'::text);
CREATE UNIQUE INDEX brief_notifications_sent_chef_id_kind_key ON public.brief_notifications_sent USING btree (chef_id, kind);
CREATE UNIQUE INDEX brief_notifications_sent_pkey ON public.brief_notifications_sent USING btree (id);
CREATE INDEX brief_notifications_sent_chef_kind_idx ON public.brief_notifications_sent USING btree (chef_id, kind);
CREATE UNIQUE INDEX catering_leads_pkey ON public.catering_leads USING btree (id);
CREATE INDEX catering_leads_event_date_idx ON public.catering_leads USING btree (event_date);
CREATE INDEX idx_catering_leads_created_at ON public.catering_leads USING btree (created_at DESC);
CREATE INDEX idx_catering_leads_status ON public.catering_leads USING btree (status);
CREATE UNIQUE INDEX catering_leads_source_email_id_key ON public.catering_leads USING btree (source_email_id);
CREATE UNIQUE INDEX chat_channel_members_channel_id_user_id_key ON public.chat_channel_members USING btree (channel_id, user_id);
CREATE UNIQUE INDEX chat_channel_members_pkey ON public.chat_channel_members USING btree (id);
CREATE UNIQUE INDEX chat_channels_pkey ON public.chat_channels USING btree (id);
CREATE UNIQUE INDEX chat_messages_pkey ON public.chat_messages USING btree (id);
CREATE UNIQUE INDEX chef_activities_pkey ON public.chef_activities USING btree (id);
CREATE INDEX idx_chef_activities_admin_created ON public.chef_activities USING btree (admin_user_id, created_at DESC);
CREATE INDEX idx_chef_activities_created ON public.chef_activities USING btree (created_at DESC);
CREATE INDEX idx_chef_activities_type ON public.chef_activities USING btree (activity_type);
CREATE INDEX idx_chef_activities_chef_id ON public.chef_activities USING btree (chef_id);
CREATE INDEX idx_chef_admin_data_assigned_admin_ids_gin ON public.chef_admin_data USING gin (assigned_admin_ids);
CREATE UNIQUE INDEX chef_admin_data_pkey ON public.chef_admin_data USING btree (id);
CREATE UNIQUE INDEX chef_admin_data_chef_profile_id_key ON public.chef_admin_data USING btree (chef_profile_id);
CREATE INDEX idx_chef_admin_data_paused ON public.chef_admin_data USING btree (is_task_paused) WHERE (is_task_paused = true);
CREATE INDEX idx_chef_admin_data_admin_status ON public.chef_admin_data USING btree (admin_status);
CREATE UNIQUE INDEX chef_admin_notes_pkey ON public.chef_admin_notes USING btree (id);
CREATE INDEX idx_chef_admin_notes_chef_id ON public.chef_admin_notes USING btree (chef_profile_id);
CREATE INDEX idx_chef_admin_notes_created_at ON public.chef_admin_notes USING btree (created_at DESC);
CREATE INDEX idx_chef_admin_notes_admin_created ON public.chef_admin_notes USING btree (admin_user_id, created_at DESC);
CREATE UNIQUE INDEX chef_onboarding_steps_chef_profile_id_step_name_key ON public.chef_onboarding_steps USING btree (chef_profile_id, step_name);
CREATE INDEX idx_chef_onboarding_steps_chef_id ON public.chef_onboarding_steps USING btree (chef_profile_id);
CREATE INDEX idx_chef_onboarding_steps_active ON public.chef_onboarding_steps USING btree (chef_profile_id, step_order) WHERE (is_completed = false);
CREATE UNIQUE INDEX chef_onboarding_steps_pkey ON public.chef_onboarding_steps USING btree (id);
CREATE INDEX idx_chef_profiles_hyperzod_merchant_id ON public.chef_profiles USING btree (hyperzod_merchant_id) WHERE (hyperzod_merchant_id IS NOT NULL);
CREATE UNIQUE INDEX chef_profiles_pkey ON public.chef_profiles USING btree (id);
CREATE UNIQUE INDEX chef_profiles_user_id_key ON public.chef_profiles USING btree (user_id);
CREATE INDEX idx_chef_profiles_user_id ON public.chef_profiles USING btree (user_id);
CREATE INDEX idx_chef_profiles_city ON public.chef_profiles USING btree (city);
CREATE INDEX idx_chef_profiles_onboarding ON public.chef_profiles USING btree (onboarding_completed);
CREATE INDEX idx_chef_profiles_active_created ON public.chef_profiles USING btree (created_at DESC) WHERE (deleted_at IS NULL);
CREATE INDEX idx_chef_status_history_chef_id ON public.chef_status_history USING btree (chef_profile_id);
CREATE UNIQUE INDEX chef_status_history_pkey ON public.chef_status_history USING btree (id);
CREATE UNIQUE INDEX chef_verification_chef_profile_id_key ON public.chef_verification USING btree (chef_profile_id);
CREATE INDEX idx_chef_verification_kitchen_status ON public.chef_verification USING btree (kitchen_status);
CREATE INDEX idx_chef_verification_completed ON public.chef_verification USING btree (verification_completed, first_week_playbook_sent_at, chef_faq_sent_at, first_week_challenge_sent_at) WHERE (verification_completed = true);
CREATE UNIQUE INDEX chef_verification_pkey ON public.chef_verification USING btree (id);
CREATE UNIQUE INDEX city_expansion_requests_pkey ON public.city_expansion_requests USING btree (id);
CREATE INDEX idx_city_expansion_requests_city ON public.city_expansion_requests USING btree (city);
CREATE UNIQUE INDEX city_expansion_requests_event_id_key ON public.city_expansion_requests USING btree (event_id);
CREATE INDEX idx_city_expansion_requests_submitted_at ON public.city_expansion_requests USING btree (submitted_at);
CREATE UNIQUE INDEX dishes_pkey ON public.dishes USING btree (id);
CREATE INDEX idx_dishes_upsell ON public.dishes USING btree (is_upsell);
CREATE INDEX idx_dishes_category ON public.dishes USING btree (category);
CREATE INDEX idx_dishes_menu_id ON public.dishes USING btree (menu_id);
CREATE UNIQUE INDEX drive_city_folders_city_key ON public.drive_city_folders USING btree (city);
CREATE UNIQUE INDEX drive_city_folders_pkey ON public.drive_city_folders USING btree (id);
CREATE UNIQUE INDEX drive_watch_state_pkey ON public.drive_watch_state USING btree (id);
CREATE INDEX idx_email_logs_created_at_desc ON public.email_logs USING btree (created_at DESC);
CREATE UNIQUE INDEX email_logs_pkey ON public.email_logs USING btree (id);
CREATE UNIQUE INDEX email_logs_sg_event_id_key ON public.email_logs USING btree (sg_event_id);
CREATE INDEX idx_email_logs_chef ON public.email_logs USING btree (chef_profile_id);
CREATE INDEX idx_email_logs_email ON public.email_logs USING btree (email);
CREATE INDEX idx_email_logs_event_type ON public.email_logs USING btree (event_type);
CREATE INDEX idx_email_logs_timestamp ON public.email_logs USING btree ("timestamp" DESC);
CREATE INDEX idx_email_logs_email_type ON public.email_logs USING btree (email_type);
CREATE INDEX idx_email_logs_event_type_created ON public.email_logs USING btree (event_type, created_at DESC);
CREATE INDEX idx_email_logs_chef_profile_id ON public.email_logs USING btree (chef_profile_id) WHERE (chef_profile_id IS NOT NULL);
CREATE INDEX idx_email_logs_chef_timestamp ON public.email_logs USING btree (chef_profile_id, "timestamp" DESC);
CREATE INDEX idx_email_logs_email_timestamp ON public.email_logs USING btree (email, "timestamp" DESC);
CREATE UNIQUE INDEX employee_tasks_pkey ON public.employee_tasks USING btree (id);
CREATE INDEX idx_employee_tasks_status ON public.employee_tasks USING btree (status);
CREATE INDEX idx_employee_tasks_assigned_to ON public.employee_tasks USING btree (assigned_to);
CREATE INDEX idx_employee_tasks_date ON public.employee_tasks USING btree (task_date);
CREATE UNIQUE INDEX employee_tasks_chef_id_task_date_task_type_key ON public.employee_tasks USING btree (chef_id, task_date, task_type);
CREATE UNIQUE INDEX hyperzod_backfill_log_pkey ON public.hyperzod_backfill_log USING btree (id);
CREATE UNIQUE INDEX kitchen_check_selections_pkey ON public.kitchen_check_selections USING btree (id);
CREATE INDEX idx_kitchen_check_batch ON public.kitchen_check_selections USING btree (selection_batch);
CREATE INDEX idx_kitchen_check_merchant ON public.kitchen_check_selections USING btree (merchant_id);
CREATE INDEX idx_kitchen_check_token ON public.kitchen_check_selections USING btree (access_token);
CREATE UNIQUE INDEX launch_posts_pkey ON public.launch_posts USING btree (id);
CREATE INDEX idx_launch_posts_chef ON public.launch_posts USING btree (chef_profile_id);
CREATE UNIQUE INDEX lead_assignment_counter_pkey ON public.lead_assignment_counter USING btree (id);
CREATE INDEX idx_menus_chef_profile_id ON public.menus USING btree (chef_profile_id);
CREATE INDEX idx_menus_active ON public.menus USING btree (is_active) WHERE (is_active = true);
CREATE UNIQUE INDEX menus_pkey ON public.menus USING btree (id);
CREATE INDEX idx_merchant_setup_jobs_status ON public.merchant_setup_jobs USING btree (status);
CREATE INDEX idx_merchant_setup_jobs_chef ON public.merchant_setup_jobs USING btree (chef_profile_id);
CREATE UNIQUE INDEX merchant_setup_jobs_pkey ON public.merchant_setup_jobs USING btree (id);
CREATE UNIQUE INDEX merchants_hyperzod_merchant_id_key ON public.merchants USING btree (hyperzod_merchant_id);
CREATE UNIQUE INDEX merchants_pkey ON public.merchants USING btree (id);
CREATE INDEX idx_merchants_is_open ON public.merchants USING btree (is_open);
CREATE INDEX idx_merchants_status ON public.merchants USING btree (status);
CREATE INDEX idx_merchants_city ON public.merchants USING btree (city);
CREATE INDEX idx_merchants_synced_at ON public.merchants USING btree (synced_at);
CREATE UNIQUE INDEX old_lead_notes_pkey ON public.old_lead_notes USING btree (id);
CREATE UNIQUE INDEX old_leads_pkey ON public.old_leads USING btree (id);
CREATE INDEX idx_pending_profiles_created ON public.pending_profiles USING btree (created_at DESC);
CREATE UNIQUE INDEX pending_profiles_pkey ON public.pending_profiles USING btree (id);
CREATE UNIQUE INDEX pending_profiles_email_key ON public.pending_profiles USING btree (email);
CREATE INDEX idx_pending_profiles_email ON public.pending_profiles USING btree (email);
CREATE INDEX idx_pending_profiles_expires ON public.pending_profiles USING btree (expires_at);
CREATE INDEX idx_pending_profiles_created_at ON public.pending_profiles USING btree (created_at DESC);
CREATE INDEX idx_pending_profiles_session_token ON public.pending_profiles USING btree (session_token);
CREATE UNIQUE INDEX pending_profiles_session_token_unique ON public.pending_profiles USING btree (session_token);
CREATE INDEX idx_pending_profiles_email_lower ON public.pending_profiles USING btree (lower(email));
CREATE UNIQUE INDEX processed_transcripts_pkey ON public.processed_transcripts USING btree (id);
CREATE UNIQUE INDEX processed_transcripts_drive_file_id_key ON public.processed_transcripts USING btree (drive_file_id);
CREATE INDEX idx_signup_attempts_email_created ON public.signup_attempts USING btree (email, created_at);
CREATE UNIQUE INDEX signup_attempts_pkey ON public.signup_attempts USING btree (id);
CREATE INDEX idx_signup_attempts_ip_created ON public.signup_attempts USING btree (ip_address, created_at);
CREATE UNIQUE INDEX suppliers_pkey ON public.suppliers USING btree (id);
CREATE INDEX idx_suppliers_city ON public.suppliers USING btree (city);
CREATE UNIQUE INDEX sync_config_pkey ON public.sync_config USING btree (key);
CREATE UNIQUE INDEX sync_events_pkey ON public.sync_events USING btree (event_id);
CREATE INDEX idx_sync_events_table_op ON public.sync_events USING btree (table_name, op);
CREATE INDEX idx_sync_events_created_at ON public.sync_events USING btree (created_at DESC);
CREATE UNIQUE INDEX user_roles_pkey ON public.user_roles USING btree (id);
CREATE INDEX idx_user_roles_email ON public.user_roles USING btree (email);
CREATE INDEX idx_user_roles_user_id ON public.user_roles USING btree (user_id);
CREATE INDEX idx_user_roles_role ON public.user_roles USING btree (role);
CREATE UNIQUE INDEX user_roles_user_id_role_key ON public.user_roles USING btree (user_id, role);
CREATE UNIQUE INDEX whatsapp_posters_pkey ON public.whatsapp_posters USING btree (id);

-- ============ RLS ENABLE + POLICIES ============
ALTER TABLE public.admin_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_onboarding_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.batch_email_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brief_notifications_sent ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catering_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_channel_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chef_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chef_admin_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chef_admin_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chef_onboarding_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chef_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chef_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chef_verification ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.city_expansion_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dishes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drive_city_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drive_watch_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hyperzod_backfill_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kitchen_check_selections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.launch_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_assignment_counter ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menus ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merchant_setup_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merchants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.old_lead_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.old_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pending_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.processed_transcripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.signup_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_posters ENABLE ROW LEVEL SECURITY;
CREATE POLICY admin_notifications_delete_own ON public.admin_notifications AS PERMISSIVE FOR DELETE TO authenticated USING ((recipient_user_id = auth.uid()));
CREATE POLICY admin_notifications_insert_admin ON public.admin_notifications AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (is_admin(auth.uid()));
CREATE POLICY admin_notifications_select_own ON public.admin_notifications AS PERMISSIVE FOR SELECT TO authenticated USING ((recipient_user_id = auth.uid()));
CREATE POLICY admin_notifications_update_own ON public.admin_notifications AS PERMISSIVE FOR UPDATE TO authenticated USING ((recipient_user_id = auth.uid()));
CREATE POLICY admin_onboarding_tasks_admin_only ON public.admin_onboarding_tasks AS PERMISSIVE FOR ALL TO public USING (is_admin(auth.uid()));
CREATE POLICY batch_email_campaigns_admin_only ON public.batch_email_campaigns AS PERMISSIVE FOR ALL TO public USING (is_admin(auth.uid()));
CREATE POLICY brief_notifications_sent_admin_all ON public.brief_notifications_sent AS PERMISSIVE FOR ALL TO authenticated USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));
CREATE POLICY catering_leads_admin_only ON public.catering_leads AS PERMISSIVE FOR ALL TO public USING (is_admin(auth.uid()));
CREATE POLICY chat_channel_members_admin_only ON public.chat_channel_members AS PERMISSIVE FOR ALL TO authenticated USING (is_admin(auth.uid()));
CREATE POLICY chat_channels_admin_only ON public.chat_channels AS PERMISSIVE FOR ALL TO authenticated USING (is_admin(auth.uid()));
CREATE POLICY chat_messages_admin_only ON public.chat_messages AS PERMISSIVE FOR ALL TO authenticated USING (is_admin(auth.uid()));
CREATE POLICY chef_activities_delete_admin_only ON public.chef_activities AS PERMISSIVE FOR DELETE TO public USING (is_admin(auth.uid()));
CREATE POLICY chef_activities_insert_admin_only ON public.chef_activities AS PERMISSIVE FOR INSERT TO public WITH CHECK (is_admin(auth.uid()));
CREATE POLICY chef_activities_select_admin_only ON public.chef_activities AS PERMISSIVE FOR SELECT TO public USING (is_admin(auth.uid()));
CREATE POLICY chef_activities_update_admin_only ON public.chef_activities AS PERMISSIVE FOR UPDATE TO public USING (is_admin(auth.uid()));
CREATE POLICY chef_admin_data_admin_only ON public.chef_admin_data AS PERMISSIVE FOR ALL TO public USING (is_admin(auth.uid()));
CREATE POLICY chef_admin_notes_admin_only ON public.chef_admin_notes AS PERMISSIVE FOR ALL TO public USING (is_admin(auth.uid()));
CREATE POLICY chef_onboarding_steps_admin_only ON public.chef_onboarding_steps AS PERMISSIVE FOR ALL TO public USING (is_admin(auth.uid()));
CREATE POLICY chef_profiles_delete_own ON public.chef_profiles AS PERMISSIVE FOR DELETE TO authenticated USING ((auth.uid() = user_id));
CREATE POLICY chef_profiles_insert_own ON public.chef_profiles AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));
CREATE POLICY chef_profiles_select_own ON public.chef_profiles AS PERMISSIVE FOR SELECT TO authenticated USING ((auth.uid() = user_id));
CREATE POLICY chef_profiles_select_own_or_admin ON public.chef_profiles AS PERMISSIVE FOR SELECT TO public USING (((auth.uid() = user_id) OR is_admin(auth.uid())));
CREATE POLICY chef_profiles_update_admin ON public.chef_profiles AS PERMISSIVE FOR UPDATE TO public USING (is_admin(auth.uid()));
CREATE POLICY chef_profiles_update_own ON public.chef_profiles AS PERMISSIVE FOR UPDATE TO authenticated USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));
CREATE POLICY chef_status_history_admin_only ON public.chef_status_history AS PERMISSIVE FOR ALL TO public USING (is_admin(auth.uid()));
CREATE POLICY chef_verification_all_admin ON public.chef_verification AS PERMISSIVE FOR ALL TO public USING (is_admin(auth.uid()));
CREATE POLICY chef_verification_insert_own ON public.chef_verification AS PERMISSIVE FOR INSERT TO public WITH CHECK ((chef_profile_id IN ( SELECT chef_profiles.id
   FROM chef_profiles
  WHERE (chef_profiles.user_id = auth.uid()))));
CREATE POLICY chef_verification_select_admin ON public.chef_verification AS PERMISSIVE FOR SELECT TO public USING (is_admin(auth.uid()));
CREATE POLICY chef_verification_select_own ON public.chef_verification AS PERMISSIVE FOR SELECT TO public USING ((chef_profile_id IN ( SELECT chef_profiles.id
   FROM chef_profiles
  WHERE (chef_profiles.user_id = auth.uid()))));
CREATE POLICY chef_verification_update_own ON public.chef_verification AS PERMISSIVE FOR UPDATE TO public USING ((chef_profile_id IN ( SELECT chef_profiles.id
   FROM chef_profiles
  WHERE (chef_profiles.user_id = auth.uid()))));
CREATE POLICY city_expansion_requests_admin_only ON public.city_expansion_requests AS PERMISSIVE FOR ALL TO public USING (is_admin(auth.uid()));
CREATE POLICY dishes_all_admin ON public.dishes AS PERMISSIVE FOR ALL TO public USING (is_admin(auth.uid()));
CREATE POLICY dishes_delete_own ON public.dishes AS PERMISSIVE FOR DELETE TO public USING ((menu_id IN ( SELECT m.id
   FROM (menus m
     JOIN chef_profiles cp ON ((m.chef_profile_id = cp.id)))
  WHERE (cp.user_id = auth.uid()))));
CREATE POLICY dishes_insert_own ON public.dishes AS PERMISSIVE FOR INSERT TO public WITH CHECK ((menu_id IN ( SELECT m.id
   FROM (menus m
     JOIN chef_profiles cp ON ((m.chef_profile_id = cp.id)))
  WHERE (cp.user_id = auth.uid()))));
CREATE POLICY dishes_select_admin ON public.dishes AS PERMISSIVE FOR SELECT TO public USING (is_admin(auth.uid()));
CREATE POLICY dishes_select_own ON public.dishes AS PERMISSIVE FOR SELECT TO public USING ((menu_id IN ( SELECT m.id
   FROM (menus m
     JOIN chef_profiles cp ON ((m.chef_profile_id = cp.id)))
  WHERE (cp.user_id = auth.uid()))));
CREATE POLICY dishes_update_own ON public.dishes AS PERMISSIVE FOR UPDATE TO public USING ((menu_id IN ( SELECT m.id
   FROM (menus m
     JOIN chef_profiles cp ON ((m.chef_profile_id = cp.id)))
  WHERE (cp.user_id = auth.uid()))));
CREATE POLICY drive_city_folders_admin_only ON public.drive_city_folders AS PERMISSIVE FOR ALL TO public USING (is_admin(auth.uid()));
CREATE POLICY "Admins can view drive watch state" ON public.drive_watch_state AS PERMISSIVE FOR SELECT TO authenticated USING (is_admin(auth.uid()));
CREATE POLICY email_logs_admin_only ON public.email_logs AS PERMISSIVE FOR ALL TO public USING (is_admin(auth.uid()));
CREATE POLICY employee_tasks_admin_only ON public.employee_tasks AS PERMISSIVE FOR ALL TO public USING (is_admin(auth.uid()));
CREATE POLICY "admin read backfill log" ON public.hyperzod_backfill_log AS PERMISSIVE FOR SELECT TO public USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "service insert backfill log" ON public.hyperzod_backfill_log AS PERMISSIVE FOR INSERT TO public WITH CHECK (true);
CREATE POLICY kitchen_check_selections_admin_only ON public.kitchen_check_selections AS PERMISSIVE FOR ALL TO public USING (is_admin(auth.uid()));
CREATE POLICY kitchen_check_selections_token_access ON public.kitchen_check_selections AS PERMISSIVE FOR SELECT TO public USING (((access_token)::text = ((current_setting('request.headers'::text, true))::json ->> 'x-kitchen-token'::text)));
CREATE POLICY kitchen_check_selections_token_update ON public.kitchen_check_selections AS PERMISSIVE FOR UPDATE TO public USING (((access_token)::text = ((current_setting('request.headers'::text, true))::json ->> 'x-kitchen-token'::text)));
CREATE POLICY "Admins can manage launch posts" ON public.launch_posts AS PERMISSIVE FOR ALL TO authenticated USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));
CREATE POLICY lead_assignment_counter_admin_only ON public.lead_assignment_counter AS PERMISSIVE FOR ALL TO authenticated USING (is_admin(auth.uid()));
CREATE POLICY menus_all_admin ON public.menus AS PERMISSIVE FOR ALL TO public USING (is_admin(auth.uid()));
CREATE POLICY menus_delete_own ON public.menus AS PERMISSIVE FOR DELETE TO public USING ((chef_profile_id IN ( SELECT chef_profiles.id
   FROM chef_profiles
  WHERE (chef_profiles.user_id = auth.uid()))));
CREATE POLICY menus_insert_own ON public.menus AS PERMISSIVE FOR INSERT TO public WITH CHECK ((chef_profile_id IN ( SELECT chef_profiles.id
   FROM chef_profiles
  WHERE (chef_profiles.user_id = auth.uid()))));
CREATE POLICY menus_select_admin ON public.menus AS PERMISSIVE FOR SELECT TO public USING (is_admin(auth.uid()));
CREATE POLICY menus_select_own ON public.menus AS PERMISSIVE FOR SELECT TO public USING ((chef_profile_id IN ( SELECT chef_profiles.id
   FROM chef_profiles
  WHERE (chef_profiles.user_id = auth.uid()))));
CREATE POLICY menus_update_own ON public.menus AS PERMISSIVE FOR UPDATE TO public USING ((chef_profile_id IN ( SELECT chef_profiles.id
   FROM chef_profiles
  WHERE (chef_profiles.user_id = auth.uid()))));
CREATE POLICY merchant_setup_jobs_admin_only ON public.merchant_setup_jobs AS PERMISSIVE FOR ALL TO public USING (is_admin(auth.uid()));
CREATE POLICY merchants_admin_only ON public.merchants AS PERMISSIVE FOR ALL TO public USING (is_admin(auth.uid()));
CREATE POLICY old_lead_notes_admin_only ON public.old_lead_notes AS PERMISSIVE FOR ALL TO public USING (is_admin(auth.uid()));
CREATE POLICY old_leads_admin_only ON public.old_leads AS PERMISSIVE FOR ALL TO public USING (is_admin(auth.uid()));
CREATE POLICY pending_profiles_anon_delete_token ON public.pending_profiles AS PERMISSIVE FOR DELETE TO anon USING (((session_token)::text = ((current_setting('request.headers'::text, true))::json ->> 'x-session-token'::text)));
CREATE POLICY pending_profiles_anon_insert_token ON public.pending_profiles AS PERMISSIVE FOR INSERT TO anon WITH CHECK (((session_token)::text = ((current_setting('request.headers'::text, true))::json ->> 'x-session-token'::text)));
CREATE POLICY pending_profiles_anon_select_token ON public.pending_profiles AS PERMISSIVE FOR SELECT TO anon USING (((session_token)::text = ((current_setting('request.headers'::text, true))::json ->> 'x-session-token'::text)));
CREATE POLICY pending_profiles_anon_update_token ON public.pending_profiles AS PERMISSIVE FOR UPDATE TO anon USING (((session_token)::text = ((current_setting('request.headers'::text, true))::json ->> 'x-session-token'::text))) WITH CHECK (((session_token)::text = ((current_setting('request.headers'::text, true))::json ->> 'x-session-token'::text)));
CREATE POLICY pending_profiles_authed_delete_email ON public.pending_profiles AS PERMISSIVE FOR DELETE TO authenticated USING ((lower(email) = lower((auth.jwt() ->> 'email'::text))));
CREATE POLICY pending_profiles_authed_select_email ON public.pending_profiles AS PERMISSIVE FOR SELECT TO authenticated USING ((lower(email) = lower((auth.jwt() ->> 'email'::text))));
CREATE POLICY pending_profiles_authed_update_email ON public.pending_profiles AS PERMISSIVE FOR UPDATE TO authenticated USING ((lower(email) = lower((auth.jwt() ->> 'email'::text)))) WITH CHECK ((lower(email) = lower((auth.jwt() ->> 'email'::text))));
CREATE POLICY pending_profiles_delete_admin_only ON public.pending_profiles AS PERMISSIVE FOR DELETE TO public USING (is_admin(auth.uid()));
CREATE POLICY pending_profiles_insert_anon ON public.pending_profiles AS PERMISSIVE FOR INSERT TO public WITH CHECK (true);
CREATE POLICY pending_profiles_insert_authenticated ON public.pending_profiles AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((lower(email) = lower(auth.email())));
CREATE POLICY pending_profiles_select_own_or_admin ON public.pending_profiles AS PERMISSIVE FOR SELECT TO public USING ((((session_token)::text = ((current_setting('request.headers'::text, true))::json ->> 'x-session-token'::text)) OR is_admin(auth.uid())));
CREATE POLICY pending_profiles_update_own_or_admin ON public.pending_profiles AS PERMISSIVE FOR UPDATE TO public USING ((((session_token)::text = ((current_setting('request.headers'::text, true))::json ->> 'x-session-token'::text)) OR is_admin(auth.uid())));
CREATE POLICY processed_transcripts_admin_only ON public.processed_transcripts AS PERMISSIVE FOR ALL TO public USING (is_admin(auth.uid()));
CREATE POLICY "Anyone can view suppliers" ON public.suppliers AS PERMISSIVE FOR SELECT TO public USING (true);
CREATE POLICY sync_config_admin_all ON public.sync_config AS PERMISSIVE FOR ALL TO public USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));
CREATE POLICY sync_events_admin_all ON public.sync_events AS PERMISSIVE FOR ALL TO public USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));
CREATE POLICY user_roles_delete_admin_only ON public.user_roles AS PERMISSIVE FOR DELETE TO public USING (is_admin(auth.uid()));
CREATE POLICY user_roles_insert_admin_only ON public.user_roles AS PERMISSIVE FOR INSERT TO public WITH CHECK (is_admin(auth.uid()));
CREATE POLICY user_roles_select_admin ON public.user_roles AS PERMISSIVE FOR SELECT TO public USING (is_admin(auth.uid()));
CREATE POLICY user_roles_select_own ON public.user_roles AS PERMISSIVE FOR SELECT TO public USING ((auth.uid() = user_id));
CREATE POLICY user_roles_update_admin_only ON public.user_roles AS PERMISSIVE FOR UPDATE TO public USING (is_admin(auth.uid()));
CREATE POLICY "Admins can manage whatsapp_posters" ON public.whatsapp_posters AS PERMISSIVE FOR ALL TO authenticated USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

-- ============ ENUM TYPES ============
CREATE TYPE public.app_role AS ENUM ('admin', 'chef');
CREATE TYPE public.food_safety_status AS ENUM ('have_certificate', 'getting_certificate', 'need_help');
CREATE TYPE public.kvk_status AS ENUM ('have_both', 'in_progress', 'need_help');
CREATE TYPE public.plan_type AS ENUM ('starter', 'growth', 'pro');
CREATE TYPE public.service_type AS ENUM ('delivery', 'pickup', 'both', 'unsure');

-- ============ FUNCTIONS ============
CREATE OR REPLACE FUNCTION public.assign_chef_role_on_profile()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.user_id, 'chef')
  ON CONFLICT (user_id, role) DO NOTHING;
  RETURN NEW;
END;
$function$

;
CREATE OR REPLACE FUNCTION public.handle_new_user_chef_profile()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Create a chef_profile for the new user
  INSERT INTO public.chef_profiles (user_id, contact_email, onboarding_completed)
  VALUES (NEW.id, NEW.email, false)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$function$

;
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'chef');
  RETURN NEW;
END;
$function$

;
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$function$

;
CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT public.has_role(_user_id, 'admin')
$function$

;
CREATE OR REPLACE FUNCTION public.notify_admin_on_chef_activity()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  edge_function_url text;
BEGIN
  -- Only call the edge function for high-value milestone activities
  -- Everything else is visible in the dashboard but does NOT need an email
  IF NEW.activity_type NOT IN (
    'verification_completed',
    'contract_signed',
    'quiz_completed',
    'kitchen_verified'
  ) THEN
    RETURN NEW;
  END IF;

  edge_function_url := 'https://mnhtpdsgxlyqppzyevvl.supabase.co/functions/v1/notify-admin-chef-progress';

  PERFORM net.http_post(
    url := edge_function_url,
    body := jsonb_build_object(
      'chef_id', NEW.chef_id,
      'activity_type', NEW.activity_type,
      'description', COALESCE(NEW.description, '')
    ),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1uaHRwZHNneGx5cXBwenlldnZsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUwNjc4MjUsImV4cCI6MjA4MDY0MzgyNX0.TdzI5fiC5x2L0RMZJpo_4udvvgzpQOat2f64XWiepyI'
    ),
    timeout_milliseconds := 30000
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'notify_admin_on_chef_activity failed: %', SQLERRM;
  RETURN NEW;
END;
$function$

;
CREATE OR REPLACE FUNCTION public.notify_hyperzod_merchant_webhook()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_event_type text;
  v_url text := 'https://mnhtpdsgxlyqppzyevvl.supabase.co/functions/v1/hyperzod-merchant-webhook';
  v_anon text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1uaHRwZHNneGx5cXBwenlldnZsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUwNjc4MjUsImV4cCI6MjA4MDY0MzgyNX0.TdzI5fiC5x2L0RMZJpo_4udvvgzpQOat2f64XWiepyI';
BEGIN
  -- Determine event type
  IF TG_OP = 'INSERT' THEN
    IF NEW.hyperzod_merchant_id IS NULL THEN RETURN NEW; END IF;
    v_event_type := 'merchant.created';
  ELSIF TG_OP = 'UPDATE' THEN
    -- Just got a hyperzod_merchant_id => created
    IF OLD.hyperzod_merchant_id IS NULL AND NEW.hyperzod_merchant_id IS NOT NULL THEN
      v_event_type := 'merchant.created';
    -- Already had one and a key field changed => updated
    ELSIF NEW.hyperzod_merchant_id IS NOT NULL AND (
        OLD.business_name IS DISTINCT FROM NEW.business_name OR
        OLD.chef_name IS DISTINCT FROM NEW.chef_name OR
        OLD.contact_email IS DISTINCT FROM NEW.contact_email OR
        OLD.contact_phone IS DISTINCT FROM NEW.contact_phone OR
        OLD.address IS DISTINCT FROM NEW.address OR
        OLD.city IS DISTINCT FROM NEW.city OR
        OLD.logo_url IS DISTINCT FROM NEW.logo_url OR
        OLD.plan IS DISTINCT FROM NEW.plan OR
        OLD.cuisines IS DISTINCT FROM NEW.cuisines OR
        OLD.dish_types IS DISTINCT FROM NEW.dish_types OR
        OLD.service_type IS DISTINCT FROM NEW.service_type OR
        OLD.availability IS DISTINCT FROM NEW.availability OR
        OLD.opening_hours IS DISTINCT FROM NEW.opening_hours OR
        OLD.kvk_number IS DISTINCT FROM NEW.kvk_number OR
        OLD.onboarding_completed IS DISTINCT FROM NEW.onboarding_completed
    ) THEN
      v_event_type := 'merchant.updated';
    ELSE
      RETURN NEW;
    END IF;
  ELSE
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url := v_url,
    body := jsonb_build_object(
      'chef_profile_id', NEW.id,
      'event_type', v_event_type
    ),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_anon
    ),
    timeout_milliseconds := 10000
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'notify_hyperzod_merchant_webhook failed: %', SQLERRM;
  RETURN NEW;
END;
$function$

;
CREATE OR REPLACE FUNCTION public.populate_user_role_email()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.email := (SELECT email FROM auth.users WHERE id = NEW.user_id);
  RETURN NEW;
END;
$function$

;
CREATE OR REPLACE FUNCTION public.record_chef_profile_activity()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_admin_id uuid;
  v_admin_name text;
  v_description text;
  v_changes text[] := '{}';
BEGIN
  -- Get assigned admin
  SELECT assigned_admin_id INTO v_admin_id
  FROM public.chef_admin_data
  WHERE chef_profile_id = NEW.id
  LIMIT 1;

  -- Build description of what changed
  IF OLD.business_name IS DISTINCT FROM NEW.business_name AND NEW.business_name IS NOT NULL THEN
    v_changes := array_append(v_changes, 'business name');
  END IF;
  IF OLD.logo_url IS DISTINCT FROM NEW.logo_url AND NEW.logo_url IS NOT NULL THEN
    v_changes := array_append(v_changes, 'logo');
  END IF;
  IF OLD.city IS DISTINCT FROM NEW.city AND NEW.city IS NOT NULL THEN
    v_changes := array_append(v_changes, 'city');
  END IF;
  IF OLD.address IS DISTINCT FROM NEW.address AND NEW.address IS NOT NULL THEN
    v_changes := array_append(v_changes, 'address');
  END IF;
  IF OLD.cuisines IS DISTINCT FROM NEW.cuisines AND NEW.cuisines IS NOT NULL THEN
    v_changes := array_append(v_changes, 'cuisines');
  END IF;
  IF OLD.plan IS DISTINCT FROM NEW.plan AND NEW.plan IS NOT NULL THEN
    v_changes := array_append(v_changes, 'plan');
  END IF;
  IF OLD.contact_phone IS DISTINCT FROM NEW.contact_phone AND NEW.contact_phone IS NOT NULL THEN
    v_changes := array_append(v_changes, 'phone');
  END IF;
  IF OLD.service_type IS DISTINCT FROM NEW.service_type THEN
    v_changes := array_append(v_changes, 'service type');
  END IF;
  IF OLD.onboarding_completed IS DISTINCT FROM NEW.onboarding_completed AND NEW.onboarding_completed = true THEN
    v_changes := array_append(v_changes, 'completed onboarding');
  END IF;

  IF array_length(v_changes, 1) > 0 THEN
    v_description := 'Updated: ' || array_to_string(v_changes, ', ');
    
    INSERT INTO public.chef_activities (chef_id, activity_type, description, admin_user_id)
    VALUES (NEW.id, 'profile_update', v_description, NULL);
  END IF;

  RETURN NEW;
END;
$function$

;
CREATE OR REPLACE FUNCTION public.record_chef_verification_activity()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_description text;
BEGIN
  -- Food safety quiz completed
  IF OLD.food_safety_quiz_passed IS DISTINCT FROM NEW.food_safety_quiz_passed AND NEW.food_safety_quiz_passed = true THEN
    v_description := 'Passed food safety quiz (score: ' || COALESCE(NEW.food_safety_quiz_score::text, '?') || '%)';
    INSERT INTO public.chef_activities (chef_id, activity_type, description)
    VALUES (NEW.chef_profile_id, 'quiz_completed', v_description);
  END IF;

  -- Documents uploaded
  IF OLD.kvk_document_url IS DISTINCT FROM NEW.kvk_document_url AND NEW.kvk_document_url IS NOT NULL THEN
    INSERT INTO public.chef_activities (chef_id, activity_type, description)
    VALUES (NEW.chef_profile_id, 'document_uploaded', 'Uploaded KVK document');
  END IF;
  IF OLD.id_document_url IS DISTINCT FROM NEW.id_document_url AND NEW.id_document_url IS NOT NULL THEN
    INSERT INTO public.chef_activities (chef_id, activity_type, description)
    VALUES (NEW.chef_profile_id, 'document_uploaded', 'Uploaded ID document');
  END IF;
  IF OLD.haccp_document_url IS DISTINCT FROM NEW.haccp_document_url AND NEW.haccp_document_url IS NOT NULL THEN
    INSERT INTO public.chef_activities (chef_id, activity_type, description)
    VALUES (NEW.chef_profile_id, 'document_uploaded', 'Uploaded HACCP document');
  END IF;

  -- Kitchen verified
  IF OLD.kitchen_verified_at IS DISTINCT FROM NEW.kitchen_verified_at AND NEW.kitchen_verified_at IS NOT NULL THEN
    v_description := 'Kitchen verified (score: ' || COALESCE(NEW.kitchen_score::text, '?') || ')';
    INSERT INTO public.chef_activities (chef_id, activity_type, description)
    VALUES (NEW.chef_profile_id, 'kitchen_verified', v_description);
  END IF;

  -- Contract signed
  IF OLD.contract_signed IS DISTINCT FROM NEW.contract_signed AND NEW.contract_signed = true THEN
    INSERT INTO public.chef_activities (chef_id, activity_type, description)
    VALUES (NEW.chef_profile_id, 'contract_signed', 'Signed contract');
  END IF;

  -- Menu reviewed
  IF OLD.menu_reviewed IS DISTINCT FROM NEW.menu_reviewed AND NEW.menu_reviewed = true THEN
    INSERT INTO public.chef_activities (chef_id, activity_type, description)
    VALUES (NEW.chef_profile_id, 'menu_reviewed', 'Reviewed menu');
  END IF;

  -- Verification completed
  IF OLD.verification_completed IS DISTINCT FROM NEW.verification_completed AND NEW.verification_completed = true THEN
    INSERT INTO public.chef_activities (chef_id, activity_type, description)
    VALUES (NEW.chef_profile_id, 'verification_completed', 'Completed all verification steps');
  END IF;

  RETURN NEW;
END;
$function$

;
CREATE OR REPLACE FUNCTION public.record_dish_activity()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_chef_id uuid;
BEGIN
  SELECT chef_profile_id INTO v_chef_id
  FROM public.menus
  WHERE id = NEW.menu_id
  LIMIT 1;

  IF v_chef_id IS NOT NULL THEN
    INSERT INTO public.chef_activities (chef_id, activity_type, description)
    VALUES (v_chef_id, 'menu_item_added', 'Added dish: ' || NEW.name);
  END IF;

  RETURN NEW;
END;
$function$

;
CREATE OR REPLACE FUNCTION public.sync_outbound_to_satellite()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_url        text;
  v_event_id   uuid := gen_random_uuid();
  v_chef_id    uuid;
  v_row_id     uuid;
  v_new        jsonb;
  v_old        jsonb;
  v_payload    jsonb;
  v_origin     text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_origin := COALESCE(OLD.sync_origin, 'local');
  ELSE
    v_origin := COALESCE(NEW.sync_origin, 'local');
  END IF;

  -- Loop prevention
  IF v_origin = 'satellite' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT value INTO v_url FROM public.sync_config WHERE key = 'OUTBOUND_RELAY_URL';
  IF v_url IS NULL THEN
    INSERT INTO public.sync_events(event_id, direction, table_name, op, chef_id, row_id, payload, status, error)
    VALUES (v_event_id, 'outbound', TG_TABLE_NAME, TG_OP, NULL, NULL, '{}'::jsonb, 'skipped', 'OUTBOUND_RELAY_URL missing');
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF TG_OP = 'INSERT' THEN
    v_new := to_jsonb(NEW) - 'sync_origin';
    v_old := NULL;
  ELSIF TG_OP = 'UPDATE' THEN
    v_new := to_jsonb(NEW) - 'sync_origin';
    v_old := to_jsonb(OLD) - 'sync_origin';
  ELSE
    v_new := NULL;
    v_old := to_jsonb(OLD) - 'sync_origin';
  END IF;

  IF TG_TABLE_NAME = 'chef_profiles' THEN
    v_chef_id := COALESCE((NEW).id, (OLD).id);
    v_row_id  := v_chef_id;
  ELSIF TG_TABLE_NAME = 'chef_admin_data' THEN
    v_chef_id := COALESCE((NEW).chef_profile_id, (OLD).chef_profile_id);
    v_row_id  := v_chef_id;
  ELSIF TG_TABLE_NAME = 'chef_admin_notes' THEN
    v_chef_id := COALESCE((NEW).chef_profile_id, (OLD).chef_profile_id);
    v_row_id  := COALESCE((NEW).id, (OLD).id);
  ELSIF TG_TABLE_NAME = 'chef_activities' THEN
    v_chef_id := COALESCE((NEW).chef_id, (OLD).chef_id);
    v_row_id  := COALESCE((NEW).id, (OLD).id);
  END IF;

  v_payload := jsonb_build_object(
    'event_id', v_event_id,
    'event_ts', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'source',   'crm',
    'table',    TG_TABLE_NAME,
    'op',       TG_OP,
    'chef_id',  v_chef_id,
    'row_id',   v_row_id,
    'new',      v_new,
    'old',      v_old
  );

  INSERT INTO public.sync_events(event_id, direction, table_name, op, chef_id, row_id, payload, status)
  VALUES (v_event_id, 'outbound', TG_TABLE_NAME, TG_OP, v_chef_id, v_row_id, v_payload, 'sent');

  PERFORM net.http_post(
    url     := v_url,
    body    := v_payload,
    headers := jsonb_build_object('Content-Type', 'application/json'),
    timeout_milliseconds := 10000
  );

  RETURN COALESCE(NEW, OLD);
EXCEPTION WHEN OTHERS THEN
  BEGIN
    INSERT INTO public.sync_events(event_id, direction, table_name, op, chef_id, row_id, payload, status, error)
    VALUES (v_event_id, 'outbound', TG_TABLE_NAME, TG_OP, v_chef_id, v_row_id, COALESCE(v_payload, '{}'::jsonb), 'error', SQLERRM)
    ON CONFLICT (event_id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  RETURN COALESCE(NEW, OLD);
END;
$function$

;
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$

;

-- ============ TRIGGERS ============
CREATE TRIGGER update_admin_onboarding_tasks_updated_at BEFORE UPDATE ON public.admin_onboarding_tasks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_catering_leads_updated_at BEFORE UPDATE ON public.catering_leads FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_notify_admin_on_activity AFTER INSERT ON public.chef_activities FOR EACH ROW EXECUTE FUNCTION notify_admin_on_chef_activity();
CREATE TRIGGER trg_sync_out_chef_activities AFTER INSERT OR DELETE OR UPDATE ON public.chef_activities FOR EACH ROW EXECUTE FUNCTION sync_outbound_to_satellite();
CREATE TRIGGER trg_notify_admin_on_chef_activity AFTER INSERT ON public.chef_activities FOR EACH ROW EXECUTE FUNCTION notify_admin_on_chef_activity();
CREATE TRIGGER trg_sync_out_chef_admin_data AFTER INSERT OR UPDATE ON public.chef_admin_data FOR EACH ROW EXECUTE FUNCTION sync_outbound_to_satellite();
CREATE TRIGGER update_chef_admin_data_updated_at BEFORE UPDATE ON public.chef_admin_data FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_sync_out_chef_admin_notes AFTER INSERT OR DELETE OR UPDATE ON public.chef_admin_notes FOR EACH ROW EXECUTE FUNCTION sync_outbound_to_satellite();
CREATE TRIGGER update_chef_onboarding_steps_updated_at BEFORE UPDATE ON public.chef_onboarding_steps FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_notify_hyperzod_merchant_webhook AFTER INSERT OR UPDATE ON public.chef_profiles FOR EACH ROW EXECUTE FUNCTION notify_hyperzod_merchant_webhook();
CREATE TRIGGER trg_chef_profile_activity AFTER UPDATE ON public.chef_profiles FOR EACH ROW EXECUTE FUNCTION record_chef_profile_activity();
CREATE TRIGGER on_chef_profile_created_assign_role AFTER INSERT ON public.chef_profiles FOR EACH ROW EXECUTE FUNCTION assign_chef_role_on_profile();
CREATE TRIGGER trg_record_chef_profile_activity AFTER UPDATE ON public.chef_profiles FOR EACH ROW EXECUTE FUNCTION record_chef_profile_activity();
CREATE TRIGGER update_chef_profiles_updated_at BEFORE UPDATE ON public.chef_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_sync_out_chef_profiles AFTER UPDATE ON public.chef_profiles FOR EACH ROW EXECUTE FUNCTION sync_outbound_to_satellite();
CREATE TRIGGER on_chef_profile_created AFTER INSERT ON public.chef_profiles FOR EACH ROW EXECUTE FUNCTION assign_chef_role_on_profile();
CREATE TRIGGER trg_chef_verification_activity AFTER UPDATE ON public.chef_verification FOR EACH ROW EXECUTE FUNCTION record_chef_verification_activity();
CREATE TRIGGER trg_record_chef_verification_activity AFTER UPDATE ON public.chef_verification FOR EACH ROW EXECUTE FUNCTION record_chef_verification_activity();
CREATE TRIGGER update_chef_verification_updated_at BEFORE UPDATE ON public.chef_verification FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_record_dish_activity AFTER INSERT ON public.dishes FOR EACH ROW EXECUTE FUNCTION record_dish_activity();
CREATE TRIGGER trg_dish_activity AFTER INSERT ON public.dishes FOR EACH ROW EXECUTE FUNCTION record_dish_activity();
CREATE TRIGGER update_drive_city_folders_updated_at BEFORE UPDATE ON public.drive_city_folders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_employee_tasks_updated_at BEFORE UPDATE ON public.employee_tasks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_kitchen_check_selections_updated_at BEFORE UPDATE ON public.kitchen_check_selections FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_menus_updated_at BEFORE UPDATE ON public.menus FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_merchant_setup_jobs_updated_at BEFORE UPDATE ON public.merchant_setup_jobs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_merchants_updated_at BEFORE UPDATE ON public.merchants FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_old_leads_updated_at BEFORE UPDATE ON public.old_leads FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_user_role_email BEFORE INSERT ON public.user_roles FOR EACH ROW EXECUTE FUNCTION populate_user_role_email();
CREATE TRIGGER trg_populate_user_role_email BEFORE INSERT ON public.user_roles FOR EACH ROW EXECUTE FUNCTION populate_user_role_email();
