module FieldSettings
  class Signature < FieldSetting

    def self.field_value_from_node(field_node)
      field_node.at('image')&.content
    end

    def validate_options
      errors.add(:options, 'invalid placeholder length') if options['placeholder'] && options['placeholder'].length > MAX_LENGTH
      # a signature field captures either a photo or a video recording, not both
      errors.add(:options, 'photo and recording cannot both be enabled') if options['photo'].present? && recording?
    end

    def match_content?(content, valid_signatures: [], **hsh)
      return options['force'] == false if content&.dig(:value).blank?
      signature = content[:type] == 'signature' ? valid_signatures.find_by(id: content[:value].to_i) : GuestSignature.find_by(id: content[:value].to_i)
      return false if signature.nil?
      return false unless signature.photo_file.present? == options['photo'].present?
      return true unless recording?
      signing_recording_for_this_field?(signature)
    end

    # option 'recording': the signer is recorded on video (camera + microphone) while drawing this signature
    def recording?
      ActiveModel::Type::Boolean.new.cast(options['recording']) || false
    end

    private

    # every recorded field needs its own clip, recorded for this field
    def signing_recording_for_this_field?(signature)
      return false if signature.recording_file.nil?
      bound_field_id = (signature.other_info || {})['field_setting_id']
      bound_field_id.nil? || bound_field_id.to_i == id
    end

    protected

    def self.match_by_field_info?(field_info)
      field_info[:field_type] == 'signature'
    end

    def self.match_by_field_node?(field_node)
      field_node.name == 'signature'
    end

  end
end
