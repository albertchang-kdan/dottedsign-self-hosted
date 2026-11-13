# Lists the signing recordings of a task that the current member is allowed to watch.
# Access rules live in SigningRecordingAccess.
class Api::V1::SignTasks::RecordingController < Api::ApplicationController
  # authentication for quick sign (in CodeAuthenticationHelper), so guest signers can watch their own recording
  prepend_before_action :allow_code_authentication_strategy

  before_action :security_checked
  before_action :setup_task
  # no check_accessibility: public-form / kiosk signers matched by email are not task members.
  # SigningRecordingAccess returns only the recordings this member may watch (none otherwise).
  before_action :check_available

  # NOTE: public-form signers use a form token, which is not accepted here on purpose: every form
  # signer shares one system member. They watch their recording by signing in with the email they entered.
  def signing_recordings
    access = SigningRecordingAccess.new(@source, current_member)
    recordings = access.viewable_recordings.map { |recording| access.display_info(recording) }
    success_response(signing_recordings: recordings)
  end
end
