// NOTE: Signing recording (camera + microphone) captured in the browser while a signer draws a signature
// (signature-field option 'recording'). The live MediaStream, MediaRecorder and recorded Blob are not
// serializable, so they are kept here instead of in redux. Components subscribe to status changes.

const PREFERRED_MIME_TYPES = [
  "video/webm;codecs=vp8,opus",
  "video/webm",
  "video/mp4",
];

export const RECORDING_STATUS = {
  idle: "idle",
  recording: "recording",
  interrupted: "interrupted", // NOTE: camera/mic disconnected or permission revoked
  stopped: "stopped",
};

const emptyState = () => ({
  status: RECORDING_STATUS.idle,
  stream: null,
  recorder: null,
  chunks: [],
  mimeType: null,
  consentedAt: null,
  startedAt: null,
  stoppedAt: null,
  stopPromise: null,
  result: null,
});

let state = emptyState();
const listeners = new Set();

const notify = () => listeners.forEach((listener) => listener(state.status));

const setStatus = (status) => {
  state.status = status;
  notify();
};

const toUnixSeconds = (ms) => (ms ? Math.floor(ms / 1000) : null);

const releaseStream = () => {
  if (state.stream) {
    state.stream.getTracks().forEach((track) => track.stop());
  }
  state.stream = null;
};

export const subscribeRecording = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const getRecordingStatus = () => state.status;

export const getRecordingStream = () => state.stream;

export const isRecordingSupported = () =>
  typeof window !== "undefined" &&
  !!navigator.mediaDevices?.getUserMedia &&
  typeof window.MediaRecorder !== "undefined";

const pickMimeType = () =>
  PREFERRED_MIME_TYPES.find(
    (type) =>
      typeof window.MediaRecorder.isTypeSupported === "function" &&
      window.MediaRecorder.isTypeSupported(type),
  ) || "";

// NOTE: asks for camera + microphone and starts recording. Throws the browser's error
// (e.g. NotAllowedError, NotFoundError) when access is refused or no device exists.
export const startRecording = async ({ consentedAt }) => {
  if (state.status === RECORDING_STATUS.recording) {
    return state.stream;
  }
  resetRecording();

  const stream = await navigator.mediaDevices.getUserMedia({
    video: {
      width: { ideal: 640 },
      height: { ideal: 480 },
      facingMode: "user",
    },
    audio: true,
  });

  const mimeType = pickMimeType();
  const recorder = new window.MediaRecorder(stream, {
    ...(mimeType ? { mimeType } : {}),
    videoBitsPerSecond: 500000,
    audioBitsPerSecond: 64000,
  });

  state = {
    ...emptyState(),
    stream,
    recorder,
    mimeType: recorder.mimeType || mimeType || "video/webm",
    consentedAt: consentedAt || Date.now(),
    startedAt: Date.now(),
  };

  recorder.ondataavailable = (event) => {
    if (event.data && event.data.size > 0) {
      state.chunks.push(event.data);
    }
  };

  stream.getTracks().forEach((track) => {
    track.addEventListener("ended", () => {
      if (state.status === RECORDING_STATUS.recording) {
        setStatus(RECORDING_STATUS.interrupted);
      }
    });
  });

  recorder.start(1000);
  setStatus(RECORDING_STATUS.recording);
  return stream;
};

// NOTE: details sent with the sign request (audit trail); null when the signer never consented.
export const getRecordingInfo = () => {
  if (!state.consentedAt) {
    return null;
  }
  const end = state.stoppedAt || Date.now();
  return {
    consented_at: toUnixSeconds(state.consentedAt),
    started_at: toUnixSeconds(state.startedAt),
    duration_seconds: state.startedAt
      ? Math.max(0, Math.round((end - state.startedAt) / 1000))
      : 0,
    mime_type: (state.mimeType || "video/webm").split(";")[0],
  };
};

// NOTE: stops recording and resolves { blob, info }; safe to call more than once.
export const stopRecording = () => {
  if (state.result) {
    return Promise.resolve(state.result);
  }
  if (!state.recorder) {
    return Promise.resolve(null);
  }
  if (!state.stopPromise) {
    const { recorder } = state;
    state.stopPromise = new Promise((resolve) => {
      const finish = () => {
        state.stoppedAt = Date.now();
        const type = (state.mimeType || "video/webm").split(";")[0];
        state.result = {
          blob: new Blob(state.chunks, { type }),
          info: getRecordingInfo(),
        };
        releaseStream();
        setStatus(RECORDING_STATUS.stopped);
        resolve(state.result);
      };

      if (recorder.state === "inactive") {
        finish();
      } else {
        recorder.addEventListener("stop", finish, { once: true });
        recorder.stop();
      }
    });
  }
  return state.stopPromise;
};

// NOTE: discards any recording and releases the camera (e.g. when leaving the page).
export const resetRecording = () => {
  if (state.recorder && state.recorder.state !== "inactive") {
    state.recorder.ondataavailable = null;
    try {
      state.recorder.stop();
    } catch (e) {
      // NOTE: already stopped
    }
  }
  releaseStream();
  state = emptyState();
  notify();
};

// NOTE: the signer consents once per visit; later signature pads start recording right away
let consentedAt = null;

export const giveRecordingConsent = () => {
  consentedAt = consentedAt || Date.now();
  return consentedAt;
};

export const getRecordingConsent = () => consentedAt;

export const clearRecordingConsent = () => {
  consentedAt = null;
};

// NOTE: base64 (without the data: prefix) to send the clip with the signature
export const blobToBase64 = (blob) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
