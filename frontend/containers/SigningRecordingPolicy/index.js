import React, { useEffect, useState } from "react";
import { useTranslation } from "next-i18next";
import styled from "styled-components";
import Chkbox from "../../components/Checkbox";
import {
  getSigningRecordingPolicy,
  putSigningRecordingPolicy,
} from "../../apis/systemSettings";

const Title = styled.h3`
  margin: 0 0 6px;
  font-size: 16px;
  font-weight: 600;
`;

const Description = styled.p`
  margin: 0 0 14px;
  font-size: 13px;
  line-height: 1.5;
  color: #5b6170;
`;

const Row = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
  font-size: 14px;
`;

const RowText = styled.span`
  cursor: pointer;
`;

const Status = styled.p`
  margin: 4px 0 0;
  font-size: 12px;
  color: ${({ $isError }) => ($isError ? "#d93025" : "#5b6170")};
`;

const OPTIONS = ["visible_to_sender", "visible_to_other_signers"];

// NOTE: super admin setting: whether senders and other signers may watch signing recordings.
// The recorded signer and super admins can always watch them.
const SigningRecordingPolicy = () => {
  const { t } = useTranslation("admin");
  const [policy, setPolicy] = useState(null);
  const [status, setStatus] = useState(null);

  useEffect(() => {
    getSigningRecordingPolicy().then((resp) => {
      if (resp?.data) {
        setPolicy(resp.data);
      } else {
        setStatus("error");
      }
    });
  }, []);

  const onToggle = (key) => async () => {
    const previous = policy;
    const next = { ...policy, [key]: !policy[key] };
    setPolicy(next);
    setStatus("saving");
    const resp = await putSigningRecordingPolicy({ [key]: next[key] });
    if (resp?.data) {
      setPolicy(resp.data);
      setStatus("saved");
    } else {
      setPolicy(previous);
      setStatus("error");
    }
  };

  return (
    <div>
      <Title>{t("signing_recording_policy_title")}</Title>
      <Description>{t("signing_recording_policy_description")}</Description>
      {policy &&
        OPTIONS.map((key) => (
          <Row key={key}>
            <Chkbox
              id={`SigningRecordingPolicy-${key}`}
              isChecked={!!policy[key]}
              isReadOnly={status === "saving"}
              onToggle={onToggle(key)}
            />
            <RowText onClick={status === "saving" ? null : onToggle(key)}>
              {t(`signing_recording_policy_${key}`)}
            </RowText>
          </Row>
        ))}
      {status && (
        <Status $isError={status === "error"} role="status">
          {t(`signing_recording_policy_${status}`)}
        </Status>
      )}
    </div>
  );
};

export default SigningRecordingPolicy;
