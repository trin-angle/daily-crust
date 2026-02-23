import * as grpc from "@grpc/grpc-js";
import * as protoLoader from "@grpc/proto-loader";
import path from "path";

export interface HolocronConfig {
  host: string;
}

export class HolocronGrpcClient {
  private client: any;

  constructor(config: HolocronConfig) {
    const protoPath = path.resolve(
      process.cwd(),
      "lib/protos/holocronproxy.proto"
    );
    const packageDef = protoLoader.loadSync(protoPath, {
      keepCase: true,
      longs: String,
      defaults: true,
      includeDirs: [path.resolve(process.cwd(), "lib/protos")],
    });
    const proto = grpc.loadPackageDefinition(packageDef) as any;
    const Service = proto.spotify.holocron.v1.HolocronProxyService;
    this.client = new Service(config.host, grpc.credentials.createInsecure());
  }

  async query(sql: string): Promise<any[]> {
    const request = {
      query: sql,
      resultFormat: 3, // JSON_ARRAY
      context: {},
      queryType: 0, // SQL
    };

    return new Promise((resolve, reject) => {
      this.client.Proxy(
        request,
        { deadline: Date.now() + 10_000 },
        (err: Error | null, response: any) => {
          if (err) return reject(err);
          if (response.status !== 1) {
            return reject(
              new Error(response.errorMessage || "Query failed")
            );
          }
          const data = response.data
            ? JSON.parse(response.data.toString())
            : [];
          resolve(data);
        }
      );
    });
  }
}
