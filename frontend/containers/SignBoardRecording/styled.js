import styled from "styled-components";

export const Overlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 10001;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background: rgba(20, 24, 35, 0.72);
`;

export const Dialog = styled.div`
  width: 100%;
  max-width: 480px;
  max-height: calc(100vh - 32px);
  overflow-y: auto;
  padding: 28px 24px 24px;
  border-radius: 8px;
  background: #ffffff;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
  color: #2b2f3a;
`;

export const Title = styled.h2`
  margin: 0 0 12px;
  font-size: 20px;
  font-weight: 600;
`;

export const Text = styled.p`
  margin: 0 0 12px;
  font-size: 14px;
  line-height: 1.6;
  white-space: pre-line;
`;

export const Notice = styled.p`
  margin: 0 0 16px;
  padding: 10px 12px;
  border-radius: 4px;
  background: #fff4e5;
  font-size: 13px;
  line-height: 1.5;
`;

export const Actions = styled.div`
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 20px;
`;

export const Button = styled.button`
  min-width: 120px;
  padding: 10px 18px;
  border: 1px solid ${({ $primary }) => ($primary ? "#2d6ae3" : "#c5cad6")};
  border-radius: 4px;
  background: ${({ $primary }) => ($primary ? "#2d6ae3" : "#ffffff")};
  color: ${({ $primary }) => ($primary ? "#ffffff" : "#2b2f3a")};
  font-size: 14px;
  cursor: pointer;

  &:disabled {
    opacity: 0.6;
    cursor: default;
  }
`;

export const Badge = styled.div`
  position: fixed;
  left: 16px;
  bottom: 16px;
  z-index: 10000;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 12px 6px 6px;
  border-radius: 8px;
  background: rgba(20, 24, 35, 0.85);
  color: #ffffff;
  font-size: 13px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
`;

export const Preview = styled.video`
  width: 96px;
  height: 72px;
  border-radius: 4px;
  object-fit: cover;
  background: #000000;
  transform: scaleX(-1);
`;

export const RecDot = styled.span`
  display: inline-block;
  width: 10px;
  height: 10px;
  margin-right: 6px;
  border-radius: 50%;
  background: #e5484d;
  animation: rec-blink 1.2s ease-in-out infinite;

  @keyframes rec-blink {
    50% {
      opacity: 0.3;
    }
  }
`;
