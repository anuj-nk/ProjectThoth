-- ============================================
-- PROJECT THOTH — Taxonomy Seed Migration
-- Replaces hardcoded VALID_DOMAINS, DOMAIN_ALIASES, and ALL_TOPICS
-- Run after 003_benchmark_api_support.sql
-- ============================================

-- ============================================
-- 1. TABLES
-- ============================================

CREATE TABLE IF NOT EXISTS sme_domains (
  value       TEXT PRIMARY KEY,
  label       TEXT NOT NULL,
  category    TEXT NOT NULL,
  active      BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sme_domain_aliases (
  alias        TEXT PRIMARY KEY,
  domain_value TEXT NOT NULL REFERENCES sme_domains(value) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS sme_topics (
  id            TEXT PRIMARY KEY,
  display       TEXT NOT NULL,
  domain        TEXT NOT NULL REFERENCES sme_domains(value) ON DELETE CASCADE,
  aliases       TEXT[] NOT NULL DEFAULT '{}',
  parent_id     TEXT REFERENCES sme_topics(id),
  owner_sme_id  UUID REFERENCES sme_profiles(sme_id),
  exposable     BOOLEAN DEFAULT true,
  routing_note  TEXT,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- 2. SEED: sme_domains
-- ============================================

INSERT INTO sme_domains (value, label, category) VALUES
  -- academic & research
  ('academics',          'Academics',            'academic'),
  ('research',           'Research',             'academic'),
  ('admissions',         'Admissions',           'academic'),
  ('student_wellbeing',  'Student Wellbeing',    'academic'),
  ('library_services',   'Library Services',     'academic'),
  ('graduate_studies',   'Graduate Studies',     'academic'),

  -- career & professional development
  ('career_services',    'Career Services',          'career'),
  ('recruiting',         'Recruiting',               'career'),
  ('talent_acquisition', 'Talent Acquisition',       'career'),
  ('hr',                 'HR',                       'career'),
  ('learning_development','Learning & Development',  'career'),

  -- business & strategy
  ('finance',            'Finance',              'business'),
  ('accounting',         'Accounting',           'business'),
  ('legal',              'Legal',                'business'),
  ('compliance',         'Compliance',           'business'),
  ('strategy',           'Strategy',             'business'),
  ('operations',         'Operations',           'business'),
  ('consulting',         'Consulting',           'business'),
  ('project_management', 'Project Management',   'business'),

  -- go-to-market
  ('marketing',          'Marketing',            'go_to_market'),
  ('sales',              'Sales',                'go_to_market'),
  ('partnerships',       'Partnerships',         'go_to_market'),
  ('business_development','Business Development','go_to_market'),
  ('customer_success',   'Customer Success',     'go_to_market'),
  ('public_relations',   'Public Relations',     'go_to_market'),
  ('communications',     'Communications',       'go_to_market'),

  -- technology
  ('engineering',         'Engineering',          'technology'),
  ('software_development','Software Development', 'technology'),
  ('data_analytics',      'Data & Analytics',     'technology'),
  ('data_science',        'Data Science',         'technology'),
  ('machine_learning',    'Machine Learning & AI','technology'),
  ('cybersecurity',       'Cybersecurity',        'technology'),
  ('it_purchasing',       'IT & Purchasing',      'technology'),
  ('cloud_infrastructure','Cloud Infrastructure', 'technology'),
  ('network_engineering', 'Network Engineering',  'technology'),
  ('product',             'Product Management',   'technology'),
  ('design',              'Design',               'technology'),
  ('ux_research',         'UX Research',          'technology'),

  -- telecom
  ('wireless_technology', 'Wireless Technology',  'telecom'),
  ('network_operations',  'Network Operations',   'telecom'),
  ('5g_technology',       '5G Technology',        'telecom'),
  ('spectrum_management', 'Spectrum Management',  'telecom'),
  ('device_ecosystem',    'Device Ecosystem',     'telecom'),

  -- hardware & physical
  ('facilities',          'Facilities',           'hardware'),
  ('prototyping_lab',     'Prototyping Lab',      'hardware'),
  ('supply_chain',        'Supply Chain',         'hardware'),
  ('manufacturing',       'Manufacturing',        'hardware'),
  ('hardware_engineering','Hardware Engineering', 'hardware'),

  -- health & social
  ('healthcare',               'Healthcare',                    'health_social'),
  ('public_health',            'Public Health',                 'health_social'),
  ('social_impact',            'Social Impact',                 'health_social'),
  ('sustainability',           'Sustainability',                'health_social'),
  ('diversity_equity_inclusion','Diversity, Equity & Inclusion','health_social'),

  -- creative & media
  ('content_creation', 'Content Creation', 'creative'),
  ('media_production', 'Media Production', 'creative'),
  ('journalism',       'Journalism',       'creative'),
  ('graphic_design',   'Graphic Design',   'creative'),

  -- catch-all
  ('other', 'Other', 'other')

ON CONFLICT (value) DO UPDATE
  SET label    = EXCLUDED.label,
      category = EXCLUDED.category;

-- Drop old check constraint and replace with FK after domains exist.
ALTER TABLE sme_profiles DROP CONSTRAINT IF EXISTS sme_profiles_domain_check;
ALTER TABLE sme_profiles DROP CONSTRAINT IF EXISTS sme_profiles_domain_fk;
ALTER TABLE sme_profiles
  ADD CONSTRAINT sme_profiles_domain_fk
  FOREIGN KEY (domain) REFERENCES sme_domains(value);

-- ============================================
-- 3. SEED: sme_domain_aliases
-- ============================================

INSERT INTO sme_domain_aliases (alias, domain_value) VALUES
  -- career_services
  ('career services',                       'career_services'),
  ('careers',                               'career_services'),
  ('career',                                'career_services'),
  ('career_services_industry_engagement',   'career_services'),
  ('career services & industry engagement', 'career_services'),

  -- student_wellbeing
  ('student wellbeing',  'student_wellbeing'),
  ('student well-being', 'student_wellbeing'),
  ('wellbeing',          'student_wellbeing'),
  ('wellness',           'student_wellbeing'),

  -- facilities / prototyping
  ('facility',        'facilities'),
  ('fab lab',         'prototyping_lab'),
  ('fabrication lab', 'prototyping_lab'),
  ('prototyping',     'prototyping_lab'),
  ('prototype lab',   'prototyping_lab'),
  ('fab',             'prototyping_lab'),

  -- it_purchasing
  ('it',            'it_purchasing'),
  ('purchasing',    'it_purchasing'),
  ('it & purchasing','it_purchasing'),
  ('it/purchasing', 'it_purchasing'),

  -- academics
  ('academic',          'academics'),
  ('academic services', 'academics'),

  -- admissions
  ('admission', 'admissions'),

  -- engineering & tech
  ('software',           'software_development'),
  ('software engineering','software_development'),
  ('dev',                'software_development'),
  ('development',        'software_development'),
  ('ml',                 'machine_learning'),
  ('ai',                 'machine_learning'),
  ('artificial intelligence','machine_learning'),
  ('data',               'data_analytics'),
  ('analytics',          'data_analytics'),
  ('data science',       'data_science'),
  ('infosec',            'cybersecurity'),
  ('security',           'cybersecurity'),
  ('cloud',              'cloud_infrastructure'),
  ('infrastructure',     'cloud_infrastructure'),
  ('networking',         'network_engineering'),
  ('ux',                 'ux_research'),
  ('user research',      'ux_research'),
  ('ui',                 'design'),
  ('product management', 'product'),
  ('pm',                 'product'),

  -- business
  ('biz dev',               'business_development'),
  ('bizdev',                'business_development'),
  ('gtm',                   'marketing'),
  ('growth',                'marketing'),
  ('pr',                    'public_relations'),
  ('comms',                 'communications'),
  ('ops',                   'operations'),
  ('finance & accounting',  'finance'),
  ('accounting & finance',  'finance'),
  ('legal & compliance',    'legal'),
  ('strategy & operations', 'strategy'),
  ('cx',                    'customer_success'),
  ('account management',    'customer_success'),

  -- hr & talent
  ('human resources',  'hr'),
  ('people ops',       'hr'),
  ('people operations','hr'),
  ('talent',           'talent_acquisition'),
  ('l&d',              'learning_development'),
  ('training',         'learning_development'),

  -- telecom
  ('5g',               '5g_technology'),
  ('telecom',          'wireless_technology'),
  ('telecommunications','wireless_technology'),
  ('wireless',         'wireless_technology'),
  ('noc',              'network_operations'),

  -- hardware
  ('hardware',                     'hardware_engineering'),
  ('manufacturing & supply chain', 'supply_chain'),
  ('logistics',                    'supply_chain'),

  -- health & social
  ('health',     'healthcare'),
  ('dei',        'diversity_equity_inclusion'),
  ('diversity',  'diversity_equity_inclusion'),
  ('inclusion',  'diversity_equity_inclusion'),
  ('esg',        'sustainability'),
  ('environment','sustainability'),

  -- creative
  ('content',       'content_creation'),
  ('media',         'media_production'),
  ('video',         'media_production'),
  ('design & media','graphic_design')

ON CONFLICT (alias) DO UPDATE
  SET domain_value = EXCLUDED.domain_value;

-- ============================================
-- 4. SEED: sme_topics
-- ============================================

INSERT INTO sme_topics (id, display, domain, aliases, exposable, routing_note) VALUES

  -- career_services
  ('international_student', 'International Student (general)', 'career_services',
    ARRAY['international', 'f1', 'f-1', 'international student'], true, NULL),
  ('visa', 'Visa & Work Authorization', 'career_services',
    ARRAY['visa', 'work authorization', 'h1b', 'stem opt'], true, NULL),
  ('cpt', 'CPT – Curricular Practical Training', 'career_services',
    ARRAY['cpt', 'curricular practical training', 'myisss'], true, NULL),
  ('opt', 'OPT – Optional Practical Training', 'career_services',
    ARRAY['opt', 'optional practical training', 'stem opt'], true, NULL),
  ('i20', 'I-20 / SEVIS', 'career_services',
    ARRAY['i-20', 'sevis', 'i20', 'immigration document'], true, NULL),
  ('internship', 'Internship & Co-op', 'career_services',
    ARRAY['internship', 'co-op', 'coop', 'practicum', 'work experience'], true, NULL),
  ('techin_601', 'TECHIN 601 (Capstone enrollment)', 'career_services',
    ARRAY['techin 601', '601', 'capstone course', 'capstone enrollment'], true, NULL),
  ('internship_search', 'Internship Search & Job Strategy', 'career_services',
    ARRAY['job search', 'internship search', 'career strategy', 'job hunting'], true, NULL),
  ('offer_negotiation', 'Offer Negotiation', 'career_services',
    ARRAY['negotiation', 'salary negotiation', 'offer evaluation', 'counter offer'], true, NULL),
  ('career_coaching', 'Career Coaching', 'career_services',
    ARRAY['career coaching', 'coaching', 'career counseling', '1:1'], true, NULL),
  ('industry_networking', 'Industry Networking', 'career_services',
    ARRAY['networking', 'industry connections', 'alumni network'], true, NULL),
  ('fee_waiver', 'Fee Waiver / Payment Issues', 'career_services',
    ARRAY['fee waiver', 'financial waiver', 'payment issue'], false,
    'Route to Patrick Chidsey — case-by-case, never answer directly'),
  ('course_petitions', 'MSTI Course Petitions', 'career_services',
    ARRAY['course petition', 'petition', 'independent study'], true, NULL),
  ('transcripts', 'Academic Transcripts & Records', 'career_services',
    ARRAY['transcript', 'academic records', 'official transcript'], true, NULL),

  -- academics
  ('course_registration', 'Course Registration', 'academics',
    ARRAY['registration', 'enroll', 'sign up for class'], true, NULL),
  ('grading_policy', 'Grading Policy', 'academics',
    ARRAY['grades', 'grading', 'gpa', 'academic standing'], true, NULL),
  ('academic_advising', 'Academic Advising', 'academics',
    ARRAY['advising', 'advisor', 'academic planning'], true, NULL),
  ('degree_requirements', 'Degree Requirements', 'academics',
    ARRAY['degree plan', 'graduation requirements', 'credits'], true, NULL),

  -- engineering
  ('system_design', 'System Design', 'engineering',
    ARRAY['architecture', 'system architecture', 'design patterns'], true, NULL),
  ('code_review', 'Code Review', 'engineering',
    ARRAY['pr review', 'pull request', 'code quality'], true, NULL),
  ('devops', 'DevOps & CI/CD', 'engineering',
    ARRAY['devops', 'ci/cd', 'deployment', 'pipeline'], true, NULL),

  -- product
  ('product_strategy', 'Product Strategy', 'product',
    ARRAY['roadmap', 'product vision', 'product planning'], true, NULL),
  ('user_research', 'User Research', 'product',
    ARRAY['user interviews', 'usability', 'research'], true, NULL),
  ('prioritization', 'Prioritization & Backlog', 'product',
    ARRAY['backlog', 'prioritization', 'sprint planning'], true, NULL),

  -- data_science
  ('ml_modeling', 'ML Modeling', 'data_science',
    ARRAY['machine learning', 'model training', 'model selection'], true, NULL),
  ('data_pipelines', 'Data Pipelines & ETL', 'data_science',
    ARRAY['etl', 'data pipeline', 'data engineering'], true, NULL),
  ('data_visualization', 'Data Visualization', 'data_science',
    ARRAY['dashboards', 'charts', 'reporting', 'viz'], true, NULL),

  -- hr
  ('onboarding', 'Employee Onboarding', 'hr',
    ARRAY['onboarding', 'new hire', 'orientation'], true, NULL),
  ('performance_review', 'Performance Reviews', 'hr',
    ARRAY['performance review', 'annual review', '360 feedback'], true, NULL),
  ('compensation', 'Compensation & Benefits', 'hr',
    ARRAY['compensation', 'benefits', 'salary', 'equity'], true, NULL)

ON CONFLICT (id) DO UPDATE
  SET display      = EXCLUDED.display,
      domain       = EXCLUDED.domain,
      aliases      = EXCLUDED.aliases,
      exposable    = EXCLUDED.exposable,
      routing_note = EXCLUDED.routing_note;

-- Broader starter coverage so every seeded domain has useful SME onboarding chips.
-- These are intentionally general "ownership areas"; interview synthesis can still
-- create more specific knowledge_entries.topic_tag values later.
INSERT INTO sme_topics (id, display, domain, aliases, exposable, routing_note) VALUES
  -- academics
  ('curriculum_planning', 'Curriculum Planning', 'academics',
    ARRAY['curriculum', 'course planning', 'program curriculum'], true, NULL),
  ('student_progress', 'Student Progress & Standing', 'academics',
    ARRAY['academic progress', 'student standing', 'degree progress'], true, NULL),
  ('faculty_office_hours', 'Faculty Office Hours', 'academics',
    ARRAY['office hours', 'faculty help', 'instructor support'], true, NULL),

  -- research
  ('research_methods', 'Research Methods', 'research',
    ARRAY['methods', 'study design', 'research design'], true, NULL),
  ('grant_proposals', 'Grant Proposals', 'research',
    ARRAY['grants', 'funding proposals', 'research funding'], true, NULL),
  ('irb_ethics', 'IRB & Research Ethics', 'research',
    ARRAY['irb', 'human subjects', 'ethics review'], true, NULL),
  ('publication_strategy', 'Publication Strategy', 'research',
    ARRAY['publishing', 'papers', 'journals'], true, NULL),

  -- admissions
  ('application_requirements', 'Application Requirements', 'admissions',
    ARRAY['application', 'requirements', 'admissions checklist'], true, NULL),
  ('portfolio_review', 'Portfolio Review', 'admissions',
    ARRAY['portfolio', 'application portfolio', 'work samples'], true, NULL),
  ('admissions_interviews', 'Admissions Interviews', 'admissions',
    ARRAY['interview', 'candidate interview', 'admissions conversation'], true, NULL),
  ('transfer_credit_review', 'Transfer Credit Review', 'admissions',
    ARRAY['transfer credit', 'prior credits', 'credit review'], true, NULL),

  -- student_wellbeing
  ('mental_health_resources', 'Mental Health Resources', 'student_wellbeing',
    ARRAY['mental health', 'counseling', 'therapy resources'], true, NULL),
  ('student_accommodations', 'Student Accommodations', 'student_wellbeing',
    ARRAY['accommodations', 'disability support', 'accessibility support'], true, NULL),
  ('crisis_support', 'Crisis Support', 'student_wellbeing',
    ARRAY['crisis', 'urgent support', 'safety concern'], false,
    'Route crisis or safety concerns to qualified staff immediately.'),
  ('community_belonging', 'Community & Belonging', 'student_wellbeing',
    ARRAY['belonging', 'community support', 'student community'], true, NULL),

  -- library_services
  ('research_databases', 'Research Databases', 'library_services',
    ARRAY['databases', 'library database', 'journal search'], true, NULL),
  ('citation_support', 'Citation Support', 'library_services',
    ARRAY['citations', 'apa', 'mla', 'citation manager'], true, NULL),
  ('literature_reviews', 'Literature Reviews', 'library_services',
    ARRAY['lit review', 'literature search', 'systematic review'], true, NULL),
  ('library_borrowing', 'Borrowing & Access', 'library_services',
    ARRAY['borrowing', 'library access', 'checkout'], true, NULL),

  -- graduate_studies
  ('thesis_requirements', 'Thesis Requirements', 'graduate_studies',
    ARRAY['thesis', 'capstone thesis', 'graduate thesis'], true, NULL),
  ('graduate_milestones', 'Graduate Milestones', 'graduate_studies',
    ARRAY['milestones', 'degree milestones', 'graduate timeline'], true, NULL),
  ('committee_formation', 'Committee Formation', 'graduate_studies',
    ARRAY['committee', 'advisor committee', 'thesis committee'], true, NULL),
  ('graduation_clearance', 'Graduation Clearance', 'graduate_studies',
    ARRAY['graduation', 'degree clearance', 'final audit'], true, NULL),

  -- career_services
  ('resume_reviews', 'Resume Reviews', 'career_services',
    ARRAY['resume', 'cv', 'resume review'], true, NULL),
  ('interview_preparation', 'Interview Preparation', 'career_services',
    ARRAY['mock interview', 'interview prep', 'behavioral interview'], true, NULL),
  ('employer_relations', 'Employer Relations', 'career_services',
    ARRAY['employers', 'company partners', 'industry partners'], true, NULL),
  ('career_events', 'Career Events', 'career_services',
    ARRAY['career fair', 'employer event', 'networking event'], true, NULL),

  -- recruiting
  ('candidate_sourcing', 'Candidate Sourcing', 'recruiting',
    ARRAY['sourcing', 'talent sourcing', 'candidate pipeline'], true, NULL),
  ('screening_process', 'Screening Process', 'recruiting',
    ARRAY['screening', 'phone screen', 'recruiter screen'], true, NULL),
  ('interview_coordination', 'Interview Coordination', 'recruiting',
    ARRAY['schedule interview', 'interview loop', 'candidate coordination'], true, NULL),
  ('offer_process', 'Offer Process', 'recruiting',
    ARRAY['offer', 'offer letter', 'candidate offer'], true, NULL),

  -- talent_acquisition
  ('workforce_planning', 'Workforce Planning', 'talent_acquisition',
    ARRAY['headcount', 'hiring plan', 'workforce plan'], true, NULL),
  ('hiring_manager_intake', 'Hiring Manager Intake', 'talent_acquisition',
    ARRAY['intake', 'role kickoff', 'hiring manager'], true, NULL),
  ('talent_branding', 'Talent Branding', 'talent_acquisition',
    ARRAY['employer brand', 'talent brand', 'candidate marketing'], true, NULL),
  ('recruiting_metrics', 'Recruiting Metrics', 'talent_acquisition',
    ARRAY['time to fill', 'recruiting dashboard', 'hiring metrics'], true, NULL),

  -- hr
  ('employee_relations', 'Employee Relations', 'hr',
    ARRAY['employee relations', 'workplace issue', 'manager concern'], false,
    'Employee relations questions can be sensitive; route case-specific issues to HR.'),
  ('leave_policies', 'Leave Policies', 'hr',
    ARRAY['leave', 'pto', 'medical leave', 'time off'], true, NULL),
  ('hr_policy_questions', 'HR Policy Questions', 'hr',
    ARRAY['policy', 'employee handbook', 'hr policy'], true, NULL),

  -- learning_development
  ('training_programs', 'Training Programs', 'learning_development',
    ARRAY['training', 'classes', 'employee learning'], true, NULL),
  ('manager_enablement', 'Manager Enablement', 'learning_development',
    ARRAY['manager training', 'leadership training', 'people manager'], true, NULL),
  ('skills_assessment', 'Skills Assessment', 'learning_development',
    ARRAY['skills', 'capability assessment', 'competency'], true, NULL),
  ('learning_paths', 'Learning Paths', 'learning_development',
    ARRAY['learning path', 'curriculum', 'development plan'], true, NULL),

  -- finance
  ('budget_planning', 'Budget Planning', 'finance',
    ARRAY['budget', 'budgeting', 'annual plan'], true, NULL),
  ('forecasting', 'Forecasting', 'finance',
    ARRAY['forecast', 'financial forecast', 'projection'], true, NULL),
  ('expense_policy', 'Expense Policy', 'finance',
    ARRAY['expenses', 'reimbursement', 'expense report'], true, NULL),
  ('financial_reporting', 'Financial Reporting', 'finance',
    ARRAY['reporting', 'financial report', 'variance report'], true, NULL),

  -- accounting
  ('accounts_payable', 'Accounts Payable', 'accounting',
    ARRAY['ap', 'vendor invoice', 'payables'], true, NULL),
  ('accounts_receivable', 'Accounts Receivable', 'accounting',
    ARRAY['ar', 'receivables', 'customer invoice'], true, NULL),
  ('month_end_close', 'Month-End Close', 'accounting',
    ARRAY['close', 'monthly close', 'close process'], true, NULL),
  ('tax_documentation', 'Tax Documentation', 'accounting',
    ARRAY['tax', 'tax forms', '1099'], true, NULL),

  -- legal
  ('contract_review', 'Contract Review', 'legal',
    ARRAY['contracts', 'agreement review', 'legal review'], true, NULL),
  ('intellectual_property', 'Intellectual Property', 'legal',
    ARRAY['ip', 'patents', 'trademarks', 'copyright'], true, NULL),
  ('privacy_terms', 'Privacy & Terms', 'legal',
    ARRAY['privacy policy', 'terms of service', 'data terms'], true, NULL),
  ('legal_escalations', 'Legal Escalations', 'legal',
    ARRAY['legal escalation', 'legal risk', 'lawyer review'], false,
    'Route case-specific legal advice to counsel.'),

  -- compliance
  ('policy_compliance', 'Policy Compliance', 'compliance',
    ARRAY['compliance policy', 'controls', 'policy adherence'], true, NULL),
  ('audit_readiness', 'Audit Readiness', 'compliance',
    ARRAY['audit', 'audit prep', 'evidence collection'], true, NULL),
  ('risk_assessment', 'Risk Assessment', 'compliance',
    ARRAY['risk', 'risk review', 'control risk'], true, NULL),
  ('regulatory_reporting', 'Regulatory Reporting', 'compliance',
    ARRAY['regulatory', 'regulator', 'compliance report'], true, NULL),

  -- strategy
  ('market_analysis', 'Market Analysis', 'strategy',
    ARRAY['market sizing', 'market research', 'competitive market'], true, NULL),
  ('strategic_planning', 'Strategic Planning', 'strategy',
    ARRAY['strategy plan', 'annual strategy', 'planning cycle'], true, NULL),
  ('competitive_analysis', 'Competitive Analysis', 'strategy',
    ARRAY['competitors', 'competitive intelligence', 'benchmarking'], true, NULL),
  ('okr_planning', 'OKR Planning', 'strategy',
    ARRAY['okr', 'goals', 'objectives'], true, NULL),

  -- operations
  ('process_improvement', 'Process Improvement', 'operations',
    ARRAY['process', 'continuous improvement', 'workflow'], true, NULL),
  ('vendor_management', 'Vendor Management', 'operations',
    ARRAY['vendors', 'supplier management', 'vendor process'], true, NULL),
  ('capacity_planning', 'Capacity Planning', 'operations',
    ARRAY['capacity', 'resource planning', 'staffing capacity'], true, NULL),
  ('standard_operating_procedures', 'Standard Operating Procedures', 'operations',
    ARRAY['sop', 'procedure', 'operating procedure'], true, NULL),

  -- consulting
  ('client_discovery', 'Client Discovery', 'consulting',
    ARRAY['discovery', 'client interview', 'requirements discovery'], true, NULL),
  ('stakeholder_management', 'Stakeholder Management', 'consulting',
    ARRAY['stakeholders', 'client stakeholders', 'alignment'], true, NULL),
  ('recommendation_decks', 'Recommendation Decks', 'consulting',
    ARRAY['deck', 'recommendations', 'client presentation'], true, NULL),
  ('implementation_roadmaps', 'Implementation Roadmaps', 'consulting',
    ARRAY['roadmap', 'implementation plan', 'rollout plan'], true, NULL),

  -- project_management
  ('project_scoping', 'Project Scoping', 'project_management',
    ARRAY['scope', 'project scope', 'charter'], true, NULL),
  ('timeline_management', 'Timeline Management', 'project_management',
    ARRAY['timeline', 'schedule', 'milestones'], true, NULL),
  ('risk_issue_tracking', 'Risk & Issue Tracking', 'project_management',
    ARRAY['risks', 'issues', 'raid log'], true, NULL),
  ('status_reporting', 'Status Reporting', 'project_management',
    ARRAY['status report', 'weekly update', 'project dashboard'], true, NULL),

  -- marketing
  ('brand_positioning', 'Brand Positioning', 'marketing',
    ARRAY['brand', 'positioning', 'messaging'], true, NULL),
  ('campaign_planning', 'Campaign Planning', 'marketing',
    ARRAY['campaign', 'marketing plan', 'launch campaign'], true, NULL),
  ('content_marketing', 'Content Marketing', 'marketing',
    ARRAY['content strategy', 'blog', 'content calendar'], true, NULL),
  ('marketing_analytics', 'Marketing Analytics', 'marketing',
    ARRAY['marketing metrics', 'attribution', 'campaign analytics'], true, NULL),

  -- sales
  ('sales_discovery', 'Sales Discovery', 'sales',
    ARRAY['discovery call', 'qualification', 'prospect discovery'], true, NULL),
  ('pipeline_management', 'Pipeline Management', 'sales',
    ARRAY['pipeline', 'crm pipeline', 'opportunity management'], true, NULL),
  ('pricing_discounting', 'Pricing & Discounting', 'sales',
    ARRAY['pricing', 'discount', 'quote'], true, NULL),
  ('sales_enablement', 'Sales Enablement', 'sales',
    ARRAY['enablement', 'sales playbook', 'battlecard'], true, NULL),

  -- partnerships
  ('partner_onboarding', 'Partner Onboarding', 'partnerships',
    ARRAY['partner onboarding', 'new partner', 'partner setup'], true, NULL),
  ('partner_programs', 'Partner Programs', 'partnerships',
    ARRAY['partner program', 'channel program', 'alliance program'], true, NULL),
  ('co_marketing', 'Co-Marketing', 'partnerships',
    ARRAY['co marketing', 'joint campaign', 'partner marketing'], true, NULL),
  ('alliance_management', 'Alliance Management', 'partnerships',
    ARRAY['alliance', 'strategic partner', 'relationship management'], true, NULL),

  -- business_development
  ('lead_generation', 'Lead Generation', 'business_development',
    ARRAY['leads', 'prospecting', 'lead gen'], true, NULL),
  ('strategic_accounts', 'Strategic Accounts', 'business_development',
    ARRAY['strategic account', 'target accounts', 'enterprise accounts'], true, NULL),
  ('deal_structuring', 'Deal Structuring', 'business_development',
    ARRAY['deal structure', 'commercial terms', 'partnership terms'], true, NULL),
  ('new_market_entry', 'New Market Entry', 'business_development',
    ARRAY['market entry', 'expansion', 'new segment'], true, NULL),

  -- customer_success
  ('customer_onboarding', 'Customer Onboarding', 'customer_success',
    ARRAY['customer onboarding', 'implementation', 'go live'], true, NULL),
  ('renewals', 'Renewals', 'customer_success',
    ARRAY['renewal', 'contract renewal', 'retention'], true, NULL),
  ('customer_health', 'Customer Health', 'customer_success',
    ARRAY['health score', 'customer risk', 'account health'], true, NULL),
  ('escalation_management', 'Escalation Management', 'customer_success',
    ARRAY['escalation', 'customer issue', 'urgent customer'], true, NULL),

  -- public_relations
  ('media_relations', 'Media Relations', 'public_relations',
    ARRAY['press', 'media', 'journalist'], true, NULL),
  ('press_releases', 'Press Releases', 'public_relations',
    ARRAY['press release', 'announcement', 'news release'], true, NULL),
  ('crisis_communications', 'Crisis Communications', 'public_relations',
    ARRAY['crisis comms', 'incident statement', 'reputation issue'], false,
    'Route crisis communications to approved PR owners.'),
  ('executive_visibility', 'Executive Visibility', 'public_relations',
    ARRAY['executive comms', 'thought leadership', 'speaking opportunity'], true, NULL),

  -- communications
  ('internal_communications', 'Internal Communications', 'communications',
    ARRAY['internal comms', 'employee announcement', 'all hands'], true, NULL),
  ('change_communications', 'Change Communications', 'communications',
    ARRAY['change comms', 'rollout communication', 'change management'], true, NULL),
  ('newsletter_operations', 'Newsletter Operations', 'communications',
    ARRAY['newsletter', 'email update', 'digest'], true, NULL),
  ('message_review', 'Message Review', 'communications',
    ARRAY['copy review', 'message approval', 'comms review'], true, NULL),

  -- engineering
  ('incident_response', 'Incident Response', 'engineering',
    ARRAY['incident', 'sev', 'production outage'], true, NULL),
  ('api_design', 'API Design', 'engineering',
    ARRAY['api', 'endpoint design', 'rest api'], true, NULL),
  ('technical_debt', 'Technical Debt', 'engineering',
    ARRAY['tech debt', 'refactor', 'maintenance'], true, NULL),

  -- software_development
  ('frontend_development', 'Frontend Development', 'software_development',
    ARRAY['frontend', 'react', 'ui development'], true, NULL),
  ('backend_development', 'Backend Development', 'software_development',
    ARRAY['backend', 'server', 'api implementation'], true, NULL),
  ('testing_quality', 'Testing & Quality', 'software_development',
    ARRAY['testing', 'qa', 'unit tests', 'integration tests'], true, NULL),
  ('release_management', 'Release Management', 'software_development',
    ARRAY['release', 'versioning', 'deployment release'], true, NULL),

  -- data_analytics
  ('dashboard_design', 'Dashboard Design', 'data_analytics',
    ARRAY['dashboard', 'reporting dashboard', 'bi'], true, NULL),
  ('metric_definitions', 'Metric Definitions', 'data_analytics',
    ARRAY['metrics', 'kpi', 'definitions'], true, NULL),
  ('sql_reporting', 'SQL Reporting', 'data_analytics',
    ARRAY['sql', 'queries', 'reporting sql'], true, NULL),
  ('experiment_analysis', 'Experiment Analysis', 'data_analytics',
    ARRAY['experiments', 'ab test', 'analysis'], true, NULL),

  -- data_science
  ('statistical_modeling', 'Statistical Modeling', 'data_science',
    ARRAY['statistics', 'statistical model', 'regression'], true, NULL),
  ('feature_engineering', 'Feature Engineering', 'data_science',
    ARRAY['features', 'feature store', 'model features'], true, NULL),
  ('model_evaluation', 'Model Evaluation', 'data_science',
    ARRAY['evaluation', 'validation', 'model metrics'], true, NULL),

  -- machine_learning
  ('llm_applications', 'LLM Applications', 'machine_learning',
    ARRAY['llm', 'generative ai', 'chatbot'], true, NULL),
  ('model_deployment', 'Model Deployment', 'machine_learning',
    ARRAY['deploy model', 'model serving', 'inference'], true, NULL),
  ('prompt_engineering', 'Prompt Engineering', 'machine_learning',
    ARRAY['prompt', 'prompting', 'system prompt'], true, NULL),
  ('model_monitoring', 'Model Monitoring', 'machine_learning',
    ARRAY['monitoring', 'drift', 'model performance'], true, NULL),

  -- cybersecurity
  ('identity_access_management', 'Identity & Access Management', 'cybersecurity',
    ARRAY['iam', 'access', 'permissions'], true, NULL),
  ('security_incidents', 'Security Incidents', 'cybersecurity',
    ARRAY['security incident', 'breach', 'suspicious activity'], false,
    'Route active security incidents to security response owners.'),
  ('vulnerability_management', 'Vulnerability Management', 'cybersecurity',
    ARRAY['vulnerability', 'cve', 'patching'], true, NULL),
  ('security_training', 'Security Training', 'cybersecurity',
    ARRAY['security awareness', 'phishing training', 'training'], true, NULL),

  -- it_purchasing
  ('software_procurement', 'Software Procurement', 'it_purchasing',
    ARRAY['software purchase', 'license', 'procurement'], true, NULL),
  ('hardware_requests', 'Hardware Requests', 'it_purchasing',
    ARRAY['hardware request', 'laptop', 'device request'], true, NULL),
  ('access_requests', 'Access Requests', 'it_purchasing',
    ARRAY['access request', 'account access', 'permission request'], true, NULL),
  ('vendor_security_review', 'Vendor Security Review', 'it_purchasing',
    ARRAY['vendor review', 'security review', 'third party review'], true, NULL),

  -- cloud_infrastructure
  ('cloud_cost_management', 'Cloud Cost Management', 'cloud_infrastructure',
    ARRAY['cloud cost', 'finops', 'aws bill'], true, NULL),
  ('infrastructure_as_code', 'Infrastructure as Code', 'cloud_infrastructure',
    ARRAY['iac', 'terraform', 'cloudformation'], true, NULL),
  ('container_platforms', 'Container Platforms', 'cloud_infrastructure',
    ARRAY['containers', 'kubernetes', 'docker'], true, NULL),
  ('cloud_reliability', 'Cloud Reliability', 'cloud_infrastructure',
    ARRAY['reliability', 'availability', 'sla'], true, NULL),

  -- network_engineering
  ('network_design', 'Network Design', 'network_engineering',
    ARRAY['network architecture', 'topology', 'lan wan'], true, NULL),
  ('vpn_access', 'VPN Access', 'network_engineering',
    ARRAY['vpn', 'remote access', 'secure access'], true, NULL),
  ('dns_routing', 'DNS & Routing', 'network_engineering',
    ARRAY['dns', 'routing', 'ip routing'], true, NULL),
  ('network_troubleshooting', 'Network Troubleshooting', 'network_engineering',
    ARRAY['network issue', 'connectivity', 'latency'], true, NULL),

  -- product
  ('requirements_definition', 'Requirements Definition', 'product',
    ARRAY['requirements', 'prd', 'product requirements'], true, NULL),
  ('launch_planning', 'Launch Planning', 'product',
    ARRAY['launch', 'go to market launch', 'release launch'], true, NULL),
  ('product_metrics', 'Product Metrics', 'product',
    ARRAY['product analytics', 'activation', 'retention'], true, NULL),

  -- design
  ('visual_design', 'Visual Design', 'design',
    ARRAY['visual', 'ui design', 'interface design'], true, NULL),
  ('design_systems', 'Design Systems', 'design',
    ARRAY['design system', 'components', 'tokens'], true, NULL),
  ('interaction_design', 'Interaction Design', 'design',
    ARRAY['interaction', 'prototype', 'flows'], true, NULL),
  ('accessibility_design', 'Accessibility Design', 'design',
    ARRAY['accessibility', 'a11y', 'inclusive design'], true, NULL),

  -- ux_research
  ('usability_testing', 'Usability Testing', 'ux_research',
    ARRAY['usability test', 'user test', 'moderated study'], true, NULL),
  ('research_planning', 'Research Planning', 'ux_research',
    ARRAY['research plan', 'study plan', 'research ops'], true, NULL),
  ('survey_design', 'Survey Design', 'ux_research',
    ARRAY['survey', 'questionnaire', 'quant research'], true, NULL),
  ('insight_synthesis', 'Insight Synthesis', 'ux_research',
    ARRAY['synthesis', 'research findings', 'insights'], true, NULL),

  -- telecom
  ('radio_access_networks', 'Radio Access Networks', 'wireless_technology',
    ARRAY['ran', 'radio network', 'cell site'], true, NULL),
  ('wireless_coverage', 'Wireless Coverage', 'wireless_technology',
    ARRAY['coverage', 'signal', 'rf coverage'], true, NULL),
  ('wireless_capacity', 'Wireless Capacity', 'wireless_technology',
    ARRAY['capacity', 'throughput', 'network capacity'], true, NULL),
  ('device_certification', 'Device Certification', 'wireless_technology',
    ARRAY['device certification', 'certification', 'carrier certification'], true, NULL),

  ('noc_operations', 'NOC Operations', 'network_operations',
    ARRAY['noc', 'network operations center', 'monitoring'], true, NULL),
  ('outage_management', 'Outage Management', 'network_operations',
    ARRAY['outage', 'network outage', 'service disruption'], true, NULL),
  ('field_operations', 'Field Operations', 'network_operations',
    ARRAY['field ops', 'technician', 'site visit'], true, NULL),
  ('network_maintenance', 'Network Maintenance', 'network_operations',
    ARRAY['maintenance window', 'planned maintenance', 'network work'], true, NULL),

  ('five_g_core', '5G Core', '5g_technology',
    ARRAY['5g core', 'standalone core', 'sa core'], true, NULL),
  ('network_slicing', 'Network Slicing', '5g_technology',
    ARRAY['slicing', 'network slice', 'private slice'], true, NULL),
  ('edge_compute', 'Edge Compute', '5g_technology',
    ARRAY['edge', 'mec', 'mobile edge'], true, NULL),
  ('private_5g', 'Private 5G', '5g_technology',
    ARRAY['private network', 'private 5g', 'enterprise 5g'], true, NULL),

  ('spectrum_licensing', 'Spectrum Licensing', 'spectrum_management',
    ARRAY['spectrum license', 'fcc', 'license'], true, NULL),
  ('spectrum_planning', 'Spectrum Planning', 'spectrum_management',
    ARRAY['spectrum plan', 'frequency planning', 'band planning'], true, NULL),
  ('interference_management', 'Interference Management', 'spectrum_management',
    ARRAY['interference', 'rf interference', 'signal interference'], true, NULL),
  ('spectrum_auction', 'Spectrum Auctions', 'spectrum_management',
    ARRAY['auction', 'spectrum auction', 'bidding'], true, NULL),

  ('device_testing', 'Device Testing', 'device_ecosystem',
    ARRAY['device test', 'handset testing', 'lab test'], true, NULL),
  ('oem_partnerships', 'OEM Partnerships', 'device_ecosystem',
    ARRAY['oem', 'device partner', 'manufacturer partner'], true, NULL),
  ('device_launches', 'Device Launches', 'device_ecosystem',
    ARRAY['device launch', 'launch readiness', 'handset launch'], true, NULL),
  ('device_support', 'Device Support', 'device_ecosystem',
    ARRAY['device support', 'troubleshooting', 'handset issue'], true, NULL),

  -- hardware & physical
  ('space_reservations', 'Space Reservations', 'facilities',
    ARRAY['room reservation', 'space booking', 'reserve room'], true, NULL),
  ('building_access', 'Building Access', 'facilities',
    ARRAY['badge access', 'door access', 'building entry'], true, NULL),
  ('maintenance_requests', 'Maintenance Requests', 'facilities',
    ARRAY['maintenance', 'repair', 'facility issue'], true, NULL),
  ('event_setup', 'Event Setup', 'facilities',
    ARRAY['event setup', 'room setup', 'tables chairs'], true, NULL),

  ('laser_cutting', 'Laser Cutting', 'prototyping_lab',
    ARRAY['laser cutter', 'laser', 'cutting'], true, NULL),
  ('3d_printing', '3D Printing', 'prototyping_lab',
    ARRAY['3d print', 'printer', 'additive manufacturing'], true, NULL),
  ('tool_training', 'Tool Training', 'prototyping_lab',
    ARRAY['tool training', 'safety training', 'machine training'], true, NULL),
  ('lab_safety', 'Lab Safety', 'prototyping_lab',
    ARRAY['safety', 'ppe', 'lab rules'], true, NULL),

  ('inventory_management', 'Inventory Management', 'supply_chain',
    ARRAY['inventory', 'stock', 'materials'], true, NULL),
  ('supplier_selection', 'Supplier Selection', 'supply_chain',
    ARRAY['supplier', 'vendor selection', 'sourcing'], true, NULL),
  ('logistics_planning', 'Logistics Planning', 'supply_chain',
    ARRAY['logistics', 'shipping', 'transportation'], true, NULL),
  ('procurement_timeline', 'Procurement Timeline', 'supply_chain',
    ARRAY['lead time', 'purchase timeline', 'delivery timeline'], true, NULL),

  ('production_planning', 'Production Planning', 'manufacturing',
    ARRAY['production', 'manufacturing plan', 'build plan'], true, NULL),
  ('quality_control', 'Quality Control', 'manufacturing',
    ARRAY['qc', 'quality inspection', 'defects'], true, NULL),
  ('lean_manufacturing', 'Lean Manufacturing', 'manufacturing',
    ARRAY['lean', 'kaizen', 'waste reduction'], true, NULL),
  ('factory_safety', 'Factory Safety', 'manufacturing',
    ARRAY['factory safety', 'manufacturing safety', 'osha'], true, NULL),

  ('pcb_design', 'PCB Design', 'hardware_engineering',
    ARRAY['pcb', 'circuit board', 'board design'], true, NULL),
  ('sensor_integration', 'Sensor Integration', 'hardware_engineering',
    ARRAY['sensor', 'embedded sensor', 'hardware integration'], true, NULL),
  ('embedded_systems', 'Embedded Systems', 'hardware_engineering',
    ARRAY['embedded', 'firmware', 'microcontroller'], true, NULL),
  ('hardware_testing', 'Hardware Testing', 'hardware_engineering',
    ARRAY['hardware test', 'validation', 'bench test'], true, NULL),

  -- health & social
  ('patient_workflows', 'Patient Workflows', 'healthcare',
    ARRAY['patient flow', 'clinical workflow', 'care workflow'], true, NULL),
  ('clinical_documentation', 'Clinical Documentation', 'healthcare',
    ARRAY['clinical notes', 'documentation', 'medical record'], true, NULL),
  ('health_data_privacy', 'Health Data Privacy', 'healthcare',
    ARRAY['hipaa', 'phi', 'health privacy'], false,
    'Route patient-specific or regulated health data questions to qualified owners.'),
  ('care_coordination', 'Care Coordination', 'healthcare',
    ARRAY['care team', 'referral', 'coordination'], true, NULL),

  ('epidemiology', 'Epidemiology', 'public_health',
    ARRAY['epi', 'disease trends', 'population health'], true, NULL),
  ('community_health_programs', 'Community Health Programs', 'public_health',
    ARRAY['community health', 'health program', 'outreach'], true, NULL),
  ('public_health_policy', 'Public Health Policy', 'public_health',
    ARRAY['health policy', 'public policy', 'regulation'], true, NULL),
  ('health_equity', 'Health Equity', 'public_health',
    ARRAY['equity', 'disparities', 'social determinants'], true, NULL),

  ('program_evaluation', 'Program Evaluation', 'social_impact',
    ARRAY['impact evaluation', 'program outcomes', 'measurement'], true, NULL),
  ('community_partnerships', 'Community Partnerships', 'social_impact',
    ARRAY['community partner', 'nonprofit partner', 'coalition'], true, NULL),
  ('impact_metrics', 'Impact Metrics', 'social_impact',
    ARRAY['impact', 'outcomes', 'social metrics'], true, NULL),
  ('grant_reporting', 'Grant Reporting', 'social_impact',
    ARRAY['grant report', 'funder report', 'impact report'], true, NULL),

  ('carbon_accounting', 'Carbon Accounting', 'sustainability',
    ARRAY['carbon', 'emissions', 'ghg'], true, NULL),
  ('sustainable_procurement', 'Sustainable Procurement', 'sustainability',
    ARRAY['green procurement', 'sustainable purchasing', 'supplier sustainability'], true, NULL),
  ('waste_reduction', 'Waste Reduction', 'sustainability',
    ARRAY['waste', 'recycling', 'zero waste'], true, NULL),
  ('climate_reporting', 'Climate Reporting', 'sustainability',
    ARRAY['climate report', 'esg report', 'sustainability report'], true, NULL),

  ('inclusive_hiring', 'Inclusive Hiring', 'diversity_equity_inclusion',
    ARRAY['inclusive recruiting', 'diverse hiring', 'hiring equity'], true, NULL),
  ('accessibility_inclusion', 'Accessibility & Inclusion', 'diversity_equity_inclusion',
    ARRAY['accessibility', 'inclusive access', 'accommodation'], true, NULL),
  ('employee_resource_groups', 'Employee Resource Groups', 'diversity_equity_inclusion',
    ARRAY['erg', 'affinity group', 'employee group'], true, NULL),
  ('bias_mitigation', 'Bias Mitigation', 'diversity_equity_inclusion',
    ARRAY['bias', 'unconscious bias', 'fairness'], true, NULL),

  -- creative & media
  ('editorial_calendar', 'Editorial Calendar', 'content_creation',
    ARRAY['editorial', 'content calendar', 'publishing calendar'], true, NULL),
  ('copywriting', 'Copywriting', 'content_creation',
    ARRAY['copy', 'writing', 'marketing copy'], true, NULL),
  ('seo_content', 'SEO Content', 'content_creation',
    ARRAY['seo', 'search content', 'keywords'], true, NULL),
  ('content_governance', 'Content Governance', 'content_creation',
    ARRAY['governance', 'style guide', 'content standards'], true, NULL),

  ('video_production', 'Video Production', 'media_production',
    ARRAY['video production', 'filming', 'shoot'], true, NULL),
  ('audio_production', 'Audio Production', 'media_production',
    ARRAY['audio', 'podcast', 'sound'], true, NULL),
  ('post_production', 'Post-Production', 'media_production',
    ARRAY['editing', 'post production', 'color correction'], true, NULL),
  ('media_asset_management', 'Media Asset Management', 'media_production',
    ARRAY['assets', 'media library', 'asset management'], true, NULL),

  ('source_verification', 'Source Verification', 'journalism',
    ARRAY['fact checking', 'sources', 'verification'], true, NULL),
  ('interview_reporting', 'Interview Reporting', 'journalism',
    ARRAY['reporting interview', 'journalist interview', 'quotes'], true, NULL),
  ('editorial_ethics', 'Editorial Ethics', 'journalism',
    ARRAY['ethics', 'editorial standards', 'corrections'], true, NULL),
  ('newsroom_workflow', 'Newsroom Workflow', 'journalism',
    ARRAY['newsroom', 'assignment desk', 'editorial process'], true, NULL),

  ('brand_identity', 'Brand Identity', 'graphic_design',
    ARRAY['identity', 'logo', 'brand system'], true, NULL),
  ('layout_design', 'Layout Design', 'graphic_design',
    ARRAY['layout', 'composition', 'print layout'], true, NULL),
  ('illustration', 'Illustration', 'graphic_design',
    ARRAY['illustration', 'drawing', 'visual art'], true, NULL),
  ('presentation_design', 'Presentation Design', 'graphic_design',
    ARRAY['slides', 'deck design', 'presentation'], true, NULL),

  -- catch-all
  ('general_expertise', 'General Expertise', 'other',
    ARRAY['general', 'miscellaneous', 'other'], true, NULL),
  ('unknown_topic_triage', 'Unknown Topic Triage', 'other',
    ARRAY['triage', 'unknown', 'not sure'], true, NULL),
  ('cross_functional_questions', 'Cross-Functional Questions', 'other',
    ARRAY['cross functional', 'multi team', 'general question'], true, NULL),
  ('admin_routing', 'Admin Routing', 'other',
    ARRAY['route to admin', 'admin review', 'unowned topic'], true, NULL)

ON CONFLICT (id) DO UPDATE
  SET display      = EXCLUDED.display,
      domain       = EXCLUDED.domain,
      aliases      = EXCLUDED.aliases,
      exposable    = EXCLUDED.exposable,
      routing_note = EXCLUDED.routing_note;

-- ============================================
-- 5. INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_sme_topics_domain    ON sme_topics(domain);
CREATE INDEX IF NOT EXISTS idx_sme_topics_exposable ON sme_topics(domain, exposable);
CREATE INDEX IF NOT EXISTS idx_sme_domains_active   ON sme_domains(active);
CREATE INDEX IF NOT EXISTS idx_sme_domains_category ON sme_domains(category);
