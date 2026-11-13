# System-wide settings, readable and changeable only by super admins (SUPER_ADMIN).
class Api::V1::SystemSettingsController < Api::ApplicationController
  before_action :security_checked
  before_action :check_super_admin!

  def signing_recording
    success_response(SystemSetting.signing_recording_policy)
  end

  def update_signing_recording
    success_response(SystemSetting.update_signing_recording_policy!(signing_recording_params))
  end

  private

  def signing_recording_params
    params.permit(*SystemSetting::SIGNING_RECORDING_DEFAULTS.keys)
  end

  def check_super_admin!
    error_response(:need_super_admin) unless current_member.super_admin?
  end
end
