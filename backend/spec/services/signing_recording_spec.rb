require 'rails_helper'

# Signature-field option 'recording': the signer is recorded on video while drawing that signature.
# The clip is stored on that (one-time) signature, checked per field, audited, and shown only to allowed viewers.
RSpec.describe 'Signing recording', type: :model do
  # minimal WebM (EBML header with DocType "webm"), enough for file-type detection
  WEBM_BASE64 = Base64.strict_encode64(
    "\x1A\x45\xDF\xA3\x9F\x42\x86\x81\x01\x42\xF7\x81\x01\x42\xF2\x81\x04\x42\xF3\x81\x08\x42\x82\x84webm" \
    "\x42\x87\x81\x04\x42\x85\x81\x02".b + ("\x00" * 64)
  )

  before(:each) do
    # sender: member_b, signer: member_me
    @task = FactoryBot.create(:me_signer_waiting_task)
    @stage = @task.sign_stages.first
    @signer = @stage.actor
    @sender = @task.owner
    @field = FactoryBot.create(:field_setting, :signature, source: @task, stage: @stage)
  end

  def require_recording(field = @field)
    field.update!(options: field.options.merge('recording' => true))
    field.reload
  end

  def recorded_signature(field: nil, klass: :signature)
    signature = if klass == :signature
                  FactoryBot.create(:signature, member: @signer, category: 'signature_with_recording')
                else
                  GuestSignature.create!(category: 'signature_with_recording')
                end
    signature.attach_signing_recording(WEBM_BASE64, consented_at: 1_700_000_000, duration_seconds: 4)
    signature.update!(other_info: signature.other_info.merge('field_setting_id' => field.id, 'task_id' => field.source_id)) if field
    signature
  end

  describe 'storing the clip on the signature' do
    it 'keeps the video and its consent details' do
      signature = recorded_signature
      expect(signature.recording_file).to be_present
      expect(signature.recording_info).to include('consented_at' => 1_700_000_000, 'duration_seconds' => 4, 'mime_type' => 'video/webm')
    end

    it 'rejects files that are not video' do
      signature = FactoryBot.create(:signature, member: @signer, category: 'signature_with_recording')
      not_video = Base64.strict_encode64('just some text, not a video')
      expect { signature.attach_signing_recording(not_video) }.to raise_error(ServiceError) { |error| expect(error.key).to eq(:invalid_file_type) }
    end
  end

  describe 'field check' do
    def matches?(signature)
      content = { type: 'signature', value: signature.id.to_s }
      # load from the database so the field gets its signature-field type (FieldSettings::Signature)
      FieldSetting.find(@field.id).match_content?(content, valid_signatures: Signature.where(member_id: @signer.id))
    end

    it 'accepts any signature when the signer is not recorded' do
      expect(matches?(FactoryBot.create(:signature, member: @signer))).to eq(true)
    end

    context 'when the signer must be recorded' do
      before(:each) { require_recording }

      it 'rejects a signature without a clip' do
        expect(matches?(FactoryBot.create(:signature, member: @signer))).to eq(false)
      end

      it 'accepts a signature with its own clip' do
        expect(matches?(recorded_signature)).to eq(true)
      end

      it 'rejects a clip already used on another field' do
        other_field = FactoryBot.create(:field_setting, :signature, source: @task, stage: @stage)
        require_recording(other_field)
        expect(matches?(recorded_signature(field: other_field))).to eq(false)
        expect(matches?(recorded_signature(field: @field))).to eq(true)
      end
    end

    it 'asks mobile app signers to use a web browser' do
      require_recording
      verify = Normal::Verify.new(@task.id, @signer, { signature_info: [] }, { client: 'app' })
      verify.instance_variable_set(:@stage, @stage)
      expect { verify.send(:signing_recording_check) }.to raise_error(ServiceError) { |error| expect(error.key).to eq(:signing_recording_needs_browser) }

      verify = Normal::Verify.new(@task.id, @signer, { signature_info: [] }, { client: 'web' })
      verify.instance_variable_set(:@stage, @stage)
      expect { verify.send(:signing_recording_check) }.not_to raise_error
    end
  end

  describe 'audit trail' do
    it 'adds one entry listing the recorded signatures' do
      signature = recorded_signature(field: @field)
      sign_info = { signature_info: [{ type: 'signature', value: signature.id.to_s }, { type: 'textfield', value: 'hi' }] }
      event = SigningRecordingAudit.record(source: @task, event_stage: @stage, member_id: @signer.id, sign_info: sign_info,
                                           client_info: { client: 'web' }, action_mode: :normal)
      expect(event.action_name).to eq('signing_recorded')
      expect(event.other_info['recordings'].length).to eq(1)
      expect(event.other_info['duration_seconds']).to eq(4)
    end

    it 'adds nothing when no signature was recorded' do
      sign_info = { signature_info: [{ type: 'signature', value: FactoryBot.create(:signature, member: @signer).id.to_s }] }
      expect(SigningRecordingAudit.record(source: @task, event_stage: @stage, member_id: @signer.id, sign_info: sign_info,
                                          client_info: {}, action_mode: :normal)).to be_nil
    end
  end

  describe 'who can watch' do
    def viewable_for(member, policy = SystemSetting::SIGNING_RECORDING_DEFAULTS, source: @task)
      SigningRecordingAccess.new(source.reload, member, policy: policy).viewable_recordings.map(&:signature)
    end

    before(:each) do
      @clip = recorded_signature(field: @field)
      @other_stage = FactoryBot.create(:a_sign_stage, sequence: 2, sign_task: @task)
    end

    it 'lets the recorded signer watch their own clip' do
      expect(viewable_for(@signer)).to eq([@clip])
    end

    it 'hides the clip from the sender and other signers by default' do
      expect(viewable_for(@sender)).to be_empty
      expect(viewable_for(@other_stage.actor)).to be_empty
    end

    it 'shows the clip to the sender or other signers when admins allow it' do
      expect(viewable_for(@sender, { 'visible_to_sender' => true })).to eq([@clip])
      expect(viewable_for(@other_stage.actor, { 'visible_to_other_signers' => true })).to eq([@clip])
    end

    it 'always shows clips to super admins' do
      allow(@sender).to receive(:super_admin?).and_return(true)
      expect(viewable_for(@sender)).to eq([@clip])
    end

    it 'matches kiosk signers by the email they entered' do
      kiosk_stage = FactoryBot.create(:dummy_stage, source: @task, sequence: 3, status: 'processing',
                                                    actor_info: { 'email' => 'walk-in@test.com', 'role' => 'visitor' })
      kiosk_field = FactoryBot.create(:field_setting, :signature, source: @task, stage: kiosk_stage)
      kiosk_clip = recorded_signature(field: kiosk_field, klass: :guest)
      walk_in = FactoryBot.create(:member, name: 'Walk In', email: 'Walk-In@test.com')
      expect(viewable_for(walk_in)).to eq([kiosk_clip])
    end

    it 'never lets the shared public-form system account watch, only the email the form signer entered' do
      form_stage = FactoryBot.create(:form_processing_sign_stage, sign_task: @task, sequence: 4)
      form_stage.update!(actor_info: form_stage.actor_info.merge('email' => 'form-signer@test.com'))
      form_field = FactoryBot.create(:field_setting, :signature, source: @task, stage: form_stage)
      form_clip = recorded_signature(field: form_field, klass: :guest)

      expect(viewable_for(form_stage.actor)).to be_empty
      form_signer = FactoryBot.create(:member, name: 'Form Signer', email: 'form-signer@test.com')
      expect(viewable_for(form_signer)).to eq([form_clip])
    end

    it 'covers envelopes' do
      envelope = FactoryBot.create(:me_signer_waiting_envelope)
      envelope_stage = envelope.dummy_stages.find { |stage| stage.actor_id.present? }
      envelope_field = FactoryBot.create(:field_setting, :signature, source: envelope, stage: envelope_stage)
      envelope_clip = recorded_signature(field: envelope_field)

      expect(viewable_for(envelope_stage.actor, source: envelope)).to eq([envelope_clip])
      expect(viewable_for(envelope.owner, source: envelope)).to be_empty
      expect(viewable_for(envelope.owner, { 'visible_to_sender' => true }, source: envelope)).to eq([envelope_clip])
    end
  end

  it 'does not allow photo and recording on the same field' do
    field = FieldSetting.find(@field.id)
    field.options = field.options.merge('photo' => true, 'recording' => true)
    field.validate_options
    expect(field.errors[:options]).to include('photo and recording cannot both be enabled')
  end

  it 'allows recording as a signature field option' do
    expect(FieldSettings::Signature.default_options.keys.map(&:to_s)).to include('recording')
  end
end