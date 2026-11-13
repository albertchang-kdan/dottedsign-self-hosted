import { useCallback, useEffect, useState } from "react";
import {
  RECORDING_STATUS,
  blobToBase64,
  getRecordingConsent,
  getRecordingStream,
  giveRecordingConsent,
  isRecordingSupported,
  resetRecording,
  startRecording,
  stopRecording,
  subscribeRecording,
} from "../../helpers/signingRecorder";

export const RECORDING_STEP = {
  off: "off",
  consent: "consent",
  declined: "declined",
  requesting: "requesting",
  denied: "denied",
  noDevice: "no_device",
  unsupported: "unsupported",
  recording: "recording",
  interrupted: "interrupted",
};

const errorStep = (error) =>
  error?.name === "NotFoundError" || error?.name === "OverconstrainedError"
    ? RECORDING_STEP.noDevice
    : RECORDING_STEP.denied;

// NOTE: records the signer (camera + microphone) while a signature pad is open, for a signature
// field with options.recording. Consent is asked once per visit.
// finish() stops recording and returns { sign_recording, recording_info } to save with the signature,
// {} when recording is not needed, or null when there is no usable clip.
const useSigningRecording = (enabled) => {
  const [step, setStep] = useState(() => {
    if (!enabled) {
      return RECORDING_STEP.off;
    }
    return getRecordingConsent()
      ? RECORDING_STEP.requesting
      : RECORDING_STEP.consent;
  });

  const begin = useCallback(async () => {
    if (!isRecordingSupported()) {
      setStep(RECORDING_STEP.unsupported);
      return;
    }
    setStep(RECORDING_STEP.requesting);
    try {
      await startRecording({ consentedAt: getRecordingConsent() });
      setStep(RECORDING_STEP.recording);
    } catch (error) {
      setStep(errorStep(error));
    }
  }, []);

  const agree = useCallback(() => {
    giveRecordingConsent();
    begin();
  }, [begin]);

  // NOTE: already consented earlier in this visit: start right away
  useEffect(() => {
    if (enabled && getRecordingConsent()) {
      begin();
    }
  }, [enabled, begin]);

  // NOTE: camera unplugged / permission revoked; release the camera when the pad closes
  useEffect(() => {
    if (!enabled) {
      return undefined;
    }
    const unsubscribe = subscribeRecording((status) => {
      if (status === RECORDING_STATUS.interrupted) {
        setStep(RECORDING_STEP.interrupted);
      }
    });
    return () => {
      unsubscribe();
      resetRecording();
    };
  }, [enabled]);

  const finish = useCallback(async () => {
    if (!enabled) {
      return {};
    }
    const result = await stopRecording();
    if (!result?.blob?.size) {
      return null;
    }
    return {
      sign_recording: await blobToBase64(result.blob),
      recording_info: result.info,
    };
  }, [enabled]);

  return {
    enabled,
    step,
    setStep,
    agree,
    begin,
    finish,
    isReady: !enabled || step === RECORDING_STEP.recording,
    getStream: getRecordingStream,
  };
};

export default useSigningRecording;
