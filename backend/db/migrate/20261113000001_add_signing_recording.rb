class AddSigningRecording < ActiveRecord::Migration[6.1]
  # Signing recording is a signature-field option (options.recording, like options.photo), so it
  # needs no column. This adds the system-wide settings super admins use to choose who, besides the
  # recorded signer, may watch signing recordings.
  def change
    create_table :system_settings do |t|
      t.string :key, null: false
      t.json :value, default: {}
      t.timestamps
    end
    add_index :system_settings, :key, unique: true
  end
end
