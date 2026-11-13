# Adds the audit trail entry ('signing_recorded') when a signer whose signatures were recorded on
# video (signature-field option 'recording') signs. One entry per signer, listing their clips.
# Shared by every signing mode (task, envelope, kiosk, public form).
module SigningRecordingAudit
  module_function

  SIGNATURE_CLASSES = { 'signature' => 'Signature', 'guest_signature' => 'GuestSignature' }.freeze

  # source:      SignTask or Envelope receiving the event
  # event_stage: the signer's stage (shown as the actor in the audit trail)
  def record(source:, event_stage:, member_id:, sign_info:, client_info:, action_mode:, action_time: nil)
    signatures = recorded_signatures(sign_info[:signature_info])
    return if signatures.empty?

    infos = signatures.map(&:recording_info)
    other_info = {
      action_mode: action_mode,
      consented_at: infos.filter_map { |info| info['consented_at'] }.min,
      duration_seconds: infos.sum { |info| info['duration_seconds'].to_i },
      recordings: signatures.map do |signature|
        { signature_type: signature.class.name, signature_id: signature.id, duration_seconds: signature.recording_info['duration_seconds'] }.compact
      end
    }.compact
    source.add_sign_event(:signing_recorded, member_id, stage_info: event_stage.basic_info, client_info: client_info,
                                                        other_info: other_info, action_time: action_time)
  end

  def recorded_signatures(signature_info)
    Array(signature_info).filter_map do |info|
      class_name = SIGNATURE_CLASSES[info[:type].to_s]
      next if class_name.nil? || info[:value].blank?
      signature = class_name.constantize.find_by(id: info[:value].to_i)
      signature if signature&.recording_file
    end.uniq
  end
end
