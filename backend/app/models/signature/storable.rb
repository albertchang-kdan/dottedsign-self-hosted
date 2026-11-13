class Signature
  module Storable
    extend ActiveSupport::Concern

    include ShareStorable

    included do
      has_many :service_files, as: :storable, dependent: :destroy
      has_many :uploaded_files, -> { uploaded }, as: :storable, class_name: 'ServiceFile'
    end

    def raw_file
      uploaded_files.find_by(label: 'signature_raw')
    end

    def video_file
      uploaded_files.find_by(label: 'signature_video')
    end

    def photo_file
      uploaded_files.find_by(label: 'signature_photo')
    end

    def stroke_file
      uploaded_files.find_by(label: 'signature_stroke')
    end

    # camera + microphone clip recorded while the signer drew this signature
    def recording_file
      uploaded_files.find_by(label: ServiceFile::SIGNING_RECORDING_LABEL)
    end

    def recording_info
      (other_info || {})['recording'] || {}
    end

    def attach_signing_recording(recording_base64, info = {})
      return if recording_base64.blank?
      content = Base64.decode64(recording_base64)
      file_type = MimeMagic.by_magic(StringIO.new(content))&.type&.split('/')&.last
      raise ServiceError.new(:invalid_file_type) if ServiceFile::SIGNING_RECORDING_FILE_TYPES.exclude?(file_type)
      extension = file_type == 'mp4' ? 'mp4' : 'webm'
      upload_media_file(ServiceFile::SIGNING_RECORDING_LABEL, StringIO.new(content), "video/#{extension}", "signing_recording.#{extension}")
      info = (info || {}).to_h.with_indifferent_access
      update!(other_info: (other_info || {}).merge('recording' => {
        'consented_at' => info[:consented_at].presence&.to_i,
        'started_at' => info[:started_at].presence&.to_i,
        'duration_seconds' => info[:duration_seconds].presence&.to_i,
        'mime_type' => "video/#{extension}"
      }.compact))
    end

    def signature_raw
      raw_file.file_content.force_encoding(Encoding::UTF_8)
    end
  
    def raw_file_base64
      Base64.strict_encode64(signature_raw)
    end

    def upload_media_file(label, io, content_type, filename, skip_callback: false)
      attach_success = upload_service_file(label, io: io, content_type: content_type, filename: filename, skip_callback: skip_callback)
      raise ServiceError.new(:file_not_ready) unless attach_success
    end
  end
end
