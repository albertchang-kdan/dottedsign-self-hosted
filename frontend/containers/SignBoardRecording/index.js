import React, { useRef, useState, useEffect } from "react";
import { useTranslation } from "next-i18next";
import { useSelector, useDispatch } from "react-redux";
import * as signActions from "../../redux/actions/sign";
import { openToast } from "../../redux/actions/common";
import { useLicenseHook } from "../../helpers/license";
import { LICENSE_TYPE } from "../../constants/licenseTypes";
import { SIGNATURE_CATEGORY } from "../../constants/constants";
import toastStatus from "../../constants/toast";

import Portal from "../../components/Portal";
import SignBoard from "../../components/SignBoard";
import RecordingGate from "./RecordingGate";
import useSigningRecording from "./useSigningRecording";

// NOTE: signature pad for a signature field with options.recording:
// camera + microphone record only while this pad is open; the clip is saved with the signature,
// which is one-time and bound to this field (category signature_with_recording).
const SignBoardRecording = ({ onPanelClose, setSignature, signId }) => {
  const { t } = useTranslation("settings");
  const refCanvas = useRef(null);
  const timer = useRef(null);
  const frames = useRef([]);
  const [color, setColor] = useState("black");
  const [isValid, setIsValid] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const { isFrontDesk } = useSelector((state) => state.auth);
  const { isLoading, isFastSigning } = useSelector((state) => state.sign);
  const dispatch = useDispatch();

  const license = useLicenseHook(LICENSE_TYPE.SIGN_VIDEO);
  const recording = useSigningRecording(true);

  useEffect(() => {
    return () => {
      clearInterval(timer.current);
      dispatch(signActions.clearSignGuest());
    };
  }, []);

  // NOTE: pen replay frames, used by the existing SIGN_VIDEO license feature
  const getAndSetFrame = async () => {
    const canvas = refCanvas.current;
    const signFrame = await canvas.replaceDataURLBackground(
      canvas.toDataURL("image/png"),
    );
    frames.current.push(signFrame);
  };

  const onStart = () => {
    getAndSetFrame();
    clearInterval(timer.current);
    timer.current = setInterval(() => {
      getAndSetFrame();
    }, 100);
  };

  const onStop = () => {
    clearInterval(timer.current);
    setIsValid(!!refCanvas.current?.isSizeValid());
  };

  const onClear = () => {
    setIsValid(false);
    if (refCanvas.current) {
      refCanvas.current.clear();
      frames.current = [];
      if (refCanvas.current.clearPenData) {
        refCanvas.current.clearPenData();
      }
    }
  };

  const onSignSave = (data) => {
    const payload = {
      license,
      category: SIGNATURE_CATEGORY.SIGNATURE_WITH_RECORDING,
      file_type: "png",
      sign_stroke: data.sign_stroke,
      sign_recording: data.sign_recording,
      recording_info: data.recording_info,
      signId,
      callback: (signObj) => setSignature(signObj),
    };

    if (isFastSigning || isFrontDesk) {
      dispatch(
        signActions.saveSignGuest({
          ...payload,
          raw: { raw: data.raw, base64_images: data.base64_images },
        }),
      );
    } else {
      dispatch(
        signActions.saveSign({
          ...payload,
          raw: data.raw,
          base64_images: data.base64_images,
        }),
      );
    }
  };

  const onExport = async () => {
    if (!refCanvas.current || !recording.isReady) {
      return;
    }
    try {
      await getAndSetFrame();
      setIsProcessing(true);

      const signTemp = refCanvas.current
        .getTrimmedCanvas()
        .toDataURL("image/png");
      const trim = signTemp.split("data:image/png;base64,")[1];

      let stroke = "";
      if (refCanvas.current.getPenData) {
        stroke = refCanvas.current
          .getPenData()
          .map(
            (point) =>
              `${point.x},${point.y},${point.pressure},${point.timestamp},${
                point.isNewStroke ? "true" : "false"
              }`,
          )
          .join("\n");
      }

      const clip = await recording.finish();
      if (!clip) {
        dispatch(openToast({ payload: toastStatus.commonError }));
        recording.begin();
        return;
      }

      onSignSave({
        raw: trim,
        base64_images: frames.current,
        sign_stroke: stroke,
        ...clip,
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Portal>
      <SignBoard
        id="recording-sign-board"
        t={t}
        refCanvas={refCanvas}
        color={color}
        category={SIGNATURE_CATEGORY.SIGNATURE_WITH_RECORDING}
        isValid={isValid && recording.isReady}
        isProcessing={isProcessing || isLoading}
        // NOTE: hides 'sign on phone (QR code)': the recording must come from this camera
        isPhotoSignature
        onClose={onPanelClose}
        onSetColor={setColor}
        onStart={onStart}
        onStop={onStop}
        onClear={onClear}
        onExport={onExport}
      />
      <RecordingGate recording={recording} onClose={onPanelClose} />
    </Portal>
  );
};

export default SignBoardRecording;
