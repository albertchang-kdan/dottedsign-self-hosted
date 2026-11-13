import {
  RECORDING_STATUS,
  blobToBase64,
  clearRecordingConsent,
  getRecordingConsent,
  getRecordingInfo,
  giveRecordingConsent,
  getRecordingStatus,
  isRecordingSupported,
  resetRecording,
  startRecording,
  stopRecording,
  subscribeRecording,
} from "../../helpers/signingRecorder";

// NOTE: fake camera/microphone + MediaRecorder so the recorder can run in jsdom
class FakeTrack {
  constructor() {
    this.listeners = {};
    this.stop = jest.fn();
  }
  addEventListener(name, cb) {
    this.listeners[name] = cb;
  }
}

class FakeMediaRecorder {
  static isTypeSupported(type) {
    return type === "video/webm";
  }
  constructor(stream, options) {
    this.stream = stream;
    this.mimeType = options.mimeType;
    this.state = "inactive";
    this.listeners = {};
    FakeMediaRecorder.last = this;
  }
  start() {
    this.state = "recording";
  }
  stop() {
    this.state = "inactive";
    this.ondataavailable?.({ data: new Blob(["video-bytes"]) });
    this.listeners.stop?.();
  }
  addEventListener(name, cb) {
    this.listeners[name] = cb;
  }
}

let tracks;

beforeEach(() => {
  tracks = [new FakeTrack(), new FakeTrack()];
  window.MediaRecorder = FakeMediaRecorder;
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: {
      getUserMedia: jest.fn().mockResolvedValue({ getTracks: () => tracks }),
    },
  });
  resetRecording();
});

describe("signingRecorder", () => {
  it("detects browser support", () => {
    expect(isRecordingSupported()).toBe(true);
  });

  it("asks for camera and microphone and starts recording", async () => {
    await startRecording({ consentedAt: 1700000000000 });

    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith(
      expect.objectContaining({ audio: true, video: expect.any(Object) }),
    );
    expect(getRecordingStatus()).toBe(RECORDING_STATUS.recording);
    expect(FakeMediaRecorder.last.mimeType).toBe("video/webm");
    expect(getRecordingInfo()).toEqual(
      expect.objectContaining({
        consented_at: 1700000000,
        mime_type: "video/webm",
      }),
    );
  });

  it("returns no info before the signer consented", () => {
    expect(getRecordingInfo()).toBeNull();
  });

  it("stops once, returns the video and releases the camera", async () => {
    await startRecording({ consentedAt: Date.now() });

    const first = await stopRecording();
    const second = await stopRecording();

    expect(first.blob.size).toBeGreaterThan(0);
    expect(second).toBe(first);
    expect(tracks.every((track) => track.stop.mock.calls.length > 0)).toBe(
      true,
    );
    expect(getRecordingStatus()).toBe(RECORDING_STATUS.stopped);
  });

  it("reports an interruption when the camera disconnects", async () => {
    const listener = jest.fn();
    const unsubscribe = subscribeRecording(listener);
    await startRecording({ consentedAt: Date.now() });

    tracks[0].listeners.ended();

    expect(listener).toHaveBeenLastCalledWith(RECORDING_STATUS.interrupted);
    unsubscribe();
  });

  it("passes the browser error on when access is refused", async () => {
    const denied = Object.assign(new Error("denied"), {
      name: "NotAllowedError",
    });
    navigator.mediaDevices.getUserMedia.mockRejectedValueOnce(denied);

    await expect(startRecording({ consentedAt: Date.now() })).rejects.toBe(
      denied,
    );
    expect(getRecordingStatus()).toBe(RECORDING_STATUS.idle);
  });

  it("remembers consent for the rest of the visit", () => {
    clearRecordingConsent();
    expect(getRecordingConsent()).toBeNull();
    const first = giveRecordingConsent();
    expect(giveRecordingConsent()).toBe(first);
    expect(getRecordingConsent()).toBe(first);
    clearRecordingConsent();
  });

  it("converts the clip to base64 to save with the signature", async () => {
    const base64 = await blobToBase64(
      new Blob(["abc"], { type: "video/webm" }),
    );
    expect(base64).toBe("YWJj");
  });
});
