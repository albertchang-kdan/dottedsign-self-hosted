# System-wide settings managed by super admins (members listed in SUPER_ADMIN).
# Each row is one named group of settings stored as JSON in `value`.
class SystemSetting < ApplicationRecord
  SIGNING_RECORDING_KEY = 'signing_recording'.freeze
  # Who, besides the recorded signer and super admins, may watch signing recordings.
  SIGNING_RECORDING_DEFAULTS = {
    'visible_to_sender' => false,
    'visible_to_other_signers' => false
  }.freeze

  validates :key, presence: true, uniqueness: true

  class << self
    def signing_recording_policy
      stored = find_by(key: SIGNING_RECORDING_KEY)&.value || {}
      SIGNING_RECORDING_DEFAULTS.merge(stored.slice(*SIGNING_RECORDING_DEFAULTS.keys))
    end

    def update_signing_recording_policy!(changes)
      setting = find_or_initialize_by(key: SIGNING_RECORDING_KEY)
      cast = changes.to_h.stringify_keys.slice(*SIGNING_RECORDING_DEFAULTS.keys).transform_values do |value|
        ActiveRecord::Type::Boolean.new.cast(value) || false
      end
      setting.value = signing_recording_policy.merge(cast)
      setting.save!
      setting.value
    end
  end
end
