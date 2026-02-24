import type { DruidProduct, DruidRegion } from "./types";

export interface ClusterConfig {
  clusterName: string;
  druidUrl: string;
  druidUsername: string;
  druidPassword: string;
  prometheusUrl: string;
}

interface ClusterEntry {
  product: DruidProduct;
  region: Exclude<DruidRegion, "all">;
  clusterName: string;
  druidUrlEnv: string;
  druidUsernameEnv: string;
  druidPasswordEnv: string;
  prometheusUrlEnv: string;
}

const CLUSTERS: ClusterEntry[] = [
  {
    product: "music",
    region: "gew1",
    clusterName: "osd-prod-gew1",
    druidUrlEnv: "DRUID_MUSIC_GEW1_URL",
    druidUsernameEnv: "DRUID_MUSIC_GEW1_USERNAME",
    druidPasswordEnv: "DRUID_MUSIC_GEW1_PASSWORD",
    prometheusUrlEnv: "PROMETHEUS_MUSIC_GEW1_URL",
  },
  {
    product: "music",
    region: "guc3",
    clusterName: "osd-prod-guc3",
    druidUrlEnv: "DRUID_MUSIC_GUC3_URL",
    druidUsernameEnv: "DRUID_MUSIC_GUC3_USERNAME",
    druidPasswordEnv: "DRUID_MUSIC_GUC3_PASSWORD",
    prometheusUrlEnv: "PROMETHEUS_MUSIC_GUC3_URL",
  },
  {
    product: "podcast",
    region: "gew4",
    clusterName: "podcast-prod-gew4",
    druidUrlEnv: "DRUID_PODCAST_GEW4_URL",
    druidUsernameEnv: "DRUID_PODCAST_GEW4_USERNAME",
    druidPasswordEnv: "DRUID_PODCAST_GEW4_PASSWORD",
    prometheusUrlEnv: "PROMETHEUS_PODCAST_GEW4_URL",
  },
  {
    product: "podcast",
    region: "guc3",
    clusterName: "podcast-prod-guc3",
    druidUrlEnv: "DRUID_PODCAST_GUC3_URL",
    druidUsernameEnv: "DRUID_PODCAST_GUC3_USERNAME",
    druidPasswordEnv: "DRUID_PODCAST_GUC3_PASSWORD",
    prometheusUrlEnv: "PROMETHEUS_PODCAST_GUC3_URL",
  },
];

function readEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

export function getClusterConfig(
  product: DruidProduct,
  region: Exclude<DruidRegion, "all">
): ClusterConfig {
  const entry = CLUSTERS.find(
    (c) => c.product === product && c.region === region
  );
  if (!entry) {
    throw new Error(`No cluster configured for ${product}/${region}`);
  }
  return {
    clusterName: entry.clusterName,
    druidUrl: readEnv(entry.druidUrlEnv),
    druidUsername: readEnv(entry.druidUsernameEnv),
    druidPassword: readEnv(entry.druidPasswordEnv),
    prometheusUrl: readEnv(entry.prometheusUrlEnv),
  };
}

export function getClusterConfigs(product: DruidProduct): ClusterConfig[] {
  return CLUSTERS.filter((c) => c.product === product).map((entry) => ({
    clusterName: entry.clusterName,
    druidUrl: readEnv(entry.druidUrlEnv),
    druidUsername: readEnv(entry.druidUsernameEnv),
    druidPassword: readEnv(entry.druidPasswordEnv),
    prometheusUrl: readEnv(entry.prometheusUrlEnv),
  }));
}

export function getRegionsForProduct(
  product: DruidProduct
): Exclude<DruidRegion, "all">[] {
  return CLUSTERS.filter((c) => c.product === product).map((c) => c.region);
}
