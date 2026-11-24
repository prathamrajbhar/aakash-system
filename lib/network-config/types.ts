/** Where users reach the Aakash API from their own tools (read from env). */
export interface AakashNetworkConfig {
  protocol: "http" | "https";
  host: string;
  apiPort: number;
}

export interface NetworkDiagnostics {
  apiEndpoint: string;
  host: string;
  protocol: "http" | "https";
  apiPort: number;
  portRanges: {
    rds: string;
    ec2Ssh: string;
    elastiCache: string;
  };
}
