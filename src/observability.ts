import "dotenv/config";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { LangfuseSpanProcessor } from "@langfuse/otel";

let sdk: NodeSDK | undefined;

export function startLangfuse() {
  if (sdk) return { enabled: true };

  const hasCredentials =
    Boolean(process.env.LANGFUSE_PUBLIC_KEY) &&
    Boolean(process.env.LANGFUSE_SECRET_KEY);

  if (!hasCredentials) {
    return { enabled: false };
  }

  sdk = new NodeSDK({
    spanProcessors: [new LangfuseSpanProcessor()]
  });
  sdk.start();

  return { enabled: true };
}

export async function shutdownLangfuse() {
  if (!sdk) return;
  await sdk.shutdown();
  sdk = undefined;
}
