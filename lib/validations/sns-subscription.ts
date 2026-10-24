import { z } from "zod";

export const createSubscriptionSchema = z.object({
  topicArn: z.string().min(1, "Topic ARN is required"),
  protocol: z.enum(["sqs", "email", "http", "https", "sms"]),
  endpoint: z.string().min(1, "Endpoint is required (Queue ARN, email address, or URL)"),
});

export type CreateSubscriptionInput = z.infer<typeof createSubscriptionSchema>;

export const deleteSubscriptionSchema = z.object({
  subscriptionArn: z.string().min(1, "Subscription ARN is required"),
});

export type DeleteSubscriptionInput = z.infer<typeof deleteSubscriptionSchema>;
