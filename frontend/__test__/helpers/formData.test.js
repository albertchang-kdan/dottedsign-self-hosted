import { hasFileValue, toFormData } from "../../helpers/formData";

describe("apiHelper multipart uploads", () => {
  it("only switches to multipart when a value is a file", () => {
    expect(hasFileValue({ raw: "abc", category: "signature" })).toBe(false);
    expect(
      hasFileValue({ sign_recording: new Blob(["video"]), raw: "abc" }),
    ).toBe(true);
  });

  it("builds Rails-style multipart fields", () => {
    const clip = new File(["video"], "signing_recording.webm", {
      type: "video/webm",
    });
    const formData = toFormData({
      category: "signature_with_recording",
      sign_recording: clip,
      recording_info: { consented_at: 1700000000, duration_seconds: 4 },
      tags: ["a", "b"],
      skipped: null,
    });

    expect(formData.get("category")).toBe("signature_with_recording");
    expect(formData.get("sign_recording").name).toBe("signing_recording.webm");
    expect(formData.get("recording_info[consented_at]")).toBe("1700000000");
    expect(formData.get("recording_info[duration_seconds]")).toBe("4");
    expect(formData.getAll("tags[]")).toEqual(["a", "b"]);
    expect(formData.has("skipped")).toBe(false);
  });
});
