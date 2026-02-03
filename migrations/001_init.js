exports.up = (pgm) => {
  pgm.createExtension('uuid-ossp', { ifNotExists: true });

  pgm.createTable('businesses', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('uuid_generate_v4()')
    },
    name: { type: 'text', notNull: true },
    default_min_duration_seconds: { type: 'integer', notNull: true, default: 200 },
    default_send_delay_seconds: { type: 'integer', notNull: true, default: 0 },
    timezone: { type: 'text', notNull: true, default: 'America/Los_Angeles' },
    send_window_start_local: { type: 'text', notNull: true, default: '09:00' },
    send_window_end_local: { type: 'text', notNull: true, default: '20:00' },
    send_within_hours: { type: 'integer', notNull: true, default: 12 },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') }
  });

  pgm.createTable('phone_numbers', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('uuid_generate_v4()')
    },
    twilio_number: { type: 'text', notNull: true },
    business_id: { type: 'uuid', notNull: true, references: 'businesses', onDelete: 'cascade' },
    min_duration_seconds: { type: 'integer', notNull: false },
    send_delay_seconds: { type: 'integer', notNull: false },
    enabled: { type: 'boolean', notNull: true, default: false },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') }
  });

  pgm.addConstraint('phone_numbers', 'phone_numbers_twilio_number_unique', {
    unique: ['twilio_number']
  });

  pgm.createTable('message_templates', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('uuid_generate_v4()')
    },
    business_id: { type: 'uuid', notNull: true, references: 'businesses', onDelete: 'cascade' },
    name: { type: 'text', notNull: true },
    body: { type: 'text', notNull: true },
    is_default: { type: 'boolean', notNull: true, default: false },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') }
  });

  pgm.createIndex('message_templates', ['business_id']);

  pgm.createTable('call_events', {
    call_sid: { type: 'text', primaryKey: true },
    from_number: { type: 'text', notNull: true },
    to_number: { type: 'text', notNull: true },
    call_status: { type: 'text', notNull: true },
    call_duration_seconds: { type: 'integer' },
    last_payload: { type: 'jsonb', notNull: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') }
  });

  pgm.createIndex('call_events', ['to_number']);

  pgm.createType('message_job_status', ['QUEUED', 'SENT', 'FAILED', 'SUPPRESSED']);

  pgm.createTable('message_jobs', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('uuid_generate_v4()')
    },
    business_id: { type: 'uuid', notNull: true, references: 'businesses', onDelete: 'cascade' },
    phone_number_id: { type: 'uuid', notNull: true, references: 'phone_numbers', onDelete: 'cascade' },
    call_sid: { type: 'text', notNull: true },
    to_number: { type: 'text', notNull: true },
    template_body: { type: 'text' },
    status: { type: 'message_job_status', notNull: true },
    scheduled_at: { type: 'timestamptz' },
    sent_at: { type: 'timestamptz' },
    last_error: { type: 'text' },
    suppress_reason: { type: 'text' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') }
  });

  pgm.addConstraint('message_jobs', 'message_jobs_call_sid_unique', {
    unique: ['call_sid']
  });

  pgm.createIndex('message_jobs', ['status', 'scheduled_at']);
};

exports.down = (pgm) => {
  pgm.dropTable('message_jobs');
  pgm.dropType('message_job_status');
  pgm.dropTable('call_events');
  pgm.dropTable('message_templates');
  pgm.dropTable('phone_numbers');
  pgm.dropTable('businesses');
};
