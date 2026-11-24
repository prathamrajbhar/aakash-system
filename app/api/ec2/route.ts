import { NextRequest, NextResponse } from "next/server";
import { getEC2Client } from "@/lib/aws/clients";
import { handleAwsError } from "@/lib/aws/error-handler";
import { readJson, validationError } from "@/lib/api/server";
import { buildServerEc2Details, PORT_RANGES } from "@/lib/aakash-network-server";
import { launchEC2InstanceSchema } from "@/lib/validations/ec2";
import {
  DescribeInstancesCommand,
  RunInstancesCommand,
} from "@aws-sdk/client-ec2";

export async function GET() {
  try {
    const ec2 = getEC2Client();
    const command = new DescribeInstancesCommand({});
    const response = await ec2.send(command);

    const instances: Array<{
      instanceId: string;
      state: string;
      instanceType: string;
      imageId: string;
      launchTime?: Date;
      publicIpAddress?: string;
      privateIpAddress?: string;
      internalContainerAddress?: string;
      sshPort: number;
      isPortValid: boolean;
      sshCommand: string;
    }> = [];

    // The emulator exposes no per-instance SSH port, so hints are derived:
    // live instances are numbered from the start of the SSH range in launch
    // order. Terminated instances never consume a port, and the order does not
    // depend on the order DescribeInstances happens to return.
    const all = (response.Reservations || []).flatMap((r) => r.Instances || []);
    const launchOrder = [...all]
      .filter((i) => i.State?.Name !== "terminated" && i.State?.Name !== "shutting-down")
      .sort(
        (a, b) =>
          (a.LaunchTime?.getTime() ?? 0) - (b.LaunchTime?.getTime() ?? 0) ||
          (a.InstanceId || "").localeCompare(b.InstanceId || "")
      );
    const portFor = new Map(
      launchOrder.map((inst, index) => [inst.InstanceId, PORT_RANGES.EC2_SSH_START + index])
    );

    for (const instance of all) {
      const instanceId = instance.InstanceId || "unknown";
      const state = instance.State?.Name || "unknown";
      const sshPort = portFor.get(instance.InstanceId) ?? 0;
      const privateIp = instance.PrivateIpAddress;
      const isLive = sshPort > 0;

      // Build SSH details using server config
      const sshDetails = buildServerEc2Details(sshPort, "root", privateIp, instanceId);

      instances.push({
        instanceId,
        state,
        instanceType: instance.InstanceType || "t2.micro",
        imageId: instance.ImageId || "",
        launchTime: instance.LaunchTime,
        publicIpAddress: instance.PublicIpAddress,
        privateIpAddress: instance.PrivateIpAddress,
        internalContainerAddress: sshDetails.internalContainerAddress,
        sshPort: sshDetails.port,
        isPortValid: isLive && sshDetails.isPortValid,
        sshCommand: isLive ? sshDetails.sshCommand : "Instance terminated",
      });
    }

    return NextResponse.json({ instances, count: instances.length });
  } catch (error) {
    return handleAwsError(error, "EC2_DESCRIBE_INSTANCES");
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await readJson(request);
    const validation = launchEC2InstanceSchema.safeParse(body);

    if (!validation.success) {
      return validationError(validation.error);
    }

    const { imageId, instanceType, minCount, maxCount, keyName } = validation.data;
    const ec2 = getEC2Client();
    const command = new RunInstancesCommand({
      ImageId: imageId,
      InstanceType: instanceType as never,
      MinCount: minCount,
      MaxCount: maxCount,
      KeyName: keyName,
    });

    const response = await ec2.send(command);
    const launched = (response.Instances || []).map((inst) => ({
      instanceId: inst.InstanceId,
      state: inst.State?.Name || "pending",
      instanceType: inst.InstanceType,
    }));

    return NextResponse.json({
      success: true,
      instances: launched,
    });
  } catch (error) {
    return handleAwsError(error, "EC2_RUN_INSTANCES");
  }
}
