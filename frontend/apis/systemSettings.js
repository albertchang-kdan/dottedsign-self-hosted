import Cookie from "js-cookie";
import { invokeApi } from "../helpers/apiHelper";

const SIGNING_RECORDING_PATH = "/api/v1/system_settings/signing_recording";

// NOTE: super admin only: who besides the recorded signer may watch signing recordings
export const getSigningRecordingPolicy = () =>
  invokeApi({
    app: "sign",
    path: SIGNING_RECORDING_PATH,
    method: "GET",
    accessToken: Cookie.get("access_token"),
    data: {},
  });

export const putSigningRecordingPolicy = (data) =>
  invokeApi({
    app: "sign",
    path: SIGNING_RECORDING_PATH,
    method: "PUT",
    accessToken: Cookie.get("access_token"),
    data,
  });
