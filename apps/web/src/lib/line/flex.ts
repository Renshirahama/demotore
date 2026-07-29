import type { LineMessage } from "./client";

type MeetingFlexInput = {
  title: string;
  body: string;
  url?: string | null;
};

export function createMeetingRequestFlex(input: MeetingFlexInput): LineMessage {
  return {
    type: "flex",
    altText: input.title,
    contents: {
      type: "bubble",
      size: "mega",
      body: {
        type: "box",
        layout: "vertical",
        backgroundColor: "#1A1A2E",
        paddingAll: "20px",
        spacing: "md",
        contents: [
          {
            type: "text",
            text: "REBNISE Sponsor Connect",
            size: "xs",
            color: "#C4A35A",
            weight: "bold",
          },
          {
            type: "text",
            text: input.title,
            size: "lg",
            color: "#FFFFFF",
            weight: "bold",
            wrap: true,
          },
          {
            type: "separator",
            color: "#C4A35A",
            margin: "md",
          },
          {
            type: "text",
            text: input.body,
            size: "sm",
            color: "#E8E8EE",
            wrap: true,
            margin: "md",
          },
        ],
      },
      footer: {
        type: "box",
        layout: "vertical",
        backgroundColor: "#1A1A2E",
        paddingAll: "16px",
        contents: input.url
          ? [
              {
                type: "button",
                style: "primary",
                color: "#C4A35A",
                action: {
                  type: "uri",
                  label: "詳細を確認する",
                  uri: input.url,
                },
              },
            ]
          : [],
      },
    },
  };
}

export function createTextMessage(text: string): LineMessage {
  return { type: "text", text };
}
