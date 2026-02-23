import { describe, it, expect, vi, beforeEach } from "vitest";

// Use vi.hoisted so mock variables are available in hoisted vi.mock factories
const { mockProxy, mockServiceConstructor } = vi.hoisted(() => {
  const mockProxy = vi.fn();
  const mockServiceConstructor = vi.fn().mockImplementation(() => ({
    Proxy: mockProxy,
  }));
  return { mockProxy, mockServiceConstructor };
});

vi.mock("@grpc/grpc-js", () => ({
  loadPackageDefinition: vi.fn().mockReturnValue({
    spotify: {
      holocron: {
        v1: {
          HolocronProxyService: mockServiceConstructor,
        },
      },
    },
  }),
  credentials: {
    createInsecure: vi.fn().mockReturnValue({}),
  },
}));

vi.mock("@grpc/proto-loader", () => ({
  loadSync: vi.fn().mockReturnValue({}),
}));

import { HolocronGrpcClient } from "../grpc-client";

describe("HolocronGrpcClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("constructs with host config", () => {
    const client = new HolocronGrpcClient({
      host: "localhost:50051",
    });
    expect(client).toBeDefined();
    expect(mockServiceConstructor).toHaveBeenCalledWith(
      "localhost:50051",
      expect.anything()
    );
  });

  it("query sends SQL and returns parsed JSON rows", async () => {
    mockProxy.mockImplementation(
      (request: any, options: any, callback: any) => {
        callback(null, {
          status: 1, // OK
          columns: [{ name: "cnt", sqlType: "BIGINT", druidType: 2 }],
          data: Buffer.from(JSON.stringify([{ cnt: 42 }])),
        });
      }
    );

    const client = new HolocronGrpcClient({ host: "localhost:50051" });
    const rows = await client.query("SELECT COUNT(*) as cnt FROM sys.servers");

    expect(rows).toEqual([{ cnt: 42 }]);
    expect(mockProxy).toHaveBeenCalledWith(
      expect.objectContaining({
        query: "SELECT COUNT(*) as cnt FROM sys.servers",
        resultFormat: 3, // JSON_ARRAY
        queryType: 0, // SQL
      }),
      expect.anything(),
      expect.any(Function)
    );
  });

  it("query rejects on gRPC error", async () => {
    mockProxy.mockImplementation(
      (request: any, options: any, callback: any) => {
        callback(new Error("connection refused"), null);
      }
    );

    const client = new HolocronGrpcClient({ host: "localhost:50051" });
    await expect(
      client.query("SELECT 1")
    ).rejects.toThrow("connection refused");
  });

  it("query rejects on non-OK status", async () => {
    mockProxy.mockImplementation(
      (request: any, options: any, callback: any) => {
        callback(null, {
          status: 4, // INVALID_SQL
          errorMessage: "Unknown table sys.nope",
          data: null,
        });
      }
    );

    const client = new HolocronGrpcClient({ host: "localhost:50051" });
    await expect(
      client.query("SELECT * FROM sys.nope")
    ).rejects.toThrow("Unknown table sys.nope");
  });
});
