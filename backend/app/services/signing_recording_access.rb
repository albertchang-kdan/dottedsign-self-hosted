# Decides who may watch the video clips recorded while signers drew their signatures
# (signature-field option 'recording'), for a task or an envelope.
#
# Always allowed: super admins, and the signer who was recorded (their own clips only).
#   The recorded signer is the stage's member, or, for public-form and kiosk signers who are not
#   members, anyone signed in with the email address the signer entered.
# Allowed only if a super admin enabled it (SystemSetting.signing_recording_policy):
#   - visible_to_sender:        the owner (sender) of the task / envelope / public form
#   - visible_to_other_signers: other signers of the same task or envelope
#
# Clips live on one-time signatures (Signature / GuestSignature, label 'signing_recording'),
# which are bound to the field they signed (other_info.field_setting_id); the field's stage is the signer.
class SigningRecordingAccess
  Clip = Struct.new(:file, :signature, :stage)

  def initialize(source, member, policy: SystemSetting.signing_recording_policy)
    @source = source
    @member = member
    @policy = policy
  end

  def viewable_recordings
    clips.select { |clip| viewable?(clip.stage) }
  end

  def viewable?(stage)
    return false if @member.nil? || stage.nil?
    return true if @member.super_admin?
    return true if recorded_signer?(stage)
    return true if @policy['visible_to_sender'] && @source.owner_id == @member.id
    return true if @policy['visible_to_other_signers'] && signer_of_source?
    false
  end

  def display_info(clip)
    info = clip.signature.recording_info
    {
      stage_id: clip.stage.id,
      signer_name: clip.stage.actor_display_name,
      signer_email: clip.stage.actor_display_email,
      recorded_at: clip.file.uploaded_at&.to_i,
      consented_at: info['consented_at'],
      duration_seconds: info['duration_seconds'],
      download_link: clip.file.download_link
    }
  end

  private

  def recorded_signer?(stage)
    # public-form stages all share one system member as actor, so only the entered email counts
    return true if !form_sign_stage?(stage) && stage.actor_id.present? && stage.actor_id == @member.id
    email = (stage.try(:actor_info) || {})['email'].presence
    email.present? && @member.email.present? && email.casecmp?(@member.email)
  end

  def form_sign_stage?(stage)
    stage.respond_to?(:action_form_sign?) && stage.action_form_sign?
  end

  def signer_of_source?
    @signer_of_source = stages.any? { |stage| recorded_signer?(stage) } if @signer_of_source.nil?
    @signer_of_source
  end

  def stages
    @stages ||= @source.is_a?(Envelope) ? @source.dummy_stages.to_a : (@source.sign_stages.to_a + @source.dummy_stages.to_a)
  end

  def field_settings_by_id
    @field_settings_by_id ||= begin
      sources = @source.is_a?(Envelope) ? [@source, *@source.sign_tasks] : [@source]
      conditions = sources.map { |source| FieldSetting.where(source: source) }
      conditions.reduce { |all, condition| all.or(condition) }.includes(:stage).index_by(&:id)
    end
  end

  def clips
    @clips ||= begin
      field_ids = field_settings_by_id.keys.map(&:to_s)
      signatures = field_ids.empty? ? [] : [Signature, GuestSignature].flat_map do |klass|
        klass.field_bound_category.where("other_info ->> 'field_setting_id' IN (?)", field_ids).to_a
      end
      signatures.filter_map do |signature|
        file = signature.recording_file
        stage = field_settings_by_id[signature.other_info['field_setting_id'].to_i]&.stage
        Clip.new(file, signature, stage) if file && stage
      end.sort_by { |clip| clip.file.uploaded_at || Time.zone.at(0) }
    end
  end
end
