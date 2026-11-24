import { NextRequest, NextResponse } from "next/server";
import { getSESClient } from "@/lib/aws/clients";
import { handleAwsError } from "@/lib/aws/error-handler";
import { readJson, validationError } from "@/lib/api/server";
import { sendEmailSchema } from "@/lib/validations/ses";
import { SendEmailCommand } from "@aws-sdk/client-ses";

export async function POST(request: NextRequest) {
  try {
    const body = await readJson(request);
    const validation = sendEmailSchema.safeParse(body);

    if (!validation.success) {
      return validationError(validation.error);
    }

    const { source, destination, subject, bodyText, bodyHtml } = validation.data;
    const ses = getSESClient();

    const command = new SendEmailCommand({
      Source: source,
      Destination: {
        ToAddresses: [destination],
      },
      Message: {
        Subject: {
          Data: subject,
          Charset: "UTF-8",
        },
        Body: {
          Text: bodyText ? { Data: bodyText, Charset: "UTF-8" } : undefined,
          Html: bodyHtml ? { Data: bodyHtml, Charset: "UTF-8" } : undefined,
        },
      },
    });

    const response = await ses.send(command);

    return NextResponse.json({
      success: true,
      messageId: response.MessageId,
    });
  } catch (error) {
    return handleAwsError(error, "SES_SEND_EMAIL");
  }
}
