import React, { useEffect, useRef } from "react";
import { useTranslation } from "next-i18next";
import { RECORDING_STEP } from "./useSigningRecording";
import {
  Overlay,
  Dialog,
  Title,
  Text,
  Notice,
  Actions,
  Button,
  Badge,
  Preview,
  RecDot,
} from "./styled";

// NOTE: consent / camera-problem dialogs, and a live "Recording" badge while the signer draws.
// Shown on top of the signature pad; closing the pad (onClose) discards the recording.
const RecordingGate = ({ recording, onClose }) => {
  const { t } = useTranslation("modal");
  const previewRef = useRef(null);
  const { step, setStep, agree, begin, getStream } = recording;

  useEffect(() => {
    if (step === RECORDING_STEP.recording && previewRef.current) {
      previewRef.current.srcObject = getStream();
    }
  }, [step, getStream]);

  if (step === RECORDING_STEP.off) {
    return null;
  }

  if (step === RECORDING_STEP.recording) {
    return (
      <Badge role="status" aria-live="polite">
        <Preview ref={previewRef} autoPlay muted playsInline />
        <span>
          <RecDot aria-hidden="true" />
          {t("signing_recording_badge")}
        </span>
      </Badge>
    );
  }

  const retry = {
    label: t("signing_recording_retry"),
    onClick: begin,
    primary: true,
  };
  const close = { label: t("signing_recording_close"), onClick: onClose };

  const dialogs = {
    [RECORDING_STEP.consent]: {
      title: t("signing_recording_consent_title"),
      body: t("signing_recording_consent_body"),
      notice: t("signing_recording_consent_notice"),
      actions: [
        {
          label: t("signing_recording_decline"),
          onClick: () => setStep(RECORDING_STEP.declined),
        },
        { label: t("signing_recording_agree"), onClick: agree, primary: true },
      ],
    },
    [RECORDING_STEP.declined]: {
      title: t("signing_recording_declined_title"),
      body: t("signing_recording_declined_body"),
      actions: [
        close,
        {
          label: t("signing_recording_back_to_consent"),
          onClick: () => setStep(RECORDING_STEP.consent),
          primary: true,
        },
      ],
    },
    [RECORDING_STEP.requesting]: {
      title: t("signing_recording_requesting_title"),
      body: t("signing_recording_requesting_body"),
      actions: [],
    },
    [RECORDING_STEP.denied]: {
      title: t("signing_recording_denied_title"),
      body: t("signing_recording_denied_body"),
      actions: [close, retry],
    },
    [RECORDING_STEP.noDevice]: {
      title: t("signing_recording_no_device_title"),
      body: t("signing_recording_no_device_body"),
      actions: [close, retry],
    },
    [RECORDING_STEP.unsupported]: {
      title: t("signing_recording_unsupported_title"),
      body: t("signing_recording_unsupported_body"),
      actions: [close],
    },
    [RECORDING_STEP.interrupted]: {
      title: t("signing_recording_interrupted_title"),
      body: t("signing_recording_interrupted_body"),
      actions: [close, retry],
    },
  };

  const dialog = dialogs[step] || dialogs[RECORDING_STEP.consent];

  return (
    <Overlay>
      <Dialog
        role="dialog"
        aria-modal="true"
        aria-labelledby="signing-recording-title"
      >
        <Title id="signing-recording-title">{dialog.title}</Title>
        <Text>{dialog.body}</Text>
        {dialog.notice && <Notice>{dialog.notice}</Notice>}
        {dialog.actions.length > 0 && (
          <Actions>
            {dialog.actions.map(({ label, onClick, primary }) => (
              <Button
                key={label}
                type="button"
                $primary={primary}
                onClick={onClick}
              >
                {label}
              </Button>
            ))}
          </Actions>
        )}
      </Dialog>
    </Overlay>
  );
};

export default RecordingGate;
