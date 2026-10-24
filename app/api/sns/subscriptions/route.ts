import { NextRequest, NextResponse } from "next/server";
import {
  ListSubscriptionsCommand,
  ListSubscriptionsByTopicCommand,
  SubscribeCommand,
  UnsubscribeCommand,
} from "@aws-sdk/client-sns";
import { getSNSClient } from "@/lib/aws/clients";
import { handleAwsError } from "@/lib/aws/error-handler";
import { createSubscriptionSchema } from "@/lib/validations/sns-subscription";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const topicArn = searchParams.get("topicArn");
    const client = getSNSClient();

    let subscriptions: {
      subscriptionArn: string;
      owner: string;
      protocol: string;
      endpoint: string;
      topicArn: string;
    }[] = [];

    if (topicArn) {
      const res = await client.send(new ListSubscriptionsByTopicCommand({ TopicArn: topicArn }));
      subscriptions = (res.Subscriptions || []).map((s) => ({
        subscriptionArn: s.SubscriptionArn || "",
        owner: s.Owner || "",
        protocol: s.Protocol || "",
        endpoint: s.Endpoint || "",
        topicArn: s.TopicArn || "",
      }));
    } else {
      const res = await client.send(new ListSubscriptionsCommand({}));
      subscriptions = (res.Subscriptions || []).map((s) => ({
        subscriptionArn: s.SubscriptionArn || "",
        owner: s.Owner || "",
        protocol: s.Protocol || "",
        endpoint: s.Endpoint || "",
        topicArn: s.TopicArn || "",
      }));
    }

    return NextResponse.json({ subscriptions, count: subscriptions.length });
  } catch (error) {
    return handleAwsError(error, "SNS_LIST_SUBSCRIPTIONS");
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validation = createSubscriptionSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: { code: "ValidationError", message: validation.error.errors[0]?.message || "Invalid input" } },
        { status: 400 }
      );
    }

    const { topicArn, protocol, endpoint } = validation.data;
    const client = getSNSClient();

    const response = await client.send(
      new SubscribeCommand({
        TopicArn: topicArn,
        Protocol: protocol,
        Endpoint: endpoint,
        ReturnSubscriptionArn: true,
      })
    );

    return NextResponse.json({
      success: true,
      subscriptionArn: response.SubscriptionArn,
      topicArn,
      endpoint,
      protocol,
    });
  } catch (error) {
    return handleAwsError(error, "SNS_SUBSCRIBE");
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const subscriptionArn = searchParams.get("subscriptionArn");

    if (!subscriptionArn) {
      return NextResponse.json(
        { error: { code: "ValidationError", message: "subscriptionArn query parameter is required" } },
        { status: 400 }
      );
    }

    const client = getSNSClient();
    await client.send(new UnsubscribeCommand({ SubscriptionArn: subscriptionArn }));

    return NextResponse.json({ success: true, subscriptionArn });
  } catch (error) {
    return handleAwsError(error, "SNS_UNSUBSCRIBE");
  }
}
