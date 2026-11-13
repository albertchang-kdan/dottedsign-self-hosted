require 'rails_helper'

RSpec.describe SystemSetting, type: :model do
  describe '.signing_recording_policy' do
    it 'defaults to recordings being hidden from senders and other signers' do
      expect(SystemSetting.signing_recording_policy).to eq(
        'visible_to_sender' => false,
        'visible_to_other_signers' => false
      )
    end
  end

  describe '.update_signing_recording_policy!' do
    it 'stores the given flags as booleans and keeps the others' do
      SystemSetting.update_signing_recording_policy!('visible_to_sender' => 'true')

      expect(SystemSetting.signing_recording_policy).to eq(
        'visible_to_sender' => true,
        'visible_to_other_signers' => false
      )
    end

    it 'ignores unknown keys' do
      SystemSetting.update_signing_recording_policy!('visible_to_everyone' => true, 'visible_to_other_signers' => true)

      expect(SystemSetting.signing_recording_policy).to eq(
        'visible_to_sender' => false,
        'visible_to_other_signers' => true
      )
      expect(SystemSetting.count).to eq(1)
    end
  end
end
