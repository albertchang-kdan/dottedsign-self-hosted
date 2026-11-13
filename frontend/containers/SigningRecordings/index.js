import React, { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { useTranslation } from "next-i18next";
import styled from "styled-components";
import { getSigningRecordings } from "../../apis/sign";
import {
  Overlay,
  Dialog,
  Title,
  Text,
  Actions,
  Button,
} from "../SignBoardRecording/styled";

const OpenButton = styled.button`
  position: fixed;
  right: 16px;
  bottom: 16px;
  z-index: 2500;
  padding: 10px 16px;
  border: none;
  border-radius: 20px;
  background: #2b2f3a;
  color: #ffffff;
  font-size: 13px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
  cursor: pointer;
`;

const List = styled.ul`
  margin: 0;
  padding: 0;
  list-style: none;
`;

const Entry = styled.li`
  padding: 12px 0;
  border-top: 1px solid #e3e6ed;

  &:first-child {
    border-top: none;
  }
`;

const Meta = styled.div`
  margin-bottom: 8px;
  font-size: 13px;
  line-height: 1.5;
`;

const Video = styled.video`
  width: 100%;
  border-radius: 4px;
  background: #000000;
`;

const formatDuration = (seconds) => {
  if (!seconds && seconds !== 0) {
    return "";
  }
  const minutes = Math.floor(seconds / 60);
  const rest = String(seconds % 60).padStart(2, "0");
  return `${minutes}:${rest}`;
};

// NOTE: Lists the signing recordings of this task that the current viewer may watch
// (rules decided by the server). Hidden when there is nothing to show.
const SigningRecordings = () => {
  const { t } = useTranslation("modal");
  const { task_id, envelope_id, code, isSigningDone, isMyTurn } = useSelector(
    (state) => state.sign,
  );
  const [recordings, setRecordings] = useState([]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!task_id && !envelope_id) {
      return undefined;
    }
    let isActive = true;
    getSigningRecordings({
      taskId: task_id,
      envelopeId: envelope_id,
      code,
    }).then((resp) => {
      if (isActive && resp?.data?.signing_recordings) {
        setRecordings(resp.data.signing_recordings);
      }
    });
    return () => {
      isActive = false;
    };
  }, [task_id, envelope_id, code, isSigningDone, isMyTurn]);

  if (recordings.length === 0) {
    return null;
  }

  return (
    <>
      <OpenButton type="button" onClick={() => setIsOpen(true)}>
        {t("signing_recordings_open", { count: recordings.length })}
      </OpenButton>
      {isOpen && (
        <Overlay onClick={() => setIsOpen(false)}>
          <Dialog
            role="dialog"
            aria-modal="true"
            aria-labelledby="signing-recordings-title"
            onClick={(e) => e.stopPropagation()}
          >
            <Title id="signing-recordings-title">
              {t("signing_recordings_title")}
            </Title>
            <Text>{t("signing_recordings_privacy")}</Text>
            <List>
              {recordings.map((recording) => (
                <Entry key={recording.download_link}>
                  <Meta>
                    <strong>{recording.signer_name}</strong>
                    {recording.signer_email
                      ? ` (${recording.signer_email})`
                      : ""}
                    <br />
                    {recording.recorded_at
                      ? new Date(recording.recorded_at * 1000).toLocaleString()
                      : ""}
                    {recording.duration_seconds
                      ? ` · ${formatDuration(recording.duration_seconds)}`
                      : ""}
                  </Meta>
                  <Video
                    src={recording.download_link}
                    controls
                    preload="metadata"
                    playsInline
                  />
                </Entry>
              ))}
            </List>
            <Actions>
              <Button type="button" $primary onClick={() => setIsOpen(false)}>
                {t("signing_recordings_close")}
              </Button>
            </Actions>
          </Dialog>
        </Overlay>
      )}
    </>
  );
};

export default SigningRecordings;
